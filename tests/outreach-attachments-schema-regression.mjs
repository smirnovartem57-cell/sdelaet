import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const outreach=readFileSync(new URL('../src/outreach.mjs',import.meta.url),'utf8');

assert.match(outreach,/PRAGMA table_info\(outreach_attempts\)/);
assert.match(outreach,/has\('attachments_json'\)/);
assert.match(outreach,/ALTER TABLE outreach_attempts ADD COLUMN attachments_json TEXT NOT NULL DEFAULT '\[\]'/);
assert.match(outreach,/attachments_json,\s*metadata_json/);

console.log('Outreach attachments schema regression: PASS');
