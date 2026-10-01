import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const account=readFileSync(new URL('../src/customer-account.mjs',import.meta.url),'utf8');

assert.match(account,/function ensureClientForEmail\(email\)/);
assert.match(account,/SELECT client_id_crm FROM clients WHERE lower\(COALESCE\(email_normalized,email,''\)\)=\?/);
assert.match(account,/INSERT INTO clients\(/);
assert.match(account,/client_account_/);
assert.match(account,/const ts=now\(\),clientIdCrm=text\(old\?\.client_id_crm\)\|\|ensureClientForEmail\(email\)/);
assert.doesNotMatch(account,/VALUES\(\?,NULL,\?,\?,\?,\?,\?,'draft'/);
assert.match(account,/INSERT INTO tasks\(task_id,client_id_crm/);
assert.match(account,/UPDATE tasks SET client_id_crm=\?/);

console.log('Account task CRM client bridge regression: PASS');
