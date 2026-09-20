import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ui = readFileSync(new URL('../assets/prod-ui.js', import.meta.url), 'utf8');
const success = readFileSync(new URL('../payment-success.html', import.meta.url), 'utf8');
const failed = readFileSync(new URL('../payment-failed.html', import.meta.url), 'utf8');
const review = readFileSync(new URL('../review.html', import.meta.url), 'utf8');

const goals = [
  'tariff_tz_click',
  'tariff_find_click',
  'tariff_compare_click',
  'tariff_choice_click',
  'find_executors_click',
  'payment_start',
  'payment_redirect',
  'payment_return',
  'payment_success',
  'payment_fail',
  'search_start',
  'search_complete',
  'request_prepare',
  'request_send',
];

assert.match(ui, /SD_METRIKA_COUNTER_ID=112503660/);
assert.match(ui, /mc\.yandex\.ru\/metrika\/tag\.js/);
assert.match(ui, /'reachGoal'/);

for (const goal of goals) {
  assert.ok(ui.includes(goal), `missing canonical goal: ${goal}`);
}

assert.match(ui, /name==='tz_confirmed'/);
assert.match(ui, /name==='shortlist_prepared'/);
assert.match(ui, /name==='payment_link_created'/);
assert.match(ui, /name==='outreach_review_ready'/);
assert.match(ui, /name==='request_mark_sent'/);
assert.match(ui, /name==='outreach_authorized'/);

assert.match(ui, /data-tariff-card/);
assert.match(ui, /price-card/);
assert.match(ui, /#buySearch/);

assert.match(success, /assets\/prod-ui\.js/);
assert.match(success, /sdAnalytics\.paymentReturn/);
assert.match(success, /sdAnalytics\.paymentStatus/);
assert.match(success, /s==='paid'/);

assert.match(failed, /assets\/prod-ui\.js/);
assert.match(failed, /sdAnalytics\.paymentResultPage\('failed'/);

assert.match(review, /request_mark_sent/);
assert.match(review, /manual-sent/);

console.log('Metrika goals regression: PASS');
