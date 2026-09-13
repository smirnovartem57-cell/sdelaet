import fs from 'node:fs';
import assert from 'node:assert/strict';

const profile = JSON.parse(
  fs.readFileSync(
    new URL('../assets/category-profiles/balcony-insulation.json', import.meta.url),
    'utf8'
  )
);

function run(name, fn) {
  try {
    fn();
    console.log('PASS', name);
  } catch (error) {
    console.error('FAIL', name, '-', error.message);
    process.exitCode = 1;
  }
}

const fields = new Map(
  (profile.comparisonSchema || []).map(field => [field.id, field])
);

run('C01 profile version supports offer contract', () => {
  assert.equal(profile.categoryId, 'balcony-insulation');
  assert.equal(profile.serviceCode, 'BALCONY_INSULATION');
  assert.ok(profile.outreachContract);
  assert.ok(Array.isArray(profile.comparisonSchema));
  assert.ok(profile.clarificationPolicy);
});

run('C02 same request for every candidate', () => {
  assert.equal(profile.outreachContract.sameRequestForAllCandidates, true);
  assert.ok(profile.outreachContract.requestVersion);
  assert.ok(profile.outreachContract.requiredPrompts.length >= 10);
});

run('C03 critical comparison fields exist', () => {
  [
    'totalPrice',
    'materialsIncluded',
    'materialsSystem',
    'insulationMaterial',
    'insulationThickness',
    'junctionSealingIncluded',
    'vaporBarrierIncluded',
    'thermalBridgeTreatmentIncluded',
    'exclusions',
    'extraCosts'
  ].forEach(id => {
    assert.ok(fields.has(id), `missing ${id}`);
  });
});

run('C04 critical fields drive clarification', () => {
  const critical = [...fields.values()].filter(x => x.importance === 'critical');
  assert.ok(critical.length >= 8);
  assert.equal(profile.clarificationPolicy.askCriticalFirst, true);
  assert.equal(profile.clarificationPolicy.askWhenCriticalFieldUnknown, true);
});

run('C05 unknown is not a negative fact', () => {
  assert.equal(profile.normalization.unknownIsNegative, false);
  assert.equal(profile.normalization.preserveRawReply, true);
});

run('C06 alternative scope cannot replace base request', () => {
  assert.equal(profile.outreachContract.allowAlternativeScope, true);
  assert.equal(profile.outreachContract.alternativeScopeMustBeSeparate, true);
});

if (process.exitCode) process.exit(process.exitCode);
console.log('BALCONY_OFFER_CONTRACT regression suite passed');
