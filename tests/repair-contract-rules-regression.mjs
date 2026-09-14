import fs from 'node:fs';
import vm from 'node:vm';
import { resolveOfferContract } from '../src/offer-contract.mjs';
import { evaluateOfferContract } from '../src/offer-contract-gap-engine.mjs';

const ctx={window:{}};vm.createContext(ctx);
for(const f of ['offer-parser.js','offer-normalizer.js'])vm.runInContext(fs.readFileSync(new URL('../assets/'+f,import.meta.url),'utf8'),ctx);
const P=ctx.window.sdOfferParser,N=ctx.window.sdOfferNormalizer;
function ok(name,v){if(!v)throw new Error('FAIL '+name);console.log('PASS',name)}
function normalize(text,task){const p=P.parse(text);const n=N.normalize(p,task);n.priceType=p.priceType||(n.isFromPrice?'from':'fixed');return n}

const windowTask={categoryId:'window-repair',serviceCode:'WINDOW_REPAIR',goal:'Устранить продувание',scope:'Диагностика и ремонт окна',description:'из створки дует и плохо закрывается'};
const windowFull=normalize('Диагностика бесплатная. Причина: створка просела, прижим слабый. Регулировка фурнитуры 2500 руб. Детали не требуются. Срок 1 день. Гарантия 6 месяцев.',windowTask);
const windowEval=evaluateOfferContract(resolveOfferContract(windowTask),windowFull);
ok('window full ready',windowEval.comparisonReady===true);
ok('window full price',windowEval.comparableTotalPrice===2500);
ok('window materials not required',!windowEval.comparisonBlockingFields.some(x=>x.id==='materialsIncluded'));

const windowWeak=normalize('Регулировка 2500 руб. Срок 1 день.',windowTask);
const windowWeakEval=evaluateOfferContract(resolveOfferContract(windowTask),windowWeak);
ok('window weak blocked',windowWeakEval.comparisonReady===false);
ok('window diagnosis blocker',windowWeakEval.comparisonBlockingFields.some(x=>x.id==='diagnosis'));
ok('window diagnostics blocker',windowWeakEval.comparisonBlockingFields.some(x=>x.id==='diagnosticsIncluded'));
ok('window visit blocker',windowWeakEval.comparisonBlockingFields.some(x=>x.id==='visitCost'));
ok('window parts blocker',windowWeakEval.comparisonBlockingFields.some(x=>x.id==='partsIncluded'));

const leakTask={categoryId:'balcony-leak-repair',serviceCode:'BALCONY_LEAK_REPAIR',goal:'Устранить протечку',scope:'Диагностика причины и устранение',description:'после дождя мокрый потолок на балконе'};
const leakFull=normalize('Итого 18 000 ₽ под ключ. Диагностика 1 500 ₽. Причина: нарушена герметизация верхнего примыкания козырька. Ремонт козырька и герметизация верхнего примыкания, материалы включены. Срок 1 день. Гарантия 1 год.',leakTask);
const leakEval=evaluateOfferContract(resolveOfferContract(leakTask),leakFull);
ok('leak full ready',leakEval.comparisonReady===true);
ok('leak full price',leakEval.comparableTotalPrice===18000);

const leakWeakTask={...leakTask,description:'плесень и конденсат зимой'};
const leakWeak=normalize('Итого 8 000 ₽. Причина: конденсат. Герметизация швов, материалы включены. Срок 1 день. Гарантия 1 год.',leakWeakTask);
const leakWeakEval=evaluateOfferContract(resolveOfferContract(leakWeakTask),leakWeak);
ok('leak weak blocked',leakWeakEval.comparisonReady===false);
ok('leak diagnostics blocker',leakWeakEval.comparisonBlockingFields.some(x=>x.id==='diagnosticsIncluded'));

const leakFrom=normalize('Цена от 6 000 ₽. Герметизация балкона после осмотра.',leakTask);
const leakFromEval=evaluateOfferContract(resolveOfferContract(leakTask),leakFrom);
ok('leak from blocked',leakFromEval.comparisonReady===false&&leakFromEval.comparisonRuleViolations.some(x=>x.id==='from_price'));

console.log('REPAIR CONTRACT RULES REGRESSION: PASS');
