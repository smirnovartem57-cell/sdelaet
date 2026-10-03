import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const outreach=readFileSync(new URL('../src/outreach.mjs',import.meta.url),'utf8');

assert.match(outreach,/OUTREACH_STATUS_REPORT/);
assert.match(outreach,/\/var\/lib\/sdelaet\/reports\/outreach-status\.json/);
assert.match(outreach,/function writeOutreachStatusSnapshot\(\)/);
assert.match(outreach,/ORDER BY prepared_at DESC/);
assert.match(outreach,/LIMIT 100/);
assert.match(outreach,/writeOutreachStatusSnapshot\(\);/);
assert.match(outreach,/externalMessageId/);
assert.match(outreach,/lastError/);

console.log('Outreach status snapshot regression: PASS');
