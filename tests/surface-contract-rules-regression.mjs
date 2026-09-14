import fs from 'node:fs';
import vm from 'node:vm';
import { resolveOfferContract } from '../src/offer-contract.mjs';
import { evaluateOfferContract } from '../src/offer-contract-gap-engine.mjs';

const ctx={window:{}};vm.createContext(ctx);
for(const f of ['offer-parser.js','offer-normalizer.js'])vm.runInContext(fs.readFileSync(new URL('../assets/'+f,import.meta.url),'utf8'),ctx);
const P=ctx.window.sdOfferParser,N=ctx.window.sdOfferNormalizer;
function ok(name,v){if(!v)throw new Error('FAIL '+name);console.log('PASS',name)}
function normalize(text,task){const parsed=P.parse(text);const n=N.normalize(parsed,task);n.priceType=parsed.priceType||n.priceType||(n.isFromPrice?'from':'fixed');return n}

const floorTask={categoryId:'flooring-installation',serviceCode:'FLOORING_INSTALLATION',flooringType:'laminate',layout:'straight',baseState:'ready',scope:'Ламинат 35 м²'};
const floorFull=normalize('Итого 42000 ₽. Ламинат 35 м2. Прямая укладка. Выравнивание основания входит. Подложка входит. Монтаж плинтуса входит. Порожки входят. Срок 2 дня. Гарантия 1 год.',floorTask);
const floorEval=evaluateOfferContract(resolveOfferContract(floorTask),floorFull);
ok('floor full ready',floorEval.comparisonReady===true);
ok('floor price',floorEval.comparableTotalPrice===42000);
ok('floor materials optional',!floorEval.comparisonBlockingFields.some(x=>x.id==='materialsIncluded'));

const floorWeak=normalize('Итого 30000 ₽. Ламинат. Прямая укладка. Срок 2 дня. Гарантия 6 месяцев.',floorTask);
const floorWeakEval=evaluateOfferContract(resolveOfferContract(floorTask),floorWeak);
ok('floor weak blocked',floorWeakEval.comparisonReady===false);
ok('floor prep blocker',floorWeakEval.comparisonBlockingFields.some(x=>x.id==='floorBasePreparationIncluded'));
ok('floor underlay blocker',floorWeakEval.comparisonBlockingFields.some(x=>x.id==='underlayIncluded'));

const floorOld={...floorTask,baseState:'old_covering'};
const floorOldEval=evaluateOfferContract(resolveOfferContract(floorOld),normalize('Итого 45000 ₽. Ламинат. Прямая укладка. Выравнивание основания и подложка входят. Срок 2 дня. Гарантия 1 год.',floorOld));
ok('floor old covering blocked',floorOldEval.comparisonBlockingFields.some(x=>x.id==='floorDemolitionIncluded'));

const tileTask={categoryId:'tile-installation',serviceCode:'TILE_INSTALLATION',tileZone:'wet_room',tileFormat:'large',layout:'straight',scope:'Ванная 18 м²'};
const tileFull=normalize('Итого 118000 ₽. Керамогранит: 600×1200. Прямая раскладка. Выравнивание основания и гидроизоляция входят. Подрезка плитки и отверстия входят. Эпоксидная затирка входит. Срок 6 дней. Гарантия 2 года.',tileTask);
const tileEval=evaluateOfferContract(resolveOfferContract(tileTask),tileFull);
ok('tile full ready',tileEval.comparisonReady===true);
ok('tile price',tileEval.comparableTotalPrice===118000);
ok('tile materials optional',!tileEval.comparisonBlockingFields.some(x=>x.id==='materialsIncluded'));

const tileWeak=normalize('Итого 90000 ₽. Керамогранит 600×1200. Прямая раскладка. Срок 5 дней. Гарантия 1 год.',tileTask);
const tileWeakEval=evaluateOfferContract(resolveOfferContract(tileTask),tileWeak);
ok('tile weak blocked',tileWeakEval.comparisonReady===false);
ok('tile prep blocker',tileWeakEval.comparisonBlockingFields.some(x=>x.id==='substratePreparationIncluded'));
ok('tile waterproof blocker',tileWeakEval.comparisonBlockingFields.some(x=>x.id==='waterproofingIncluded'));

const tileDry={...tileTask,tileZone:'floor',scope:'Пол комнаты 12 м²'};
const tileDryEval=evaluateOfferContract(resolveOfferContract(tileDry),normalize('Итого 40000 ₽. Плитка 300×300. Прямая раскладка. Выравнивание основания входит. Подрезка входит. Цементная затирка. Срок 3 дня. Гарантия 1 год.',tileDry));
ok('dry tile does not require waterproofing',!tileDryEval.comparisonBlockingFields.some(x=>x.id==='waterproofingIncluded'));

console.log('SURFACE CONTRACT RULES REGRESSION: PASS');
