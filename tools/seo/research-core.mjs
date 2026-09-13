const uniq = values => [...new Set((values || []).map(x => String(x || '').trim()).filter(Boolean))];
const RU_STOP = new Set(['и','в','во','на','для','по','с','со','к','из','от','до','а','или','как','что','ли','при','под','над','про','это']);

export function normalizeQuery(value) {
  return String(value || '').toLowerCase().replace(/[«»"'`]/g,'').replace(/[^a-zа-яё0-9\s-]/gi,' ').replace(/\s+/g,' ').trim();
}

export function tokens(value) {
  return normalizeQuery(value).split(' ').filter(x => x.length > 2 && !RU_STOP.has(x));
}

export function inferIntent(query) {
  const q = normalizeQuery(query);
  if (/^(как|почему|зачем|что|какой|какая|какие|можно ли|нужно ли)|ошиб|проблем|инструк|своими руками/.test(q)) return 'informational';
  if (/цена|стоимость|заказать|мастер|исполнитель|под ключ|услуга|монтаж|ремонт|установка/.test(q)) return 'commercial';
  return 'mixed';
}

export function inferTopic(query) {
  const q = normalizeQuery(query);
  if (/цен|стоим|смет|доплат|сколько/.test(q)) return 'cost';
  if (/ошиб|почему|проблем|риск|плес|теч|конденсат|не работает/.test(q)) return 'problems';
  if (/сравн|выбрать|исполнител|подрядчик/.test(q)) return 'comparison';
  if (/что входит|состав|этап|работ/.test(q)) return 'scope';
  if (/материал|технолог|чем |какой |какая |какие /.test(q)) return 'materials';
  if (/как |своими руками|инструк|правильно/.test(q)) return 'how_to';
  return 'other';
}

function jaccard(a, b) {
  const A = new Set(tokens(a)), B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  const intersection = [...A].filter(x => B.has(x)).length;
  const union = new Set([...A, ...B]).size;
  return union ? intersection / union : 0;
}
export function buildResearch(entry, allCategories, evidence = {}) {
  const seo = entry.seo || {};
  const evidenceQueries = (evidence.queries || []).map(x => typeof x === 'string' ? {query:x} : x);
  const seeds = uniq([...(seo.informationalQueries || []), ...(seo.primaryQueries || []), ...evidenceQueries.map(x => x.query)]);
  const enriched = seeds.map(query => {
    const e = evidenceQueries.find(x => normalizeQuery(x.query) === normalizeQuery(query)) || {};
    return {query, intent:e.intent || inferIntent(query), topic:e.topic || inferTopic(query), demand:e.demand || 'unknown', sourceRefs:e.sourceRefs || []};
  });
  const clusters = {};
  for (const row of enriched) (clusters[row.topic] ||= []).push(row.query);

  const siblings = (allCategories || []).filter(x => x.categoryId !== entry.categoryId && x.seo);
  const cannibalization = [];
  for (const row of enriched) {
    let best = null;
    for (const other of siblings) {
      const queries = [...(other.seo.primaryQueries || []), ...(other.seo.informationalQueries || [])];
      for (const oq of queries) {
        const score = jaccard(row.query, oq);
        if (score >= 0.55 && (!best || score > best.score)) best = {query:row.query, otherCategoryId:other.categoryId, otherQuery:oq, score:Number(score.toFixed(2))};
      }
    }
    if (best) cannibalization.push(best);
  }

  const sources = evidence.sources || [];
  const externalSources = sources.filter(x => ['yandex_wordstat','yandex_suggest','yandex_serp','google_serp','search_console','manual_serp'].includes(x.type));
  const informational = enriched.filter(x => x.intent === 'informational' || x.intent === 'mixed');
  const questions = uniq([...(evidence.questions || []), ...informational.map(x => x.query).filter(x => /^(как|почему|что|какой|какая|какие|можно ли|нужно ли)/i.test(x))]);
  const enoughEvidence = externalSources.length >= 1 && evidenceQueries.length >= 5 && informational.length >= 4;
  const status = !enoughEvidence ? 'EVIDENCE_REQUIRED' : cannibalization.length ? 'REVIEW_REQUIRED' : 'READY_FOR_REVIEW';

  return {
    status,
    collectedAt:evidence.collectedAt || '',
    sources,
    queryCount:enriched.length,
    evidenceQueryCount:evidenceQueries.length,
    clusters:Object.entries(clusters).map(([id,queries]) => ({id,queries:uniq(queries)})),
    questions:questions.slice(0,20),
    aiAnswerTargets:questions.slice(0,8),
    cannibalization,
    recommendations:[
      ...(externalSources.length ? [] : ['Добавить внешний источник поисковых данных: Wordstat/Suggest/SERP/Search Console.']),
      ...(evidenceQueries.length >= 5 ? [] : ['Добавить минимум 5 подтверждённых поисковых запросов из внешних источников.']),
      ...(informational.length >= 4 ? [] : ['Закрыть минимум 4 информационных интента.']),
      ...(cannibalization.length ? ['Проверить найденные пересечения интентов с соседними страницами.'] : [])
    ],
    researched:Boolean(enoughEvidence),
    reviewedAt:'',
    researchVersion:1
  };
}
