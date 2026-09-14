import fs from 'node:fs';
import vm from 'node:vm';
import { resolveOfferContract } from '../src/offer-contract.mjs';
import { evaluateOfferContract } from '../src/offer-contract-gap-engine.mjs';

const ctx={window:{}};vm.createContext(ctx);
for(const f of ['offer-parser.js','offer-normalizer.js'])vm.runInContext(fs.readFileSync(new URL('../assets/'+f,import.meta.url),'utf8'),ctx);
const P=ctx.window.sdOfferParser,N=ctx.window.sdOfferNormalizer;
function ok(name,v){if(!v)throw new Error('FAIL '+name);console.log('PASS',name)}
function normalize(text,task){const parsed=P.parse(text);const out=N.normalize(parsed,task);out.priceType=parsed.priceType|| (out.isFromPrice?'from':'fixed');return out}

const electricalTask={categoryId:'electrical-installation',serviceCode:'ELECTRICAL_INSTALLATION',electricalJob:'full_rewire',panelScope:'replace',objectState:'renovation',scope:'Квартира 55 м², новая проводка и щит'};
const electricalFull=normalize('Итого 148 000 ₽ под ключ. 28 розеток, 9 линий. Кабель ВВГнг-LS 3x2.5, скрытая прокладка кабеля, штробление и подрозетники. Новый электрощит, автоматы и УЗО входят. После монтажа проверка линий и измерение сопротивления изоляции. Срок 7 дней. Гарантия 2 года.',electricalTask);
const electricalEval=evaluateOfferContract(resolveOfferContract(electricalTask),electricalFull);
ok('electrical full ready',electricalEval.comparisonReady===true);
ok('electrical price',electricalEval.comparableTotalPrice===148000);

const electricalWeak=normalize('Итого 120 000 ₽. Материалы включены. Кабель ВВГнг-LS 3x2.5, скрытая прокладка кабеля. Новый электрощит. Срок 6 дней. Гарантия 1 год.',electricalTask);
const electricalWeakEval=evaluateOfferContract(resolveOfferContract(electricalTask),electricalWeak);
ok('electrical weak blocked',electricalWeakEval.comparisonReady===false);
ok('electrical protection blocker',electricalWeakEval.comparisonBlockingFields.some(x=>x.id==='protectionSpec'));
ok('electrical testing blocker',electricalWeakEval.comparisonBlockingFields.some(x=>x.id==='testingIncluded'));

const plumbingTask={categoryId:'plumbing-works',serviceCode:'PLUMBING_WORKS',plumbingJob:'water_distribution',objectState:'renovation',scope:'5 точек воды и канализация'};
const plumbingFull=normalize('Итого 96 000 ₽ под ключ. 5 точек, 22 м труб. REHAU PE-Xa, коллекторная разводка воды, канализация входит. Демонтаж старых труб и штробление входят. После монтажа опрессовка и проверка герметичности. Срок 4 дня. Гарантия 2 года.',plumbingTask);
const plumbingEval=evaluateOfferContract(resolveOfferContract(plumbingTask),plumbingFull);
ok('plumbing full ready',plumbingEval.comparisonReady===true);
ok('plumbing price',plumbingEval.comparableTotalPrice===96000);

const plumbingWeak=normalize('Итого 82 000 ₽. Материалы включены. 5 точек. Разводка воды. Срок 3 дня. Гарантия 1 год.',plumbingTask);
const plumbingWeakEval=evaluateOfferContract(resolveOfferContract(plumbingTask),plumbingWeak);
ok('plumbing weak blocked',plumbingWeakEval.comparisonReady===false);
ok('plumbing pipe blocker',plumbingWeakEval.comparisonBlockingFields.some(x=>x.id==='pipeSystem'));
ok('plumbing pressure blocker',plumbingWeakEval.comparisonBlockingFields.some(x=>x.id==='pressureTestIncluded'));
ok('plumbing drainage blocker',plumbingWeakEval.comparisonBlockingFields.some(x=>x.id==='drainageIncluded'));

const fixtureTask={categoryId:'plumbing-works',serviceCode:'PLUMBING_WORKS',plumbingJob:'fixture',objectState:'finished',scope:'Замена смесителя'};
const fixture=normalize('Замена смесителя 3 500 ₽. Материалы включены. Демонтаж старого смесителя и установка нового. Срок 1 день. Гарантия 1 год.',fixtureTask);
const fixtureEval=evaluateOfferContract(resolveOfferContract(fixtureTask),fixture);
ok('fixture scenario does not require pipe system',!fixtureEval.comparisonBlockingFields.some(x=>x.id==='pipeSystem'));
ok('fixture type required and parsed',fixture.fixtureType==='смеситель'&&!fixtureEval.comparisonBlockingFields.some(x=>x.id==='fixtureType'));

console.log('TRADE CONTRACT RULES REGRESSION: PASS');
