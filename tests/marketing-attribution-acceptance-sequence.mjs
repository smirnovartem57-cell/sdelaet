import assert from 'node:assert/strict';

const INTENTS=new Set(['contractor_choose','contractor_check','contractor_compare','estimate_compare','contract_risk','repair_cost','repair_start']);
function visit(url,referrer='',ts='2026-09-29T07:00:00.000Z'){
 const u=new URL(url),p=u.searchParams;let source=(p.get('utm_source')||'').trim(),medium=(p.get('utm_medium')||'').trim();
 if(!source&&referrer){const h=new URL(referrer).hostname.toLowerCase();if(/(^|\\.)t\\.me$|(^|\\.)telegram\\.me$/.test(h)){source='telegram';medium='referral'}else if(/yandex|google|bing|mail\\.ru/.test(h)){source=h;medium='organic'}else if(h&&h!==u.hostname){source=h;medium='referral'}}
 const content=(p.get('utm_content')||'').trim(),intent=INTENTS.has(p.get('intent_cluster')||content)?(p.get('intent_cluster')||content):'';
 return{source,medium,campaign:p.get('utm_campaign')||'',content,term:p.get('utm_term')||'',yclid:p.get('yclid')||'',intent_cluster:intent,landing_page:u.pathname+u.search,referrer,timestamp:ts,meaningful:!!(source||p.get('yclid')||(medium&&medium!=='direct'))};
}
function apply(state,v){const out=structuredClone(state);if(v.meaningful){if(!out.first)out.first=v;out.last=v}return out}
function snapshot(state,clientId){return structuredClone({ym_client_id:clientId,first_touch:state.first,last_touch:state.last,intent_cluster:state.last?.intent_cluster||state.first?.intent_cluster||''})}

let s={first:null,last:null};
const y=visit('https://onsdelaet.ru/?utm_source=yandex&utm_medium=cpc&utm_campaign=sdelaet_attribution_test&utm_content=estimate_compare&utm_term=test_compare_estimates&yclid=test-yclid');
s=apply(s,y);
assert.equal(s.first.source,'yandex');assert.equal(s.last.source,'yandex');assert.equal(s.last.intent_cluster,'estimate_compare');
const client='12345';
const task1=snapshot(s,client);

const direct=visit('https://onsdelaet.ru/create-task.html');
s=apply(s,direct);
assert.equal(s.first.source,'yandex');assert.equal(s.last.source,'yandex');

const tg=visit('https://onsdelaet.ru/?utm_source=telegram&utm_medium=social&utm_campaign=sdelaet_tg_test&utm_content=contractor_compare');
s=apply(s,tg);
assert.equal(s.first.source,'yandex');assert.equal(s.last.source,'telegram');
const task2=snapshot(s,client);
assert.equal(task2.ym_client_id,task1.ym_client_id);assert.equal(task2.last_touch.source,'telegram');assert.equal(task1.last_touch.source,'yandex');assert.equal(task1.intent_cluster,'estimate_compare');
console.log('ATTRIBUTION ACCEPTANCE SEQUENCE PASS');
