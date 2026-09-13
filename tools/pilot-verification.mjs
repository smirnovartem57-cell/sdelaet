import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export function assess(data) {
  const taskMin = Number(data?.requirements?.minimumTasksPerCategory) || 3;
  const offersPerTask = Number(data?.requirements?.minimumOffersPerTask) || 3;
  const rows = (data?.categories || []).map((row) => {
    const tasks = Number(row.realTasks) || 0;
    const offers = Number(row.realOffers) || 0;
    const evidence = Array.isArray(row.evidenceRefs) ? row.evidenceRefs.filter(Boolean) : [];
    const requiredOffers = taskMin * offersPerTask;
    const ready = tasks >= taskMin && offers >= requiredOffers && evidence.length >= tasks && Boolean(row.reviewedAt);
    return { ...row, tasks, offers, requiredOffers, ready };
  });
  return { ready: rows.length > 0 && rows.every((row) => row.ready), rows, taskMin, offersPerTask };
}

export function report(result) {
  for (const row of result.rows) {
    console.log((row.ready ? 'PASS ' : 'PENDING ') + row.serviceCode +
      ': tasks ' + row.tasks + '/' + result.taskMin +
      ', offers ' + row.offers + '/' + row.requiredOffers +
      ', evidence ' + (row.evidenceRefs || []).length +
      ', reviewed ' + (row.reviewedAt ? 'yes' : 'no'));
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
