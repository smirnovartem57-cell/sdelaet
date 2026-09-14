import fs from 'node:fs';
import vm from 'node:vm';
import { resolveOfferContract } from '../src/offer-contract.mjs';
import { evaluateOfferContract } from '../src/offer-contract-gap-engine.mjs';

const ctx={window:{}};vm.createContext(ctx);
for(const f of ['offer-parser.js','offer-normalizer.js'])vm.runInContext(fs.readFileSync(new URL('../assets/'+f,import.meta.url),'utf8'),ctx);
const P=ctx.window.sdOfferParser,N=ctx.window.sdOfferNormalizer;
function ok(name,v){if(!v)throw new Error('FAIL '+name);console.log('PASS',name)}
function normalize(text,task){const parsed=P.parse(text);const n=N.normalize(parsed,task);n.priceType=parsed.priceType||n.priceType||(n.isFromPrice?'from':'fixed');return n}

const screedTask={categoryId:'floor-screed',serviceCode:'FLOOR_SCREED',goal:'Стяжка / выравнивание пола',scope:'60 м²',screedType:'semi_dry',oldScreed:'no'};
const screedFull=normalize('Итого 78000 ₽. 60 м². Полусухая стяжка. Толщина слоя 60 мм. Прочность М200. Грунтовка основания, армирование и демпферная лента входят. Материалы включены. Срок 2 дня. Гарантия 2 года.',screedTask);
const screedEval=evaluateOfferContract(resolveOfferContract(screedTask),screedFull);
ok('screed full ready',screedEval.comparisonReady===true);
ok('screed price',screedEval.comparableTotalPrice===78000);

const screedWeak=normalize('Итого 60000 ₽. Полусухая стяжка. Материалы включены. Срок 2 дня. Гарантия 1 год.',screedTask);
const screedWeakEval=evaluateOfferContract(resolveOfferContract(screedTask),screedWeak);
ok('screed weak blocked',screedWeakEval.comparisonReady===false);
ok('screed thickness blocker',screedWeakEval.comparisonBlockingFields.some(x=>x.id==='layerThickness'));
ok('screed strength blocker',screedWeakEval.comparisonBlockingFields.some(x=>x.id==='strengthSpec'));
ok('screed edge blocker',screedWeakEval.comparisonBlockingFields.some(x=>x.id==='edgeTapeIncluded'));

const screedOld={...screedTask,oldScreed:'yes',scope:'есть старая стяжка'};
const screedOldEval=evaluateOfferContract(resolveOfferContract(screedOld),normalize('Итого 78000 ₽. Полусухая стяжка. Толщина 60 мм. Прочность М200. Грунтовка основания и демпферная лента входят. Материалы включены. Срок 2 дня. Гарантия 2 года.',screedOld));
ok('screed old layer blocked',screedOldEval.comparisonBlockingFields.some(x=>x.id==='baseDemolitionIncluded'));

const plasterTask={categoryId:'wall-plastering',serviceCode:'WALL_PLASTERING',goal:'Штукатурка / выравнивание стен',scope:'80 м² под обои',oldLayer:'no'};
const plasterFull=normalize('Итого 92000 ₽. 80 м². Гипсовая штукатурка. Толщина слоя 20 мм. Грунтовка основания и маяки входят. Армирующая сетка локально. Материалы включены. Срок 5 дней. Гарантия 2 года.',plasterTask);
const plasterEval=evaluateOfferContract(resolveOfferContract(plasterTask),plasterFull);
ok('plaster full ready',plasterEval.comparisonReady===true);
ok('plaster price',plasterEval.comparableTotalPrice===92000);

const plasterWeak=normalize('Итого 70000 ₽. Гипсовая штукатурка. Материалы включены. Срок 4 дня. Гарантия 1 год.',plasterTask);
const plasterWeakEval=evaluateOfferContract(resolveOfferContract(plasterTask),plasterWeak);
ok('plaster weak blocked',plasterWeakEval.comparisonReady===false);
ok('plaster thickness blocker',plasterWeakEval.comparisonBlockingFields.some(x=>x.id==='layerThickness'));
ok('plaster primer blocker',plasterWeakEval.comparisonBlockingFields.some(x=>x.id==='basePrimerIncluded'));
ok('plaster beacons blocker',plasterWeakEval.comparisonBlockingFields.some(x=>x.id==='beaconsIncluded'));

const plasterOld={...plasterTask,oldLayer:'yes',scope:'старая штукатурка'};
const plasterOldEval=evaluateOfferContract(resolveOfferContract(plasterOld),normalize('Итого 95000 ₽. Гипсовая штукатурка. Толщина 20 мм. Грунтовка и маяки входят. Материалы включены. Срок 5 дней. Гарантия 1 год.',plasterOld));
ok('plaster old layer blocked',plasterOldEval.comparisonBlockingFields.some(x=>x.id==='baseDemolitionIncluded'));

console.log('BASE PREP CONTRACT RULES REGRESSION: PASS');
