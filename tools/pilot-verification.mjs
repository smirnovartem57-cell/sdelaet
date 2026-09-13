import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)?$/.test(String(value || ''));
}

export function assess(data) {
  const taskMin = Number(data?.requirements?.minimumTasksPerCategory) || 3;
  const offersPerTask = Number(data?.requirements?.minimumOffersPerTask) || 3;
  const rows = (data?.categories || []).map((row) => {
    const cases = Array.isArray(row.cases) ? row.cases : [];
    const refs = cases.map((item) => String(item.evidenceRef || '').trim()).filter(Boolean);
    const uniqueRefs = new Set(refs);
    const validCases = cases.filter((item) =>
      String(item.evidenceRef || '').trim() &&
      Number.isInteger(item.offerCount) &&
      item.offerCount >= offersPerTask &&
      validDate(item.reviewedAt)
    );
    const tasks = validCases.length;
    const offers = validCases.reduce((sum, item) => sum + item.offerCount, 0);
    const unique = uniqueRefs.size === cases.length;
    const ready = cases.length >= taskMin && tasks === cases.length && unique;
    return { ...row, cases, tasks, offers, unique, ready };
  });
  return { ready: rows.length > 0 && rows.every((row) => row.ready), rows, taskMin, offersPerTask };
}

export function report(result) {
  for (const row of result.rows) {
    console.log((row.ready ? 'PASS ' : 'PENDING ') + row.serviceCode +
      ': valid cases ' + row.tasks + '/' + result.taskMin +
      ', offers ' + row.offers +
      ', unique refs ' + (row.unique ? 'yes' : 'no'));
  }
  console.log('Pilot verification: ' + (result.ready ? 'READY_FOR_ACTIVE' : 'PENDING_REAL_EVIDENCE'));
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isCli) {
  const data = JSON.parse(fs.readFileSync(new URL('../config/pilot-verification.json', import.meta.url), 'utf8'));
  const result = assess(data);
  report(result);
  if (process.argv.includes('--require-live') && !result.ready) process.exit(2);
}
