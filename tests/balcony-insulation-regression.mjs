import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

globalThis.window={};
vm.runInThisContext(fs.readFileSync(new URL('../assets/expert-agent.js',import.meta.url),'utf8'));
vm.runInThisContext(fs.readFileSync(new URL('../assets/offer-normalizer.js',import.meta.url),'utf8'));
const agent=window.sdExpertAgent, offers=window.sdOfferNormalizer;
function task(extra={}){return Object.assign({serviceCode:'BALCONY_INSULATION',category:'Утепление балкона / лоджии',city:'Москва',goal:'Сделать теплее',window:'Остекление есть — сохранить',currentState:'Без отделки / бетон',wallSize:'3 × 1 м',description:''},extra)}
function run(name,fn){try{fn();console.log('PASS',name)}catch(e){console.error('FAIL',name,'-',e.message);process.exitCode=1}}
run('T01 winter office glazing check',()=>{const r=agent.run(task({city:'Мытищи',goal:'Кабинет / использование зимой',description:'Хочу утеплить лоджию и сделать кабинет, пользоваться зимой. Остекление есть, менять не хочу.'}));assert.equal(r.qa.status,'PASS_WITH_WARNINGS');assert.ok(r.expert.technicalRisks.some(x=>/остеклен/i.test(x)));assert.ok(!JSON.stringify(r.expert.contractorBrief).match(/толщин.{0,10}утепл|пеноплекс|минват/i))});
run('T02 make warmer',()=>{const r=agent.run(task({goal:'Сделать теплее',wallSize:'3,2 × 1,1 м'}));assert.ok(['PASS','PASS_WITH_WARNINGS'].includes(r.qa.status));assert.ok(!JSON.stringify(r.expert).match(/гарантирован.{0,20}тепл|круглогодичн.{0,20}гарант/i))});
run('T03 condensation mould',()=>{const r=agent.run(task({description:'Зимой мокрые углы и плесень, хочу утеплить чтобы это прошло.'}));assert.notEqual(r.qa.status,'PASS');assert.ok(r.expert.technicalRisks.some(x=>/диагност|осмотр/i.test(x)))});
run('T04 no dimensions',()=>{const r=agent.run(task({goal:'Утепление и отделка под ключ',wallSize:'Уточнить на замере'}));assert.ok(r.expert.requiresSiteInspection.some(x=>/размер|геометр/i.test(x)));assert.notEqual(r.qa.status,'FAIL')});
run('T05 cold glazing year round',()=>{const r=agent.run(task({goal:'Круглогодичное использование',window:'Холодное алюминиевое остекление',description:'Хочу сделать из балкона комнату на весь год.'}));assert.equal(r.qa.status,'PASS_WITH_WARNINGS');assert.ok(r.expert.technicalRisks.some(x=>/холодное остекление/i.test(x)));assert.ok(r.expert.contractorBrief.optionsSeparate.some(x=>/остеклен/i.test(x)))});
run('T06 merge room radiator',()=>{const r=agent.run(task({description:'Объединить лоджию с комнатой, убрать блок и вынести батарею на лоджию.'}));assert.equal(r.qa.status,'EXPERT_REVIEW_REQUIRED');assert.ok(r.qa.expertReviewReasons.length>=1);assert.equal(r.qa.approvedContractorBrief,null)});
run('T07 incomplete cheap offer',()=>{const ranked=offers.rank([{candidateId:'A',candidateName:'A',totalPrice:31000,materialsIncluded:false,worksIncluded:['стены'],leadTime:'2 дня',warranty:'1 год',exclusions:['пол','потолок']},{candidateId:'B',candidateName:'B',totalPrice:37000,materialsIncluded:true,worksIncluded:['стены','пол','потолок'],leadTime:'3 дня',warranty:'2 года'}]);const a=ranked.find(x=>x.candidateId==='A'),b=ranked.find(x=>x.candidateId==='B');assert.equal(a.comparable,false);assert.equal(b.comparable,true);assert.equal(ranked[0].candidateId,'B')});
run('T08 hidden finish',()=>{const r=agent.run(task({currentState:'Есть отделка',description:'Балкон уже обшит, что внутри не знаю, зимой промерзает.'}));assert.equal(r.qa.status,'PASS_WITH_WARNINGS');assert.ok(r.expert.requiresSiteInspection.some(x=>/скрыт/i.test(x)));assert.ok(r.expert.contractorBrief.optionsSeparate.some(x=>/демонтаж/i.test(x)))});
if(process.exitCode)process.exit(process.exitCode);
console.log('BALCONY_INSULATION regression suite passed');