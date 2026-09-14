import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { resolveOfferContract } from './offer-contract.mjs';
import { evaluateOfferContract } from './offer-contract-gap-engine.mjs';

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

function applyContractDecision(normalized, state, contractEvaluation) {
  const legacyComparable = Boolean(normalized.comparable);
  const legacyComparableTotalPrice = normalized.comparableTotalPrice ?? null;
  normalized.priceType = state.priceType || normalized.priceType || (normalized.isFromPrice ? 'from' : 'fixed');
  normalized.contractEvaluation = contractEvaluation;
  normalized.comparisonDecision = {
    source: 'contract_v2',
    comparable: Boolean(contractEvaluation.comparisonReady),
    comparisonStatus: contractEvaluation.comparisonReady ? 'comparable' : 'needs_data',
    comparableTotalPrice: contractEvaluation.comparableTotalPrice,
    legacyComparable,
    legacyComparableTotalPrice,
    legacyMismatch: legacyComparable !== Boolean(contractEvaluation.comparisonReady)
  };
  normalized.legacyComparable = legacyComparable;
  normalized.legacyComparableTotalPrice = legacyComparableTotalPrice;
  normalized.comparable = Boolean(contractEvaluation.comparisonReady);
  normalized.comparableTotalPrice = contractEvaluation.comparableTotalPrice;
  return normalized;
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
  normalized.priceType = state.priceType || normalized.priceType || (normalized.isFromPrice ? 'from' : 'fixed');
  const resolvedContract = resolveOfferContract(task);
  const contractEvaluation = evaluateOfferContract(resolvedContract, normalized);
  applyContractDecision(normalized, state, contractEvaluation);

  const contractItems = contractEvaluation.clarificationItems || [];
  const followup = contractItems.length
    ? { needed: true, items: contractItems, message: 'Спасибо. Уточните, пожалуйста: ' + contractItems.join('; ') + '.' }
    : { needed: false, items: [], message: 'Спасибо. Предложение достаточно полное для предварительного сравнения.' };

  const replyId = crypto.randomUUID();
  const offerId = crypto.randomUUID();
  const clarificationId = followup.needed ? crypto.randomUUID() : null;
  const now = new Date().toISOString();
  const received = receivedAt || now;
  const replyType = previous ? 'clarification' : 'initial';
  const parentReplyId = previous?.source_reply_id || null;
  const comparisonStatus = normalized.comparable ? 'comparable' : 'needs_data';

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
      normalized.comparable ? 1 : 0, comparisonStatus, now, now
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

export function listTaskOffers(db, taskId) {
  const rows = db.prepare(`
    SELECT o.* FROM contractor_offers o
    INNER JOIN (
      SELECT request_id, MAX(version) AS version
      FROM contractor_offers WHERE task_id = ? GROUP BY request_id
    ) latest ON latest.request_id = o.request_id AND latest.version = o.version
    WHERE o.task_id = ? ORDER BY o.created_at ASC
  `).all(taskId, taskId);

  return rows.map(row => ({
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
    updated_at: row.updated_at
  }));
}
