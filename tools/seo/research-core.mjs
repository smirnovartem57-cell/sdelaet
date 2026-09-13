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
  if (/^(как|чем|почему|зачем|что|какой|какая|какие|можно ли|нужно ли)|ошиб|проблем|инструк|своими руками/.test(q)) return 'informational';
  if (/цена|стоимость|сколько стоит|заказать|мастер|исполнитель|под ключ|услуга|монтаж|ремонт|установка/.test(q)) return 'commercial';
  return 'mixed';
}

export function inferTopic(query) {
  const q = normalizeQuery(query);
  if (/цен|стоим|смет|доплат|сколько/.test(q)) return 'cost';
  if (/ошиб|почему|проблем|риск|плес|теч|конденсат|промерз|дует|холод|не работает/.test(q)) return 'problems';
  if (/сравн|выбрать|исполнител|подрядчик/.test(q)) return 'comparison';
  if (/что входит|состав|этап|работ/.test(q)) return 'scope';
  if (/материал|технолог|утеплител|пеноплекс|минват|пароизоляц|чем |какой |какая |какие /.test(q)) return 'materials';
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
    const demand = Number.isFinite(Number(e.demand)) ? Number(e.demand) : 'unknown';
    return {query, intent:e.intent || inferIntent(query), topic:e.topic || inferTopic(query), demand, sourceRefs:e.sourceRefs || []};
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

  const reviewDecisions = evidence.cannibalizationReviews || [];
  const reviewedCannibalization = cannibalization.map(item => {
    const review = reviewDecisions.find(x =>
      normalizeQuery(x.query) === normalizeQuery(item.query) &&
      x.otherCategoryId === item.otherCategoryId
    ) || null;
    return review ? {...item, review} : item;
  });
  const unresolvedCannibalization = reviewedCannibalization.filter(item => !item.review);

  const sources = evidence.sources || [];
  const externalSources = sources.filter(x => ['yandex_wordstat','yandex_suggest','yandex_serp','google_serp','search_console','manual_serp'].includes(x.type));
  const byDemand = rows => [...rows].sort((a,b) => (typeof b.demand === 'number' ? b.demand : -1) - (typeof a.demand === 'number' ? a.demand : -1));
  const rankedQueries = byDemand(enriched);
  const informational = enriched.filter(x => x.intent === 'informational' || x.intent === 'mixed');
  const informationalOpportunities = byDemand(informational);
  const questionLike = informationalOpportunities.filter(x => /^(как|чем|почему|что|какой|какая|какие|можно ли|нужно ли)/i.test(x.query));
  const questions = uniq([...(evidence.questions || []), ...questionLike.map(x => x.query)]);
  const enoughEvidence = externalSources.length >= 1 && evidenceQueries.length >= 5 && informational.length >= 4;
  const status = !enoughEvidence ? 'EVIDENCE_REQUIRED' : unresolvedCannibalization.length ? 'REVIEW_REQUIRED' : 'READY_FOR_REVIEW';

  return {
    status,
    collectedAt:evidence.collectedAt || '',
    sources,
    queryCount:enriched.length,
    evidenceQueryCount:evidenceQueries.length,
    clusters:Object.entries(clusters).map(([id,queries]) => ({id,queries:uniq(queries)})),
    rankedQueries:rankedQueries.slice(0,30),
    informationalOpportunities:informationalOpportunities.slice(0,20),
    questions:questions.slice(0,20),
    aiAnswerTargets:questionLike.slice(0,8).map(x => x.query),
    cannibalization:reviewedCannibalization,
    unresolvedCannibalization,
    cannibalizationReviews:reviewDecisions,
    recommendations:[
      ...(externalSources.length ? [] : ['Добавить внешний источник поисковых данных: Wordstat/Suggest/SERP/Search Console.']),
      ...(evidenceQueries.length >= 5 ? [] : ['Добавить минимум 5 подтверждённых поисковых запросов из внешних источников.']),
      ...(informational.length >= 4 ? [] : ['Закрыть минимум 4 информационных интента.']),
      ...(unresolvedCannibalization.length ? ['Проверить найденные пересечения интентов с соседними страницами.'] : [])
    ],
    researched:Boolean(enoughEvidence),
    reviewedAt:evidence.reviewedAt || '',
    researchVersion:2
  };
}
