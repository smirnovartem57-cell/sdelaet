import fs from 'node:fs';
import vm from 'node:vm';
import { resolveOfferContract } from '../src/offer-contract.mjs';
import { evaluateOfferContract } from '../src/offer-contract-gap-engine.mjs';

const ctx={window:{}};
vm.createContext(ctx);
for(const f of ['offer-parser.js','offer-normalizer.js']){
  vm.runInContext(fs.readFileSync(new URL('../assets/'+f,import.meta.url),'utf8'),ctx);
}
const P=ctx.window.sdOfferParser;
const N=ctx.window.sdOfferNormalizer;
function ok(name,value){if(!value)throw new Error('FAIL '+name);console.log('PASS',name)}
function evaluate(categoryId,serviceCode,raw,task={}){
  const parsed=P.parse(raw);
  const normalized=N.normalize(parsed,{categoryId,serviceCode,...task});
  normalized.priceType=parsed.priceType||normalized.priceType||'fixed';
  return {parsed,normalized,result:evaluateOfferContract(resolveOfferContract({categoryId,serviceCode,...task}),normalized)};
}

const glazing=evaluate('balcony-glazing','BALCONY_GLAZING','Итого 118 000 ₽. Материалы включены. Профиль VEKA Softline 70. Стеклопакет двухкамерный 40 мм. Монтаж остекления, демонтаж старых рам, отлив и козырёк входят. Срок 5 дней. Гарантия 5 лет. Бесплатный замер.');
ok('glazing profile parsed',!!glazing.normalized.profileSystem);
ok('glazing glass unit parsed',!!glazing.normalized.glassUnit);
ok('glazing complete comparison ready',glazing.result.comparisonReady===true);

const glazingMissing=evaluate('balcony-glazing','BALCONY_GLAZING','Итого 118 000 ₽. Материалы включены. Профиль VEKA Softline 70. Монтаж остекления и демонтаж входят. Срок 5 дней.');
ok('glazing missing glass blocks',glazingMissing.result.comparisonReady===false);
ok('glazing glass blocker',glazingMissing.result.comparisonBlockingFields.some(x=>x.id==='glassUnit'));

const windows=evaluate('window-replacement','WINDOW_REPLACEMENT','Итого 89 000 ₽ под ключ. Профиль REHAU Grazio. Стеклопакет двухкамерный 40 мм. Фурнитура Roto. Монтаж окон, демонтаж старых окон, подоконники, откосы и отливы входят. Срок 3 дня. Гарантия 3 года.');
ok('window profile parsed',!!windows.normalized.profileSystem);
ok('window glass parsed',!!windows.normalized.glassUnit);
ok('window hardware parsed',!!windows.normalized.hardware);
ok('window complete comparison ready',windows.result.comparisonReady===true);

const windowsMissing=evaluate('window-replacement','WINDOW_REPLACEMENT','Итого 89 000 ₽ под ключ. Профиль REHAU Grazio. Стеклопакет двухкамерный 40 мм. Монтаж окон и демонтаж входят. Срок 3 дня.');
ok('window missing hardware blocks',windowsMissing.result.comparisonReady===false);
ok('window hardware blocker',windowsMissing.result.comparisonBlockingFields.some(x=>x.id==='hardware'));

console.log('WINDOW CONTRACT RULES REGRESSION: PASS');
