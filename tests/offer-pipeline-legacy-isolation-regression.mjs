import fs from 'node:fs';

function ok(name, value) {
  if (!value) throw new Error('FAIL ' + name);
  console.log('PASS', name);
}

const pipeline = fs.readFileSync(
  new URL('../src/offer-pipeline.mjs', import.meta.url),
  'utf8'
);
const decision = fs.readFileSync(
  new URL('../src/offer-comparison-decision.mjs', import.meta.url),
  'utf8'
);

ok('legacy capture isolated in adapter',
  pipeline.includes('captureLegacyComparison(normalized)'));
ok('legacy is not persistence input',
  !/\.run\([\s\S]{0,1000}legacyComparable/.test(pipeline));
ok('legacy is not followup input',
  !/legacyComparable[\s\S]{0,200}followup/.test(pipeline));
ok('decision source explicitly contract v2',
  decision.includes("source: 'contract_v2'"));
ok('final comparable derives from comparisonReady',
  decision.includes('Boolean(contractEvaluation?.comparisonReady)'));
ok('legacy only stored under decision audit',
  decision.includes('legacy: legacyComparison'));
ok('normalizer remains compatibility layer',
  pipeline.includes('engines.normalizer.normalize(state, task)'));

console.log('OFFER PIPELINE LEGACY ISOLATION REGRESSION: PASS');
