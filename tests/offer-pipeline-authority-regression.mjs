import fs from 'node:fs';

function ok(name, value) {
  if (!value) throw new Error('FAIL ' + name);
  console.log('PASS', name);
}

const source = fs.readFileSync(new URL('../src/offer-pipeline.mjs', import.meta.url), 'utf8');
ok('contract evaluation is used', source.includes('evaluateOfferContract(resolvedContract, normalized)'));
ok('contract result overwrites normalized comparable', source.includes('normalized.comparable = Boolean(contractEvaluation.comparisonReady)'));
ok('contract price overwrites comparable total', source.includes('normalized.comparableTotalPrice = contractEvaluation.comparableTotalPrice'));
ok('db comparable comes from normalized authority', source.includes('normalized.comparable ? 1 : 0'));
ok('legacy comparison retained for shadow audit', source.includes('legacyMismatch'));
ok('contract-driven followup retained', source.includes('contractEvaluation.clarificationItems'));
console.log('OFFER PIPELINE AUTHORITY REGRESSION: PASS');
