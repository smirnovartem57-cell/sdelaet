import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const ui=readFileSync(new URL('../assets/prod-ui.js',import.meta.url),'utf8');
const analytics=readFileSync(new URL('../assets/analytics.js',import.meta.url),'utf8');
const account=readFileSync(new URL('../src/customer-account.mjs',import.meta.url),'utf8');
const payment=readFileSync(new URL('../payment-api/server.mjs',import.meta.url),'utf8');
const success=readFileSync(new URL('../payment-success.html',import.meta.url),'utf8');
const privacy=readFileSync(new URL('../privacy.html',import.meta.url),'utf8');

assert.match(ui,/getClientID/);
assert.match(ui,/sdelaet\.attribution\.first\.v1/);
assert.match(ui,/sdelaet\.attribution\.last\.v1/);
assert.match(ui,/SD_CURRENT_VISIT\.meaningful/);
assert.match(ui,/if\(!SD_FIRST_TOUCH\)/);
assert.match(ui,/intent_cluster/);
assert.match(ui,/task_created:1/);
assert.match(ui,/research_started:1/);
assert.match(ui,/result_ready:1/);
assert.match(ui,/result_viewed:1/);
assert.match(ui,/tariff_selected:1/);
assert.match(ui,/payment_success:1/);
assert.match(ui,/sdGoalOnce\(name,extra\)/);
assert.doesNotMatch(ui,/phone.*reachGoal|email.*reachGoal|description.*reachGoal/i);

assert.match(analytics,/getClientID/);
assert.match(account,/CREATE TABLE IF NOT EXISTS task_attribution/);
assert.match(account,/CREATE TABLE IF NOT EXISTS crm_task_state/);
assert.match(account,/if\(existing\)return existing/);
assert.match(account,/YM_CLIENT_ID_IMMUTABLE/);
assert.match(account,/idx_task_attribution_client/);
assert.match(account,/recordPaymentLifecycle/);
assert.match(account,/attribution:attr\|\|null/);

assert.match(payment,/paymentSuccessEvent/);
assert.match(payment,/confirmedBy:'tochka_webhook'/);
assert.match(payment,/\/v1\/internal\/payment-confirmed/);
assert.match(success,/d\.order/);
assert.match(success,/payment_id:paid\.operationId/);
assert.match(privacy,/Яндекс Метрику/);
assert.match(privacy,/не передаются имя, телефон, email/);

console.log('Marketing attribution v1 contract: PASS');
