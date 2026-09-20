import fs from 'node:fs';
const html=fs.readFileSync('candidates.html','utf8');
const js=fs.readFileSync('assets/live-search.js','utf8');
function ok(v,m){if(!v)throw new Error(m)}
ok(html.includes('assets/live-search.js?v=public-v3-20260920'),'candidates must bust live-search cache');
ok(html.includes('.fact-panels'),'structured fact panel styles must exist');
ok(html.includes('.reviews-modal'),'reviews popup styles must exist');
ok(js.includes("document.getElementById('countTitle').textContent = 'Уточняем исполнителей'"),'paid search wording must say clarify contractors');
ok(js.includes("Проверка исполнителей завершена"),'finished state wording must be verification, not search');
ok(js.includes('function uniqueSourceGroups(candidate)'),'sources must be grouped and deduplicated');
ok(js.includes('function canonicalSourceUrl(url)'),'source URLs must strip tracking params for dedupe');
ok(js.includes("'Условия и цены'"),'commercial facts must have a dedicated block');
ok(js.includes("'Проверка компании'"),'verification facts must have a dedicated block');
ok(js.includes("'Что уточнить'"),'unknown facts must have a dedicated block');
ok(js.includes('function openReviewsModal(candidateId)'),'reviews popup must be restored');
ok(js.includes('Положительные отзывы'),'positive reviews section must exist');
ok(js.includes('Критические отзывы'),'critical reviews section must exist');
ok(!js.includes('<h3>Факты и происхождение</h3>'),'old fact wall must not render');
console.log('CANDIDATES STRUCTURED UI REGRESSION: PASS');