import fs from 'node:fs';

function ok(name, value) {
  if (!value) throw new Error('FAIL ' + name);
  console.log('PASS', name);
}

const source = fs.readFileSync(
  new URL('../src/offer-pipeline.mjs', import.meta.url),
  'utf8'
);

ok('contract evaluation is used',
  source.includes('evaluateOfferContract(resolvedContract, normalized)'));
ok('legacy snapshot captured before authority switch',
  source.includes('captureLegacyComparison(normalized)'));
ok('isolated decision adapter is used',
  source.includes('applyOfferComparisonDecision('));
ok('db comparable comes from explicit decision',
  source.includes('comparisonDecision.comparable ? 1 : 0'));
ok('db status comes from explicit decision',
  source.includes('comparisonDecision.comparisonStatus'));
ok('db no longer reads normalized comparable directly',
  !source.includes('normalized.comparable ? 1 : 0'));
ok('contract-driven followup retained',
  source.includes('contractEvaluation.clarificationItems'));

console.log('OFFER PIPELINE AUTHORITY REGRESSION: PASS');
