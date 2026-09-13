import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/(.:)/, '$1'));
const target = path.join(root, 'config', 'pilot-verification.json');
const args = Object.fromEntries(process.argv.slice(2).map((value) => {
  const at = value.indexOf('=');
  return at > 0 ? [value.slice(0, at).replace(/^--/, ''), value.slice(at + 1)] : [value, true];
}));
const serviceCode = String(args.category || '').trim();
const evidenceRef = String(args.evidence || '').trim();
const offerCount = Number(args.offers);
const reviewedAt = String(args.reviewed || '').trim();

if (!serviceCode || !evidenceRef || !Number.isInteger(offerCount) || offerCount < 1 || !/^\d{4}-\d{2}-\d{2}$/.test(reviewedAt)) {
  console.error('Usage: node tools/pilot-record.mjs --category=SERVICE_CODE --evidence=PILOT-ID --offers=3 --reviewed=YYYY-MM-DD');
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(target, 'utf8'));
const category = data.categories.find((item) => item.serviceCode === serviceCode);
if (!category) {
  console.error('Unknown pilot category: ' + serviceCode);
  process.exit(1);
}
if (data.categories.some((item) => (item.cases || []).some((entry) => entry.evidenceRef === evidenceRef))) {
  console.error('Duplicate evidence reference: ' + evidenceRef);
  process.exit(1);
}
category.cases.push({ evidenceRef, offerCount, reviewedAt });
fs.writeFileSync(target, JSON.stringify(data, null, 2) + '\n');
console.log('Recorded anonymized pilot case ' + evidenceRef + ' for ' + serviceCode + '.');
