import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const server=readFileSync(new URL('../src/server.mjs',import.meta.url),'utf8');
const account=readFileSync(new URL('../src/customer-account.mjs',import.meta.url),'utf8');
const task=readFileSync(new URL('../task.html',import.meta.url),'utf8');
const taskJourney=readFileSync(new URL('../assets/task-journey-v1.js',import.meta.url),'utf8');
const replies=readFileSync(new URL('../replies.html',import.meta.url),'utf8');
const compare=readFileSync(new URL('../compare.html',import.meta.url),'utf8');

assert.match(server,/ALTER TABLE outreach_authorizations ADD COLUMN targets_json/);
assert.match(server,/targets_json\) VALUES/);
assert.match(server,/CANDIDATE_CONTACT_NOT_AVAILABLE/);
assert.match(server,/authorizeOutreach: body => authorizeOutreach\(body\)/);

assert.match(account,/outreach-authorize/);
assert.match(account,/owner\(email,taskId\)/);
assert.match(account,/PAID_ENTITLEMENT_REQUIRED/);
assert.match(account,/listTaskOffers\(db,id\)/);
assert.match(account,/getOfferDialogueHistory\(db,o\.requestId\)/);
assert.match(account,/FROM outreach_attempts WHERE task_id=\?/);

assert.match(task,/assets\/task-journey-v1\.js/);
assert.match(task,/data-candidate-select/);
assert.match(task,/Продолжить с выбранными/);
assert.match(task,/Проверка перед отправкой/);
assert.match(task,/sdJourney\.sendOutreach\(workspaceController/);
assert.match(taskJourney,/explicitConfirm:true/);
assert.match(taskJourney,/\/v1\/outreach\/prepare/);
assert.match(taskJourney,/\/v1\/outreach\/email\/send/);
assert.match(task,/pending_clarifications/);

assert.match(replies,/sdelaet\.offers\./);
assert.match(compare,/sdelaet\.offers\./);
assert.ok(!task.includes('sdelaet.offers.'),'task workspace must not depend on legacy offer localStorage');

console.log('Task-centric outreach contract: PASS');
