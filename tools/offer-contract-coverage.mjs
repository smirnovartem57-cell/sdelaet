import { analyzeOfferContractCoverage } from '../src/offer-contract-coverage.mjs';

const report = analyzeOfferContractCoverage();

console.log('Offer contract coverage');
console.log('profiles=' + report.profileCount);
console.log('explicit_rules=' + report.explicitRulesCount);
for (const [tier, count] of Object.entries(report.counts)) {
  console.log(tier + '=' + count);
}

for (const item of report.categories) {
  console.log([
    item.categoryId,
    item.tier,
    'fields=' + item.comparisonFields,
    'critical=' + item.criticalFields,
    'important=' + item.importantFields,
    'outreach=' + Number(item.outreachContract),
    'clarify=' + Number(item.clarificationPolicy)
  ].join('\t'));
}

if (report.invalidRuleTargets.length) {
  console.error('Invalid rule targets: ' + report.invalidRuleTargets.join(', '));
  process.exit(1);
}
if (report.duplicateCategoryIds.length) {
  console.error('Duplicate category ids: ' + report.duplicateCategoryIds.join(', '));
  process.exit(1);
}
if (report.categories.some(item => item.duplicateFields.length)) {
  console.error('Duplicate comparison fields found');
  process.exit(1);
}

console.log('OFFER CONTRACT COVERAGE AUDIT: PASS');
