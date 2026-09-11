import fs from 'node:fs';import vm from 'node:vm';
function load(path,globalName){const sandbox={window:{}};vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path,'utf8'),sandbox);return sandbox.window[globalName]}
const parser=load('assets/offer-parser.js','sdOfferParser');const merge=load('assets/offer-merge.js','sdOfferMerge');const normalizer=load('assets/offer-normalizer.js','sdOfferNormalizer');
function ok(v,m){if(!v)throw new Error(m)}
const task={serviceCode:'BALCONY_INSULATION',goal:'Кабинет / использование зимой'};
let base=parser.parse('37 000 ₽. Материалы включены. Срок 4 дня.');base.candidateName='Тест';
let n1=normalizer.normalize(base,task);ok(n1.comparable===false,'M01 incomplete base offer must not be comparable');
let merged=merge.merge(base,'Гарантия 2 года. Входит утепление пола, потолка, стен и парапета, герметизация примыканий и проверка остекления.',parser);
ok(merged.warranty==='2 года','M02 warranty must be merged');ok(merged.followUps.length===1,'M03 history must be stored');
let n2=normalizer.normalize(merged,task);ok(n2.criticalScopeMissing.length===0,'M04 critical scope must be closed after follow-up');ok(n2.comparable===true,'M05 completed offer must become comparable');
let merged2=merge.merge(merged,'Срок 3 дня.',parser);ok(merged2.leadTime==='3 дня','M06 newer confirmed scalar must override older value');ok(merged2.followUps.length===2,'M07 multiple follow-ups must remain in history');
console.log('offer merge regression: 7/7 PASS');