import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const tz=readFileSync(new URL('../task-tz.html',import.meta.url),'utf8');
const journey=readFileSync(new URL('../assets/task-journey-v1.js',import.meta.url),'utf8');
const pricingCss=readFileSync(new URL('../assets/research-pricing-v2.css',import.meta.url),'utf8');
const auth=readFileSync(new URL('../src/customer-auth.mjs',import.meta.url),'utf8');
const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');

assert.match(tz,/Исследовать рынок бесплатно/);
assert.doesNotMatch(tz,/Подготовить подбор бесплатно/);

assert.match(journey,/Бесплатное исследование завершено/);
assert.match(journey,/Исследование рынка было бесплатным/);
assert.match(journey,/Оплата нужна только если хотите открыть контакты/);
assert.match(journey,/Перейти к оплате — /);
assert.match(journey,/async function resumeCheckout/);
assert.match(journey,/await openCheckout/);
assert.match(journey,/if\(!session\.authenticated\)return false/);
assert.match(journey,/return submitCheckout\(\)/);
assert.match(journey,/PAYMENT_LINK_FAILED/);
assert.match(journey,/Деньги не списаны/);

assert.match(pricingCss,/\.sj-pay-explain/);

assert.match(auth,/Message-ID:/);
assert.match(auth,/Date:/);
assert.match(auth,/Reply-To: requests@onsdelaet\.ru/);
assert.match(auth,/Auto-Submitted: auto-generated/);
assert.match(auth,/EHLO onsdelaet\.ru/);
assert.doesNotMatch(auth,/EHLO onsdelaet\.local/);

assert.match(index,/проверьте «Спам»/);

console.log('Free research / payment auth resume / auth mail regression: PASS');
