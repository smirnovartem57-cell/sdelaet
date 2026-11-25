import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {extractYandexServicesProfile} from '../src/yandex-services-profile.mjs';

// Load the actual decision functions without starting HTTP, SQLite or providers.
const source = readFileSync(new URL('../src/server.mjs', import.meta.url), 'utf8');
function between(start, end) {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first + 1);
  assert.ok(first >= 0 && last > first, `Missing server block: ${start}`);
  return source.slice(first, last);
}
const discovery = [];
const context = vm.createContext({
  process:{env:{YANDEX_SEARCH_API_KEY:'fixture', YANDEX_FOLDER_ID:'fixture'}},
  yandexSearch:async () => structuredClone(discovery),
  mergeCandidates:items => items,
  buildTrustProfile:() => ({}),
  extractYandexServicesProfile,
  AbortSignal,
});
for (const name of [
  'enrichCompanyCandidates', 'enrichCandidatesWithOfficialDomainEvidence', 'enrichCandidatesWithDomainAge',
  'enrichCandidatesWithYandexReputation',
  'enrichCandidatesWithYandexMapsReviews', 'enrichCandidatesWithDgis',
  'enrichCandidatesWithLegalIdentityDiscovery', 'enrichCandidatesWithFnsProfile',
]) context[name] = async candidates => candidates;
vm.runInContext([
  between('function text(', 'function hostOf('),
  between('function serviceMatchLevel(', 'function parseYandexReputationText('),
  between('async function enrichCandidatesWithYandexServicesReputation(', 'function extractBalancedJsonValue('),
  between('async function performSearch(', 'const COMMERCIAL_TARIFFS'),
].join('\n'), context);

const categoryId = 'balcony-insulation';
const city = 'Мытищи';
const query = 'утепление балконов и лоджий';
const sourceRecord = {id:'source', kind:'web_search', url:'https://example.test/source'};
const coffee = {
  id:'coffee', type:'company', name:'Кофейня', description:'Кофе и выпечка. Работаем в Мытищах.', address:city,
  website:'https://example.test/company', query, sources:[sourceRecord,
    {id:'official-company',kind:'official_site',url:'https://example.test/company'}],
  legalIdentity:{name:'Учебная организация'}, facts:[],
};
const unknown = {
  ...coffee, id:'unknown', address:'Казань', description:'Кофе и выпечка',
  facts:[{status:'unknown', label:'Утепление балконов в Московской области', sourceId:'source'}],
};
const workshop = {
  ...coffee, id:'workshop', name:'Мастерская', description:'Работы под заказ', address:'Казань',
  facts:[{status:'claimed', label:'Утепление балконов и лоджий', sourceId:'source'}],
};
const rank = candidate => context.rankCandidate(candidate, city, query, 'any', categoryId);
const search = (id = categoryId) => context.performSearch({categoryId:id, city, sources:['web'], executorTypes:['company']});
const selectedIds = result => Array.from(result.candidates, candidate => candidate.id);
let lastEnrichment;
context.enrichCompanyCandidates = async (candidates, limit) => {
  lastEnrichment = {pool:candidates.length, limit};
  return candidates.map(candidate => candidate.id === 'recoverable'
    ? {...candidate, facts:workshop.facts}
    : candidate);
};

assert.equal(rank(coffee).categoryRelevance.score, 0);
assert.equal(rank(coffee).selectionBreakdown.regionStatus, 'exact');
discovery.push(coffee, unknown, workshop);
const result = await search();
assert.deepEqual(selectedIds(result), ['workshop']);
assert.equal(result.searchMeta.qualified, 1);
assert.equal(rank(coffee).serviceMatch.status, 'needs_verification');
assert.equal(rank(unknown).categoryRelevance.score, 0);
assert.equal(rank(unknown).selectionBreakdown.regionStatus, 'unknown');
const [selected] = result.candidates;
assert.equal(selected.categoryRelevance.matchedSignals[0].sourceId, 'source');
assert.equal(selected.sources[0].url, sourceRecord.url);
assert.equal(selected.facts[0].status, 'claimed');
assert.ok(selected.facts.some(fact => fact.status === 'unknown'));
assert.equal(selected.selectionBreakdown.regionStatus, 'unknown');
assert.equal(selected.selectionBreakdown.reputationDetails, null);
assert.equal(selected.selectionBreakdown.reputation, 0);

discovery.splice(0, discovery.length, coffee, {...coffee, id:'recoverable'});
assert.deepEqual(selectedIds(await search()), ['recoverable']);
assert.deepEqual(lastEnrichment, {pool:2, limit:2});

discovery.splice(0, discovery.length, coffee);
const weakOnly = await search();
assert.deepEqual(selectedIds(weakOnly), []);
assert.equal(weakOnly.searchMeta.discovered, 1);
assert.equal(weakOnly.searchMeta.qualified, 0);
assert.equal(weakOnly.searchMeta.shortlisted, 0);

// Other categories retain the existing generic qualification and fallback.
const {categories} = JSON.parse(readFileSync(new URL('../config/service-categories.json', import.meta.url), 'utf8'));
const otherCategories = categories.filter(category => category.categoryId !== categoryId);
assert.ok(otherCategories.length > 0);
for (const category of otherCategories) {
  const other = await search(category.categoryId);
  assert.deepEqual(selectedIds(other), ['coffee'], category.categoryId);
  assert.equal(other.searchMeta.qualified, 1, category.categoryId);
  assert.equal(other.candidates[0].serviceMatch.status,
    category.categoryId === 'plumbing-works' ? 'needs_verification' : 'matched', category.categoryId);
}

discovery.splice(0);
const empty = await search();
assert.deepEqual(selectedIds(empty), []);
assert.equal(empty.searchMeta.discovered, 0);
assert.deepEqual(lastEnrichment, {pool:0, limit:0});

discovery.push(...Array.from({length:45}, (_, i) => ({...workshop, id:`workshop-${i}`})));
const bounded = await search();
assert.equal(bounded.searchMeta.rawDiscovered, 45);
assert.equal(bounded.searchMeta.discovered, 40);
assert.equal(bounded.searchMeta.qualified, 20);
assert.deepEqual(lastEnrichment, {pool:20, limit:12});
assert.equal(bounded.candidates.length, 5);

function privateCandidate(id) {
  return {
    id, type:'private', name:'Частный мастер', description:'Работы по договорённости', address:city,
    query, facts:[{status:'unknown', label:'Окончательная цена неизвестна'}],
    sources:[{id:`profile-${id}`, kind:'yandex_services', url:`https://uslugi.yandex.ru/profile/${id}`}],
  };
}
const suitable = privateCandidate('suitable');
const unrelated = privateCandidate('unrelated');
const failed = privateCandidate('failed');
const requestedProfiles = [];
context.fetch = async url => {
  requestedProfiles.push(url);
  if (url === failed.sources[0].url) throw new Error('Fixture network failure');
  const name = url === suitable.sources[0].url ? 'Утепление балконов и лоджий' : 'Сборка мебели';
  return new Response('Паспорт проверен'+JSON.stringify({services:[{attrs:{name, price:100}}]}));
};
assert.equal(rank(suitable).serviceMatch.status, 'needs_verification');
discovery.splice(0, discovery.length, suitable, unrelated, failed);
const privateResult = await context.performSearch({categoryId, city, sources:['yandex_services'], executorTypes:['private']});
assert.deepEqual(requestedProfiles, discovery.map(candidate => candidate.sources[0].url));
assert.deepEqual(selectedIds(privateResult), ['suitable']);
const [recovered] = privateResult.candidates;
assert.equal(recovered.categoryRelevance.matchedSignals[0].sourceId, 'profile-suitable');
assert.equal(recovered.categoryRelevance.matchedSignals[0].evidenceStatus, 'claimed');
assert.ok(recovered.facts.every(fact => fact.status === 'unknown'));
assert.equal(recovered.selectionBreakdown.regionStatus, 'unknown');
assert.equal(recovered.selectionBreakdown.reputationDetails, null);
console.log('Production balcony qualification regression: PASS');
