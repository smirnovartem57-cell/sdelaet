import fs from 'node:fs';
import vm from 'node:vm';
import { resolveOfferContract } from '../src/offer-contract.mjs';
import { evaluateOfferContract } from '../src/offer-contract-gap-engine.mjs';

const c={window:{}};
vm.createContext(c);
for(const f of ['offer-parser.js','offer-normalizer.js']) vm.runInContext(fs.readFileSync(new URL('../assets/'+f,import.meta.url),'utf8'),c);
const P=c.window.sdOfferParser,N=c.window.sdOfferNormalizer;
function ok(name,v){if(!v)throw new Error('FAIL '+name);console.log('PASS',name)}
function evalOffer(text,task){return evaluateOfferContract(resolveOfferContract(task),N.normalize(P.parse(text),task))}

const drywallTask={categoryId:'drywall-partitions',serviceCode:'DRYWALL_PARTITIONS',goal:'Монтаж перегородки из ГКЛ',scope:'18 м² со звукоизоляцией',soundRequirement:'yes',roomType:'dry'};
const drywallFull=evalOffer('Итого 52000 ₽. 18 м². Профиль: ПС 75. Шаг стоек 400 мм. ГКЛ 2 слоя с каждой стороны. Минвата входит. Заделка стыков армирующей лентой входит. Материалы включены. Срок 3 дня. Гарантия 2 года.',drywallTask);
ok('drywall full ready',drywallFull.comparisonReady===true);
ok('drywall full price',drywallFull.comparableTotalPrice===52000);
const drywallWeak=evalOffer('Итого 39000 ₽. ГКЛ перегородка. Материалы включены. Срок 3 дня. Гарантия 1 год.',drywallTask);
ok('drywall weak blocked',drywallWeak.comparisonReady===false);
ok('drywall frame blocker',drywallWeak.comparisonBlockingFields.some(x=>x.id==='frameSpec'));
ok('drywall spacing blocker',drywallWeak.comparisonBlockingFields.some(x=>x.id==='studSpacing'));
ok('drywall layers blocker',drywallWeak.comparisonBlockingFields.some(x=>x.id==='boardLayers'));
ok('drywall fill blocker',drywallWeak.comparisonBlockingFields.some(x=>x.id==='partitionFillIncluded'));

const drywallSimpleTask={...drywallTask,scope:'18 м² обычная перегородка',soundRequirement:'no'};
const drywallSimple=evalOffer('Итого 47000 ₽. Профиль: ПС 75. Шаг стоек 400 мм. ГКЛ 2 слоя с каждой стороны. Заделка стыков армирующей лентой входит. Материалы включены. Срок 3 дня. Гарантия 2 года.',drywallSimpleTask);
ok('drywall simple no fill requirement',drywallSimple.comparisonReady===true);

const soundTask={categoryId:'soundproofing',serviceCode:'SOUNDPROOFING',goal:'Шумоизоляция стены',scope:'32 м², разговорный шум'};
const soundFull=evalOffer('Итого 148000 ₽. 32 м². Каркасная шумоизоляция, толщина системы 70 мм, 3 слоя. Виброподвесы и вибролента входят. Примыкания с акустическим герметиком. Материалы Шуманет включены. Срок 6 дней. Гарантия 2 года.',soundTask);
ok('sound full ready',soundFull.comparisonReady===true);
ok('sound full price',soundFull.comparableTotalPrice===148000);
const soundWeak=evalOffer('Итого 90000 ₽. Шумоизоляция стены. Материалы включены. Срок 4 дня. Гарантия 1 год.',soundTask);
ok('sound weak blocked',soundWeak.comparisonReady===false);
ok('sound type blocker',soundWeak.comparisonBlockingFields.some(x=>x.id==='acousticSystemType'));
ok('sound thickness blocker',soundWeak.comparisonBlockingFields.some(x=>x.id==='acousticThickness'));
ok('sound vibration blocker',soundWeak.comparisonBlockingFields.some(x=>x.id==='vibrationIsolationIncluded'));
ok('sound junction blocker',soundWeak.comparisonBlockingFields.some(x=>x.id==='junctionTreatmentIncluded'));
ok('sound materials blocker',soundWeak.comparisonBlockingFields.some(x=>x.id==='acousticMaterialsSpecified'));

const priceInvariant=N.normalize({priceType:'fixed'},{});
ok('normalizer preserves price type',priceInvariant.priceType==='fixed');

console.log('FRAME ACOUSTIC CONTRACT RULES REGRESSION: PASS');
