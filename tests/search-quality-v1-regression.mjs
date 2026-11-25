import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {extractYandexServicesProfile} from '../src/yandex-services-profile.mjs';

// Scenario evidence is transcribed from the archive and live audit (public site service,
// profile area, service and brand/person signals). Names and URL identities are synthetic.
// Catalog, ambiguous and unrelated rows are controls; no saved customer payloads are used.
const scenarios = [
  {id:'balcony-insulation', city:'Мытищи', query:'утепление балконов', service:'Утепление балконов и лоджий', other:'Москва', adjacent:'Королёв'},
  {id:'universal-home-repair', city:'Москва', query:'ремонт квартир', service:'Капитальный ремонт квартир', other:'Балашиха', district:'Центральный административный округ'},
  {id:'universal-home-repair', city:'Москва', query:'установка кондиционеров', service:'Установка кондиционеров', other:'Одинцово'},
  {id:'plumbing-works', city:'Мытищи', query:'сантехнические работы', service:'Сантехнические работы', other:'Люберцы', adjacent:'Пушкино'},
  {id:'universal-home-repair', city:'Москва', query:'сборка мебели', service:'Сборка мебели', other:'Красногорск', district:'Западный административный округ'}
];
const enc = value => Buffer.from(value).toString('base64');
const xml = docs => Response.json({rawData:enc('<yandexsearch><response>' + docs.map(doc =>
  `<doc><url>${doc.url}</url><title>${doc.title}</title><headline>${doc.description || ''}</headline></doc>`
).join('') + '</response></yandexsearch>')});
const profileUrl = id => `https://uslugi.yandex.ru/profile/fixture-${id}`;

function fixtures(scenario) {
  const {city, service, other, district} = scenario;
  return [
    {url:'https://local.example.test/', title:'Сайт исполнителя', description:`${service}. Работаем: ${city}`, good:true},
    {url:'https://unrelated.example.test/', title:'Торговый каталог', description:`Продажа материалов. ${city}`, good:false},
    {url:profileUrl('brand'), title:'ООО Учебный бренд', description:'Профиль организации', area:[city], service, good:true, type:'company'},
    {url:profileUrl('person'), title:'Алексей А.', area:[district || city], service, passport:true, good:true, type:'private'},
    {url:profileUrl('neighbor'), title:'Иван Б.', area:[scenario.adjacent || other], service, passport:true, good:false},
    {url:profileUrl('regional'), title:'Сергей В.', area:['Московская область'], service, passport:true, good:false}
  ];
}

function contextFor(source, fetch) {
  const ctx = vm.createContext({
    process:{env:{YANDEX_SEARCH_API_KEY:'fixture', YANDEX_FOLDER_ID:'fixture'}},
    Buffer, URL, crypto, AbortSignal, fetch, extractYandexServicesProfile,
    mergeCandidates:items => items,
    buildTrustProfile:() => ({})
  });
  for (const name of [
    'enrichCompanyCandidates', 'enrichCandidatesWithOfficialDomainEvidence',
    'enrichCandidatesWithDomainAge', 'enrichCandidatesWithYandexReputation',
    'enrichCandidatesWithYandexMapsReviews', 'enrichCandidatesWithDgis',
    'enrichCandidatesWithLegalIdentityDiscovery', 'enrichCandidatesWithFnsProfile'
  ]) ctx[name] = async candidates => candidates;
  const section = (start, end) => {
    const first = source.indexOf(start);
    const last = source.indexOf(end, first + 1);
    assert.ok(first >= 0 && last > first);
    return source.slice(first, last);
  };
  vm.runInContext([
    section('function text(', 'function parseYandexReputationText('),
    section('async function yandexSearch(', 'function contactsFrom2gis('),
    section('async function enrichCandidatesWithYandexServicesReputation(', 'function extractBalancedJsonValue('),
    section('async function performSearch(', 'const COMMERCIAL_TARIFFS')
  ].join('\n'), ctx);
  return ctx;
}

const source = readFileSync(new URL('../src/server.mjs', import.meta.url), 'utf8');
const [baseFile, prFile] = process.argv.slice(2);
const versions = baseFile && prFile ? {
  production: readFileSync(baseFile, 'utf8'), pr160: readFileSync(prFile, 'utf8'), local: source
} : {local:source};

const totals = {};
for (const [version, code] of Object.entries(versions)) {
  totals[version] = {eligible:0, wrong:0, labeledFallbacks:0, lost:0, correctlyTyped:0, typedTotal:0, scenarios:0};
  for (const scenario of scenarios) {
    const records = fixtures(scenario);
    const fetch = async (url, options) => {
      if (options?.method === 'POST') {
        const query = JSON.parse(options.body).query.queryText;
        if (query.startsWith('site:uslugi')) return xml(records.filter(item => item.area));
        if (query.startsWith('site:avito')) return xml([{url:'https://www.avito.ru/moskva/predlozheniya_uslug', title:'Категория'}]);
        return xml(records.filter(item => !item.area));
      }
      const profile = records.find(item => item.url === url);
      assert.ok(profile?.area, 'Only fixture pages may be read');
      const identity = profile.passport ? 'Паспорт проверен' : '';
      const metadata = JSON.stringify({'@type':'LocalBusiness', areaServed:profile.area});
      return new Response(`<script type="application/ld+json">${metadata}</script>${identity}` +
        JSON.stringify({services:[{attrs:{name:profile.service,price:100}}]}));
    };
    const ctx = contextFor(code, fetch);
    const result = await ctx.performSearch({
      categoryId:scenario.id, city:scenario.city, description:scenario.query, category:scenario.query,
      sources:['web','yandex_services','avito']
    });
    const selected = new Map(result.candidates.map(candidate => [candidate.sources[0].url, candidate]));
    const tally = totals[version];
    if (records.some(item => item.good && selected.has(item.url))) tally.scenarios++;
    for (const item of records) {
      const candidate = selected.get(item.url);
      if (item.good) {
        if (candidate) tally.eligible++;
        else tally.lost++;
      } else if (candidate) {
        const geography = candidate.qualification?.geography.status;
        if (candidate.qualification?.service.status === 'confirmed' &&
            ['region', 'neighbor'].includes(geography) && candidate.matchLevel === 'Требует проверки') {
          tally.labeledFallbacks++;
        } else tally.wrong++;
      }
      if (item.type) {
        tally.typedTotal++;
        if (candidate?.type === item.type) tally.correctlyTyped++;
      }
    }
    if (version === 'local') {
      assert.equal(result.searchMeta.sourceDiagnostics.find(item => item.source === 'avito').outcome, 'no_eligible_links');
      assert.ok(result.candidates.every(item => item.qualification.service.sourceId && item.qualification.geography.sourceId));
    }
  }
}
assert.deepEqual(totals.local, {eligible:15, wrong:0, labeledFallbacks:7, lost:0, correctlyTyped:10, typedTotal:10, scenarios:5});
console.log(JSON.stringify(totals));

// Evidence-only extracts from the reviewed profile cards. Areas and service labels
// are retained. Names, identifiers, prices, reputation and contacts are omitted.
const auditedProfiles = [
  [0, 'Утепление балконов и лоджий', ['Москва','Королёв','Мытищи'], 'confirmed', 'exact'],
  [0, 'Остекление и внутренняя отделка лоджии', ['Москва'], 'unknown', 'neighbor'],
  [1, 'Капитальный ремонт квартиры', ['Центральный административный округ'], 'confirmed', 'exact'],
  [1, 'Капитальный ремонт квартиры', ['Московская область'], 'confirmed', 'region'],
  [2, 'Установка кондиционера', ['Москва','Жуковский'], 'confirmed', 'exact'],
  [2, 'Установка кондиционера', ['Одинцово','Звенигород'], 'confirmed', 'other_locality'],
  [3, 'Монтаж сантехнического оборудования', ['городской округ Мытищи'], 'confirmed', 'exact'],
  [3, 'Монтаж сантехнического оборудования', ['Люберцы'], 'confirmed', 'other_locality'],
  [4, 'Сборка мебели', ['Москва'], 'confirmed', 'exact'],
  [4, 'Сборка мебели', ['Московская область'], 'confirmed', 'region']
];
const evidenceContext = contextFor(source, () => assert.fail('Evidence fixtures must not read the network'));
for (const [index, [scenarioIndex, service, areaServed, serviceStatus, geographyStatus]] of auditedProfiles.entries()) {
  const scenario = scenarios[scenarioIndex];
  const url = profileUrl(`audit-${index}`);
  const record = {
    name:'Профиль исполнителя', type:'unknown', sources:[{id:'profile',kind:'yandex_services',url}],
    yandexServicesProfile:{profileUrl:url, services:[{name:service}], areaServed},
    facts:[{status:'unknown',label:`Выезжает в город ${scenario.city}`,sourceId:'profile'}]
  };
  const ranked = evidenceContext.rankCandidate(record,scenario.city,scenario.query,'any',scenario.id);
  assert.equal(ranked.qualification.service.status,serviceStatus,service);
  assert.equal(ranked.qualification.geography.status,geographyStatus,areaServed.join(', '));
  if (serviceStatus === 'unknown') assert.equal(ranked.serviceMatch.status,'needs_verification');
}

const diagnosticsTest = {
  candidates:() => xml([{url:'https://private.example.test/',title:'Исполнитель'}]),
  empty:() => xml([]),
  no_eligible_links:() => xml([{url:'https://www.avito.ru/moskva/predlozheniya_uslug',title:'Категория'}]),
  provider_error:() => Response.json({rawData:enc('<yandexsearch><response><error code="99">Failure</error></response></yandexsearch>')}),
  access_restricted:() => new Response('Forbidden',{status:403}),
  rate_limit:() => new Response('Limit',{status:429}),
  captcha:() => new Response('<title>Smart CAPTCHA</title>')
};
for (const [outcome, fetch] of Object.entries(diagnosticsTest)) {
  const observation = {};
  await contextFor(source,fetch).yandexSearch('fixture',outcome === 'no_eligible_links' ? 'avito' : 'company',0,observation);
  assert.equal(observation.outcome,outcome);
}

const offline = contextFor(source, async () => { throw new Error('Offline fixture'); });
const failure = await offline.performSearch({categoryId:'plumbing-works', city:'Мытищи', sources:['web']});
assert.equal(failure.searchMeta.sourceDiagnostics[0].outcome,'transport_error');
const fallback = contextFor(source, async () => xml([{url:'https://unknown.example.test/',title:'Сантехник'}]));
const unverified = await fallback.performSearch({categoryId:'plumbing-works', city:'Мытищи', sources:['web']});
assert.equal(unverified.candidates[0].qualification.geography.status,'unknown');
assert.equal(unverified.searchMeta.sourceDiagnostics[0].qualification,'needs_verification');
assert.equal(unverified.candidates[0].executorTypeEvidence.status,'unknown');

const isolated = contextFor(source, async (url, options) => {
  const query = JSON.parse(options.body).query.queryText;
  if (query.startsWith('site:uslugi')) return new Response('Unavailable',{status:429});
  if (query.startsWith('site:avito')) return xml([{url:'https://www.avito.ru/moskva/predlozheniya_uslug/test_123',title:'Карточка без специализации'}]);
  return xml([{url:'https://local.example.test/',title:'Сантехнические работы в Мытищах'}]);
});
const isolatedResult = await isolated.performSearch({categoryId:'plumbing-works',city:'Мытищи'});
assert.equal(isolatedResult.candidates.length,1);
assert.equal(isolatedResult.searchMeta.sourceDiagnostics.find(item => item.source === 'avito').qualification,'rejected_after_qualification');
assert.equal(isolatedResult.searchMeta.sourceDiagnostics.find(item => item.source === 'yandex_services').outcome,'rate_limit');

const acceptanceContext = contextFor(source, async () => xml([
  {url:'https://fixture.example.test/',title:'Локальный исполнитель',description:'Работаем в городе Казань'}
]));
const {categories} = JSON.parse(readFileSync(new URL('../config/service-categories.json', import.meta.url), 'utf8'));
const otherCategories = categories.filter(category => !['balcony-insulation','plumbing-works'].includes(category.categoryId));
assert.ok(otherCategories.length >= 66);
for (const [categoryId, category] of otherCategories.map(item => [item.categoryId,item.title])) {
  const result = await acceptanceContext.performSearch({categoryId,category,city:'Казань',sources:['web']});
  assert.equal(result.candidates.length,1,categoryId);
  assert.equal(result.candidates[0].qualification,undefined,categoryId);
  assert.equal(result.candidates[0].type,'company',categoryId);
}
const unknownService = await acceptanceContext.performSearch({
  categoryId:'universal-home-repair',description:'Восстановление антикварной музыкальной шкатулки',city:'Казань',sources:['web']
});
assert.equal(unknownService.candidates.length,1);
assert.equal(unknownService.candidates[0].qualification,undefined);

function geographyFixture(area, city) {
  const url = profileUrl('compatibility');
  return acceptanceContext.rankCandidate({
    name:'Профиль исполнителя', type:'private', sources:[{id:'profile',kind:'yandex_services',url}],
    yandexServicesProfile:{profileUrl:url,services:[{name:'Монтаж смесителя'}],areaServed:area}
  },city,'сантехнические работы','any','plumbing-works');
}
assert.equal(geographyFixture(['Казань'],'Казань').qualification.geography.status,'exact');
for (const [area, city, status] of [
  [['Химки'],'Москва','neighbor'],
  [['Ивантеевка'],'Мытищи','other_locality'],
  [['Зеленодольск'],'Казань','other_locality'],
  [[], 'Казань','unknown']
]) {
  const item = geographyFixture(area,city);
  assert.equal(item.qualification.geography.status,status);
  assert.equal(item.matchLevel,'Требует проверки');
  assert.equal(item.serviceMatch.status,'matched');
}

async function shortlistWithEvidence(localClaim) {
  const ctx = contextFor(source, async () => xml([
    {url:'https://first.example.test/',title:localClaim ? 'Сантехнические работы, Казань' : 'Сантехнические работы',description:'Монтаж смесителя'},
    {url:'https://second.example.test/',title:'Сантехнические работы',description:'Установка унитаза'}
  ]));
  return ctx.performSearch({categoryId:'plumbing-works',city:'Казань',sources:['web'],limit:5});
}
const oneConfirmed = await shortlistWithEvidence(true);
assert.equal(oneConfirmed.candidates.length,1);
assert.equal(oneConfirmed.candidates[0].qualification.geography.status,'exact');
const noneConfirmed = await shortlistWithEvidence(false);
assert.equal(noneConfirmed.candidates.length,2);
assert.ok(noneConfirmed.candidates.every(item =>
  item.qualification.geography.status === 'unknown' && item.matchLevel === 'Требует проверки'
));

const regionalOptions = [
  {url:profileUrl('nearby'),title:'Иван Б.',area:'Королёв'},
  {url:profileUrl('unlisted'),title:'Иван В.',area:'Ивантеевка'}
];
const regionContext = contextFor(source,async (url,options) => {
  if (options?.method === 'POST') return xml(regionalOptions);
  const option = regionalOptions.find(item => item.url === url);
  assert.ok(option);
  return new Response(`<script type="application/ld+json">${JSON.stringify({
    '@type':'LocalBusiness',areaServed:[option.area]
  })}</script>Паспорт проверен` + JSON.stringify({services:[{attrs:{name:'Монтаж смесителя',price:100}}]}));
});
const regionFallback = await regionContext.performSearch({
  categoryId:'plumbing-works',city:'Мытищи',sources:['yandex_services'],executorTypes:['private']
});
assert.deepEqual(Array.from(regionFallback.candidates,item => item.qualification.geography.status),['neighbor']);
assert.ok(regionFallback.candidates.every(item => item.matchLevel === 'Требует проверки'));
const wrongOnlyContext = contextFor(source, async (url,options) => {
  if (options?.method === 'POST') return xml([regionalOptions[1]]);
  return new Response('<script type="application/ld+json">'+
    JSON.stringify({'@type':'LocalBusiness',areaServed:['Ивантеевка']})+
    '</script>'+JSON.stringify({services:[{attrs:{name:'Монтаж смесителя',price:100}}]}));
});
const wrongOnly = await wrongOnlyContext.performSearch({
  categoryId:'plumbing-works',city:'Мытищи',sources:['yandex_services']
});
assert.equal(wrongOnly.candidates.length,0);
assert.equal(wrongOnly.searchMeta.sourceDiagnostics.find(x=>x.stage==='search')?.qualification ||
  wrongOnly.searchMeta.sourceDiagnostics.find(x=>x.qualification)?.qualification,'rejected_after_qualification');

const crossCategory = evidenceContext.rankCandidate({
  name:'Кровельная бригада',type:'company',sources:[{id:'site',kind:'web_search',url:'https://example.test'}],
  facts:[{status:'unknown',label:'Работает в Московской области',sourceId:'site'}]
},'Мытищи','ремонт кровли','any','roof-repair');
assert.equal(crossCategory.categoryRelevance.level,'generic');
assert.equal(crossCategory.qualification,undefined);
assert.ok(crossCategory.selectionBreakdown.region>2,'Legacy generic geographic signal remains eligible');
console.log(`Compatibility: ${otherCategories.length}/${otherCategories.length} other catalog categories; unknown service, geography and shortlist fallback PASS`);

const reviewProfile = {url:profileUrl('review-person'),title:'Алексей А.'};
const reviewContext = contextFor(source, async (url, options) => {
  if (options?.method === 'POST') {
    const {queryText} = JSON.parse(options.body).query;
    return xml(queryText.startsWith('site:uslugi') ? [reviewProfile] : [
      {url:'https://installation.example.test/',title:'Установка кондиционеров, Москва'}
    ]);
  }
  assert.equal(url,reviewProfile.url);
  const metadata = JSON.stringify({
    '@type':'LocalBusiness',areaServed:['Москва'],
    description:'Ранее работал в ООО Ремонт, сейчас частный мастер'
  });
  const services = JSON.stringify({
    services:[{attrs:{name:'Монтаж',description:'Установка кондиционеров',price:100}}]
  });
  return new Response(`<script type="application/ld+json">${metadata}</script>Паспорт проверен${services}`);
});
const reviewSearch = {
  categoryId:'universal-home-repair',description:'установка кондиционеров',city:'Москва',
  sources:['web','yandex_services']
};
const privateReview = await reviewContext.performSearch({...reviewSearch,executorTypes:['private']});
assert.equal(privateReview.candidates.length,1,'An incidental organization must not remove a private executor');
assert.equal(privateReview.candidates[0].type,'private');
assert.equal(privateReview.candidates[0].qualification.service.status,'confirmed');
const mixedReview = await reviewContext.performSearch(reviewSearch);
assert.ok(mixedReview.candidates.some(item => item.sources[0].url === reviewProfile.url),
  'Explicit service descriptions qualify profiles alongside confirmed websites');
const ambiguous = contextFor(source, async () => xml([
  {url:'https://brand-without-identity.example.test/',title:'Сантехнические работы в Мытищах'}
]));
const filterBody = {categoryId:'plumbing-works',city:'Мытищи',sources:['web']};
assert.equal((await ambiguous.performSearch({...filterBody,executorTypes:['company']})).candidates.length,0);
assert.equal((await ambiguous.performSearch(filterBody)).candidates[0].type,'unverified');

const excludedWebsite = contextFor(source, async () => xml([
  {url:'https://limited.example.test/',title:'Сантехнические работы',description:'Выезжаем только в городе Казани'}
]));
assert.equal((await excludedWebsite.performSearch(filterBody)).candidates.length,0);
const weekendWebsite = contextFor(source, async () => xml([
  {url:'https://weekend.example.test/',title:'Сантехнические работы',description:'Работаем только в выходные'}
]));
assert.equal((await weekendWebsite.performSearch(filterBody)).candidates[0].qualification.geography.status,'unknown');

const profiles = Array.from({length:21},(_,index)=>({
  url:profileUrl('budget-'+index),title:'Алексей А.',eligible:index===5
}));
let profileReads=0;
const budget = contextFor(source, async (url,options) => {
  if(options?.method==='POST'){
    const query=JSON.parse(options.body).query.queryText;
    return xml(query.startsWith('site:uslugi')?profiles:[
      {url:'https://local-plumber.example.test/',title:'Сантехнические работы в Мытищах'}
    ]);
  }
  profileReads++;
  const entry=profiles.find(profile=>profile.url===url);
  return new Response('<script type="application/ld+json">'+
    JSON.stringify({'@type':'LocalBusiness',areaServed:['Мытищи']})+
    '</script>Паспорт проверен'+JSON.stringify({services:[{attrs:{
      name:entry.eligible?'Монтаж смесителя':'Сборка мебели',price:100
    }}]}));
});
const lateEligible=await budget.performSearch({
  categoryId:'plumbing-works',city:'Мытищи',sources:['yandex_services'],executorTypes:['private']
});
assert.equal(profileReads,12);
assert.ok(lateEligible.candidates.some(candidate=>candidate.sources[0].url===profiles[5].url));
profileReads=0;
const mixedBudget=await budget.performSearch({...filterBody,sources:['web','yandex_services']});
assert.equal(profileReads,12);
assert.ok(mixedBudget.candidates.some(candidate=>candidate.sources[0].url==='https://local-plumber.example.test/'));
const mergedIdentity = evidenceContext.classifySearchExecutor({
  name:'Алексей А.',type:'private',sources:[
    {id:'first',kind:'yandex_services',url:profileUrl('first')},
    {id:'verified',kind:'yandex_services',url:profileUrl('second')}
  ],
  yandexServicesProfile:{profileUrl:profileUrl('second'),passportVerified:true}
});
assert.equal(mergedIdentity.type,'private');
assert.equal(mergedIdentity.executorTypeEvidence.sourceId,'verified');
const officeOnly = evidenceContext.rankCandidate({
  id:'office',type:'company',name:'Сантехнические работы',address:'Мытищи',
  sources:[{id:'office-site',kind:'official_site',url:'https://office.example.test'}],
  facts:[{label:'Адрес офиса: Мытищи',status:'confirmed',sourceId:'office-site'}]
},'Мытищи','сантехнические работы','any','plumbing-works');
assert.equal(officeOnly.qualification.geography.status,'unknown');
const legacyReads=[];
const legacyProfileContext=contextFor(source,async url=>{
  legacyReads.push(url);
  return new Response(JSON.stringify({services:[{attrs:{name:'Монтаж',price:100}}]}));
});
await legacyProfileContext.enrichCandidatesWithYandexServicesReputation(
  [
    ...Array.from({length:5},(_,index)=>({type:'company',sources:[
      {id:'company'+index,kind:'yandex_services',url:profileUrl('company'+index)}
    ]})),
    {type:'private',sources:[{id:'person',kind:'yandex_services',url:profileUrl('legacy-private')}]}
  ],
  5
);
assert.deepEqual(legacyReads,[profileUrl('legacy-private')]);
const negativeClaims = contextFor(source, async () => xml([
  {url:'https://no-service.example.test/',title:'Сантехнические работы, Мытищи',description:'Сантехнические работы не выполняем'},
  {url:'https://no-coverage.example.test/',title:'Сантехнические работы',description:'Не работаем в Мытищах'},
  {url:'https://comma-no-service.example.test/',title:'Сантехнические работы, Мытищи',description:'Сантехнические работы, не выполняем'},
  {url:'https://comma-no-coverage.example.test/',title:'Сантехнические работы',description:'Мытищи, не работаем'},
  {url:'https://limited-positive.example.test/',title:'Сантехнические работы в Мытищах',
    description:'Выполняем монтаж смесителя, остекление не выполняем. Работаем в Мытищах, не работаем в Москве.'}
]));
const negativeResult=await negativeClaims.performSearch(filterBody);
assert.deepEqual(Array.from(negativeResult.candidates,candidate=>candidate.sources[0].url),
  ['https://limited-positive.example.test/']);
for (const [city, inflected, otherCity] of [
  ['Казань','Казани','Твери'],
  ['Самара','Самаре','Сызрани'],
  ['Новосибирск','Новосибирске','Искитиме'],
  ['Санкт-Петербург','Санкт-Петербурге','Гатчине'],
  ['Нижний Новгород','Нижнем Новгороде','Великом Новгороде'],
  ['Великий Новгород','Великом Новгороде','Нижнем Новгороде'],
  ['Набережные Челны','Набережных Челнах','Нижнекамске']
]) {
  const qualification = description => evidenceContext.rankCandidate({
    type:'company',name:`Сантехнические работы, ${city}`,description,
    sources:[{id:'site',kind:'web_search',url:'https://example.test'}]
  },city,'сантехнические работы','any','plumbing-works').qualification.geography.status;
  assert.equal(qualification(`Не работаем в ${inflected}`),'other_locality',city);
  assert.equal(qualification(`Не работаем в ${otherCity}`),'exact',city);
  assert.equal(qualification(`Работаем в ${inflected} и не работаем в ${otherCity}`),'exact',city);
  assert.equal(qualification(`Не работаем в ${otherCity} а работаем в ${inflected}`),'exact',city);
  assert.equal(qualification(`Не работаем в ${otherCity} и ${inflected}`),'other_locality',city);
}
console.log('Search Quality v1 regression: PASS');
