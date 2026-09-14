import { resolveOfferContract } from '../src/offer-contract.mjs';

function ok(name, value) {
  if (!value) throw new Error('FAIL ' + name);
  console.log('PASS', name);
}

function field(contract, id) {
  return contract.fields.find(item => item.id === id);
}

const winter = resolveOfferContract({
  categoryId: 'balcony-insulation',
  goal: 'Кабинет / использование зимой',
  scope: 'Полный тёплый контур'
});

ok('common contract loaded', winter.commonContractId === 'COMMON_OFFER_V2');
ok('common total price', field(winter, 'totalPrice')?.source === 'common');
ok('category system derived from profile', field(winter, 'materialsSystem')?.source === 'category');
ok('winter vapor control required', field(winter, 'vaporBarrierIncluded')?.required === true);
ok('winter thermal bridge required', field(winter, 'thermalBridgeTreatmentIncluded')?.required === true);
ok('winter does not imply warm floor', winter.context.warmFloorRequested === false);
ok('profile clarification limit preserved', winter.clarificationPolicy.maxQuestionsPerRound === 5);
for (const id of ['floorInsulation','ceilingInsulation','wallsParapetInsulation','junctionSealing','glazingAssessment']) {
  ok('winter critical ' + id, winter.criticalWorks.includes(id));
}

const partial = resolveOfferContract({
  categoryId: 'balcony-insulation',
  goal: 'Сделать выбранную зону теплее',
  scope: 'Одна стена балкона',
  description: 'Утеплить одну стену'
});
ok('partial detected', partial.context.partial === true);
ok('partial wall only', JSON.stringify(partial.criticalWorks) === JSON.stringify(['wallsParapetInsulation']));

const warmFloor = resolveOfferContract({
  categoryId: 'balcony-insulation',
  description: 'Нужен электрический тёплый пол'
});
ok('explicit warm floor detected', warmFloor.context.warmFloorRequested === true);

console.log('OFFER CONTRACT RESOLVER REGRESSION: PASS');
