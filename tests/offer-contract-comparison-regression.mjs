import { resolveOfferContract } from '../src/offer-contract.mjs';
import { evaluateOfferContract } from '../src/offer-contract-gap-engine.mjs';

function ok(name, value) {
  if (!value) throw new Error('FAIL ' + name);
  console.log('PASS', name);
}

const task = {
  categoryId: 'balcony-insulation',
  goal: 'Кабинет / использование зимой',
  scope: 'Полный тёплый контур'
};
const contract = resolveOfferContract(task);
const worksIncluded = [
  'утепление пола',
  'утепление потолка',
  'утепление стен / парапета',
  'герметизация / примыкания',
  'проверка остекления'
];

const ready = evaluateOfferContract(contract, {
  totalPrice: 49000,
  priceType: 'fixed',
  materialsIncluded: true,
  worksIncluded,
  leadTime: '5 дней',
  junctionSealingIncluded: true
});
ok('fixed full offer comparison ready', ready.comparisonReady === true);
ok('fixed comparable price', ready.comparableTotalPrice === 49000);
ok('completeness may remain incomplete', ready.contractComplete === false);

const separate = evaluateOfferContract(contract, {
  totalPrice: 31000,
  priceType: 'fixed',
  materialsIncluded: false,
  materialsPrice: 18000,
  worksIncluded,
  leadTime: '3 дня',
  junctionSealingIncluded: true
});
ok('separate materials comparison ready', separate.comparisonReady === true);
ok('separate materials comparable price', separate.comparableTotalPrice === 49000);

const missingMaterials = evaluateOfferContract(contract, {
  totalPrice: 31000,
  priceType: 'fixed',
  materialsIncluded: false,
  worksIncluded,
  leadTime: '3 дня',
  junctionSealingIncluded: true
});
ok('missing material price blocks', missingMaterials.comparisonReady === false);
ok('missing material price rule', missingMaterials.comparisonRuleViolations.some(x => x.id === 'materials_price_missing'));

const fromPrice = evaluateOfferContract(contract, {
  totalPrice: 49000,
  priceType: 'from',
  isFromPrice: true,
  materialsIncluded: true,
  worksIncluded,
  leadTime: '5 дней',
  junctionSealingIncluded: true
});
ok('from price blocks comparison', fromPrice.comparisonReady === false);
ok('from price rule recorded', fromPrice.comparisonRuleViolations.some(x => x.id === 'from_price'));
ok('from price has no comparable total', fromPrice.comparableTotalPrice === null);

const missingGlazing = evaluateOfferContract(contract, {
  totalPrice: 49000,
  priceType: 'fixed',
  materialsIncluded: true,
  worksIncluded: worksIncluded.filter(x => !x.includes('остекления')),
  leadTime: '5 дней',
  junctionSealingIncluded: true
});
ok('missing glazing assessment blocks', missingGlazing.comparisonReady === false);
ok('glazing blocker recorded', missingGlazing.comparisonBlockingWorks.some(x => x.id === 'glazingAssessment'));

console.log('OFFER CONTRACT COMPARISON REGRESSION: PASS');
