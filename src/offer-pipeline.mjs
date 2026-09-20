import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { resolveOfferContract } from './offer-contract.mjs';
import { evaluateOfferContract } from './offer-contract-gap-engine.mjs';
import {
  captureLegacyComparison,
  applyOfferComparisonDecision
} from './offer-comparison-decision.mjs';

const ENGINE_FILES = [
  '../assets/offer-parser.js',
  '../assets/offer-followup.js',
  '../assets/offer-merge.js',
  '../assets/offer-normalizer.js'
];

let engineCache = null;

function loadEngines() {
  if (engineCache) return engineCache;
  const context = { window: {}, console };
  vm.createContext(context);
  for (const relativePath of ENGINE_FILES) {
    const source = fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8');
    vm.runInContext(source, context, { filename: relativePath });
  }
  engineCache = {
    parser: context.window.sdOfferParser,
    followup: context.window.sdOfferFollowup,
    merge: context.window.sdOfferMerge,
    normalizer: context.window.sdOfferNormalizer
  };
  if (!engineCache.parser || !engineCache.followup || !engineCache.merge || !engineCache.normalizer) {
    throw new Error('OFFER_ENGINE_LOAD_FAILED');
  }
  return engineCache;
}

function parseJson(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function taskForPipeline(db, taskId) {
  if (!taskId) return {};
  const row = db.prepare(`SELECT * FROM tasks WHERE task_id = ? LIMIT 1`).get(taskId);
  if (!row) return {};
  const taskJson = parseJson(row.task_json, {});
  return {
    ...row,
    ...(taskJson && typeof taskJson === 'object' && !Array.isArray(taskJson) ? taskJson : {}),
    taskId: row.task_id,
    categoryId: taskJson?.categoryId || row.service_id || '',
    category: taskJson?.category || row.service_name || '',
    city: taskJson?.city || row.city || '',
    description: taskJson?.description || row.description || ''
  };
}

function latestOffer(db, requestId) {
  return db.prepare(`SELECT * FROM contractor_offers WHERE request_id = ? ORDER BY version DESC LIMIT 1`).get(requestId);
}

export function processContractorReply(db, {
  requestId,
  rawText,
  channel = null,
  externalMessageId = null,
  receivedAt = null,
  metadata = {}
}) {
  const text = String(rawText || '').trim();
  if (!requestId) throw Object.assign(new Error('REQUEST_ID_REQUIRED'), { statusCode: 400 });
  if (!text) throw Object.assign(new Error('RAW_TEXT_REQUIRED'), { statusCode: 400 });

  const outreach = db.prepare(`SELECT * FROM outreach_attempts WHERE request_id = ? LIMIT 1`).get(requestId);
  if (!outreach) throw Object.assign(new Error('OUTREACH_NOT_FOUND'), { statusCode: 404 });

  if (externalMessageId) {
    const duplicate = db.prepare(`SELECT reply_id, request_id, received_at FROM contractor_replies WHERE request_id = ? AND external_message_id = ? ORDER BY created_at ASC LIMIT 1`).get(requestId, externalMessageId);
    if (duplicate) return { duplicate: true, reply: { reply_id: duplicate.reply_id, request_id: duplicate.request_id, type: 'duplicate', received_at: duplicate.received_at }, offer: null, clarification: null };
  }

  const engines = loadEngines();
  const task = taskForPipeline(db, outreach.task_id);
  const previous = latestOffer(db, requestId);
  const parsed = engines.parser.parse(text);
  parsed.candidateId = outreach.candidate_id || '';
  parsed.candidateName = outreach.candidate_name || '';

  let state = parsed;
  let version = 1;
  if (previous) {
    const previousNormalized = parseJson(previous.normalized_json, {});
    const previousState = {
      ...previousNormalized,
      rawResponse: previous.raw_response || previousNormalized.rawResponse || '',
      priceType: previousNormalized.priceType || (previousNormalized.isFromPrice ? 'from' : 'fixed')
    };
    state = engines.merge.merge(previousState, text, engines.parser);
    state.candidateId = outreach.candidate_id || '';
    state.candidateName = outreach.candidate_name || '';
    version = Number(previous.version || 0) + 1;
  }

  const normalized = engines.normalizer.normalize(state, task);
  const legacyComparison = captureLegacyComparison(normalized);
  normalized.priceType = state.priceType || normalized.priceType || (normalized.isFromPrice ? 'from' : 'fixed');

  const resolvedContract = resolveOfferContract(task);
  const contractEvaluation = evaluateOfferContract(resolvedContract, normalized);
  const comparisonDecision = applyOfferComparisonDecision(
    normalized,
    contractEvaluation,
    legacyComparison
  );

  const contractItems = contractEvaluation.clarificationItems || [];
  const clarificationRounds = Number(db.prepare(`SELECT COUNT(*) AS n FROM contractor_clarifications WHERE request_id = ?`).get(requestId)?.n || 0);
  const maxClarificationRounds = Number(resolvedContract.clarificationPolicy?.maxRounds || 3);
  const clarificationLimitReached = contractItems.length > 0 && clarificationRounds >= maxClarificationRounds;
  const finalComparisonStatus = clarificationLimitReached && !comparisonDecision.comparable ? 'expert_review' : comparisonDecision.comparisonStatus;
  const followup = contractItems.length && !clarificationLimitReached
    ? { needed: true, items: contractItems, message: 'Спасибо. Уточните, пожалуйста: ' + contractItems.join('; ') + '.' }
    : { needed: false, items: [], message: 'Спасибо. Предложение достаточно полное для предварительного сравнения.' };

  const replyId = crypto.randomUUID();
  const offerId = crypto.randomUUID();
  const clarificationId = followup.needed ? crypto.randomUUID() : null;
  const now = new Date().toISOString();
  const received = receivedAt || now;
  const replyType = previous ? 'clarification' : 'initial';
  const parentReplyId = previous?.source_reply_id || null;

  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`
      INSERT INTO contractor_replies (
        reply_id, request_id, task_id, candidate_id, parent_reply_id, reply_type,
        channel, raw_text, external_message_id, received_at, created_at, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      replyId, requestId, outreach.task_id || '', outreach.candidate_id || '', parentReplyId,
      replyType, channel || outreach.channel || 'manual', text, externalMessageId,
      received, now, JSON.stringify(metadata || {})
    );

    if (previous) {
      db.prepare(`
        UPDATE contractor_clarifications
        SET status = 'answered', reply_id = ?, answered_at = ?, updated_at = ?
        WHERE clarification_id = (
          SELECT clarification_id FROM contractor_clarifications
          WHERE request_id = ? AND status = 'pending'
          ORDER BY created_at DESC LIMIT 1
        )
      `).run(replyId, received, now, requestId);
    }

    db.prepare(`
      INSERT INTO contractor_offers (
        offer_id, task_id, candidate_id, request_id, source_reply_id, version,
        parser_version, normalizer_version, raw_response, normalized_json,
        gaps_json, risks_json, comparable, comparison_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      offerId, outreach.task_id || '', outreach.candidate_id || '', requestId, replyId, version,
      'offer-parser-v1', 'offer-normalizer-v1+contract-v2', state.rawResponse || text,
      JSON.stringify(normalized), JSON.stringify(normalized.gaps || []), JSON.stringify(normalized.flags || []),
      comparisonDecision.comparable ? 1 : 0,
      finalComparisonStatus,
      now, now
    );

    if (followup.needed) {
      db.prepare(`
        INSERT INTO contractor_clarifications (
          clarification_id, task_id, candidate_id, request_id, offer_id,
          question_text, gaps_json, status, channel, sent_at, reply_id,
          answered_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        clarificationId, outreach.task_id || '', outreach.candidate_id || '', requestId, offerId,
        followup.message, JSON.stringify(followup.items || []), 'pending', channel || outreach.channel || null,
        null, null, null, now, now
      );
    }

    db.prepare(`UPDATE outreach_attempts SET status = 'replied', replied_at = COALESCE(replied_at, ?) WHERE request_id = ?`).run(received, requestId);
    db.exec('COMMIT');
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    throw error;
  }

  return {
    reply: { reply_id: replyId, request_id: requestId, type: replyType, received_at: received },
    offer: { offer_id: offerId, version, normalized },
    clarification: followup.needed ? { clarification_id: clarificationId, question: followup.message, items: followup.items } : null
  };
}

export function getOfferDialogueHistory(db, requestId) {
  const replies=db.prepare(`SELECT reply_id,parent_reply_id,reply_type,raw_text,received_at,created_at FROM contractor_replies WHERE request_id=? ORDER BY created_at ASC`).all(requestId);
  const clarifications=db.prepare(`SELECT clarification_id,offer_id,question_text,gaps_json,status,reply_id,answered_at,created_at FROM contractor_clarifications WHERE request_id=? ORDER BY created_at ASC`).all(requestId);
  const offers=db.prepare(`SELECT offer_id,version,source_reply_id,comparison_status,comparable,normalized_json,gaps_json,created_at FROM contractor_offers WHERE request_id=? ORDER BY version ASC`).all(requestId);
  const versions=offers.map(x=>({...x,comparable:Boolean(x.comparable),normalized:parseJson(x.normalized_json,{}),gaps:parseJson(x.gaps_json,[])}));
  const changes=versions.map((cur,i)=>{const prev=i?versions[i-1]:null;const reply=replies.find(r=>r.reply_id===cur.source_reply_id)||null;const answeredClarification=reply?clarifications.find(c=>c.reply_id===reply.reply_id)||null:null;const pg=new Set(prev?.gaps||[]),cg=new Set(cur.gaps||[]);const before=prev?.normalized||{},after=cur.normalized||{};const keys=[...new Set([...Object.keys(before),...Object.keys(after)])];const field_changes=keys.filter(k=>JSON.stringify(before[k]??null)!==JSON.stringify(after[k]??null)).map(k=>({field:k,before:before[k]??null,after:after[k]??null}));const labels={totalPrice:'Итоговая стоимость',workPrice:'Стоимость работ',materialsPrice:'Стоимость материалов',materialsIncluded:'Материалы включены',worksIncluded:'Состав работ',leadTime:'Срок выполнения',warranty:'Гарантия',measurement:'Замер',contract:'Договор',insulationMaterial:'Утеплитель',insulationThickness:'Толщина утеплителя',layerCount:'Количество слоёв',systemDescription:'Система работ',extraCosts:'Дополнительные расходы',exclusions:'Не входит в стоимость'};const isEmpty=v=>v==null||v===''||(Array.isArray(v)&&v.length===0);const presentation_changes=field_changes.filter(x=>labels[x.field]&&!(isEmpty(x.before)&&isEmpty(x.after))).map(x=>({...x,label:labels[x.field]}));const compactText=v=>{const t=String(v??'').replace(/\s+/g,' ').trim();return t.length>180?t.slice(0,177)+'…':t};const formatValue=(field,v)=>{if(v==null||v==='')return null;if(['totalPrice','workPrice','materialsPrice'].includes(field)&&Number.isFinite(Number(v)))return new Intl.NumberFormat('ru-RU').format(Number(v))+' ₽';if(typeof v==='boolean')return v?'Да':'Нет';if(Array.isArray(v))return compactText(v.join(', '));return compactText(v)};const presentation_events=presentation_changes.map(x=>{const action=isEmpty(x.before)?'added':isEmpty(x.after)?'removed':'updated';const display_value=formatValue(x.field,x.after);const kind=['totalPrice','workPrice','materialsPrice','materialsIncluded'].includes(x.field)?'price':['leadTime','warranty','measurement','contract'].includes(x.field)?'terms':['worksIncluded','exclusions','extraCosts'].includes(x.field)?'scope':'technical';const verb=action==='added'?'уточнил':action==='updated'?'изменил':'убрал';return {field:x.field,label:x.label,kind,action,value:x.after,previous_value:x.before,display_value,message:`Исполнитель ${verb}: ${x.label}${display_value?': '+display_value:''}`};});const n=cur.normalized||{};const facts=[];if(n.insulationMaterial)facts.push(`Утеплитель: ${compactText(n.insulationMaterial)}`);if(n.insulationThickness)facts.push(`Толщина: ${compactText(n.insulationThickness)}`);if(n.layerCount)facts.push(`Слои: ${compactText(n.layerCount)}`);if(Array.isArray(n.worksIncluded)&&n.worksIncluded.length)facts.push(`Работы: ${compactText(n.worksIncluded.join(', '))}`);if(n.junctionSealing===true)facts.push('Герметизация примыканий: входит');if(n.vaporMoistureControl===true)facts.push('Паро-/влагоконтроль: предусмотрен');if(n.thermalBridgeTreatment===true)facts.push('Мостики холода: обработка предусмотрена');const semantic_summary={facts,headline:facts.slice(0,3).join(' · ')||null};const presentation_summary={event_count:presentation_events.length,has_changes:presentation_events.length>0,messages:presentation_events.map(e=>e.message),closed_gaps:[...pg].filter(x=>!cg.has(x)),remaining_gaps:[...cg],semantic_summary};return {version:cur.version,offer_id:cur.offer_id,source_reply_id:cur.source_reply_id||null,parent_reply_id:reply?.parent_reply_id||null,answered_clarification_id:answeredClarification?.clarification_id||null,answered_items:answeredClarification?parseJson(answeredClarification.gaps_json,[]):[],status_before:prev?.comparison_status||null,status_after:cur.comparison_status,gaps_closed:[...pg].filter(x=>!cg.has(x)),gaps_added:[...cg].filter(x=>!pg.has(x)),field_changes,presentation_changes,presentation_events,presentation_summary,became_comparable:!Boolean(prev?.comparable)&&Boolean(cur.comparable)};});
  const latest=versions.at(-1)||null;const pending=clarifications.filter(x=>x.status==='pending');const latestSummary=changes.at(-1)?.presentation_summary||null;const current_state=latest?{offer_id:latest.offer_id,version:latest.version,status:latest.comparison_status,comparable:Boolean(latest.comparable),ready_for_comparison:Boolean(latest.comparable),normalized:latest.normalized,semantic_summary:latestSummary?.semantic_summary||null,remaining_gaps:latest.gaps||[],pending_clarifications:pending.map(x=>({clarification_id:x.clarification_id,items:parseJson(x.gaps_json,[])})),blocking_reason:latest.comparable?null:(latest.comparison_status==='expert_review'?'Требуется экспертная проверка':(latest.gaps||[]).length?'Не хватает данных для сопоставимого предложения':'Предложение пока не готово к сравнению'),next_action:latest.comparable?'compare':latest.comparison_status==='expert_review'?'expert_review':pending.length?'await_clarification':'request_clarification'}:null;return {request_id:requestId,replies,clarifications:clarifications.map(x=>({...x,items:parseJson(x.gaps_json,[])})),offers:versions,changes,current_state};
}

export function listTaskOffers(db, taskId) {
  const rows = db.prepare(`
    SELECT o.* FROM contractor_offers o
    INNER JOIN (
      SELECT request_id, MAX(version) AS version
      FROM contractor_offers WHERE task_id = ? GROUP BY request_id
    ) latest ON latest.request_id = o.request_id AND latest.version = o.version
    WHERE o.task_id = ? ORDER BY o.created_at ASC
  `).all(taskId, taskId);

  return rows.map(row => {
    const pending = db.prepare(`SELECT gaps_json FROM contractor_clarifications WHERE request_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1`).get(row.request_id);
    const pendingItems = parseJson(pending?.gaps_json, []);
    const status = row.comparison_status;
    const nextAction = status === 'comparable' ? 'service_compare' : status === 'expert_review' ? 'service_review' : 'contractor_reply';
    return ({
    offer_id: row.offer_id,
    request_id: row.request_id,
    task_id: row.task_id,
    candidate_id: row.candidate_id,
    version: row.version,
    comparable: Boolean(row.comparable),
    comparison_status: row.comparison_status,
    normalized: parseJson(row.normalized_json, {}),
    gaps: parseJson(row.gaps_json, []),
    risks: parseJson(row.risks_json, []),
    created_at: row.created_at,
    updated_at: row.updated_at,
    dialogue: { status, pending_items: pendingItems, needs_contractor_reply: status === 'needs_data' && pendingItems.length > 0, needs_service_action: status === 'expert_review', next_action: nextAction }
  });
  });
}
