import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { classifyPrevisitPriceReply } from '../src/offer-pipeline.mjs';

const dry=classifyPrevisitPriceReply(
  'Стоимость определим после выезда мастера.'
);
assert.equal(dry.matched,true);
assert.equal(dry.mode,'auto_send');
assert.equal(dry.reason,'PREVISIT_PRICE_MISSING_BEFORE_VISIT');

const rich=classifyPrevisitPriceReply(
  'Ориентировочно 80 000 руб. Работы займут 3 дня, утепление пеноплексом. Точную стоимость определим после замера.',
  {totalPrice:80000,leadTime:'3 дня',insulationMaterial:'пеноплекс'}
);
assert.equal(rich.matched,true);
assert.equal(rich.mode,'none');
assert.equal(rich.hasPriceSignal,true);
assert.equal(rich.reason,'PREVISIT_PRICE_PROVIDED_FINAL_AFTER_VISIT');
assert.ok(rich.detailScore>=2);

const rawRange=classifyPrevisitPriceReply(
  'Точно скажем после замера, сейчас ориентир 50–80 тыс. руб.'
);
assert.equal(rawRange.matched,true);
assert.equal(rawRange.mode,'none');
assert.equal(rawRange.hasPriceSignal,true);

const detailedButNoPrice=classifyPrevisitPriceReply(
  'Работы займут 3 дня, материалы пеноплекс, гарантия 2 года. Стоимость определим только после выезда.'
);
assert.equal(detailedButNoPrice.matched,true);
assert.equal(detailedButNoPrice.mode,'auto_send');
assert.equal(detailedButNoPrice.hasPriceSignal,false);

const normal=classifyPrevisitPriceReply(
  'Предварительная стоимость 75 000 руб., работы 3 дня, гарантия 2 года.',
  {totalPrice:75000,leadTime:'3 дня',warranty:'2 года'}
);
assert.equal(normal.matched,false);
assert.equal(normal.mode,'none');

const pipeline=readFileSync(new URL('../src/offer-pipeline.mjs',import.meta.url),'utf8');
const server=readFileSync(new URL('../src/server.mjs',import.meta.url),'utf8');
const account=readFileSync(new URL('../src/customer-account.mjs',import.meta.url),'utf8');
const outreach=readFileSync(new URL('../src/outreach.mjs',import.meta.url),'utf8');
const task=readFileSync(new URL('../task.html',import.meta.url),'utf8');

assert.match(pipeline,/decision_mode/);
assert.match(pipeline,/PREVISIT_PRICE_MISSING_BEFORE_VISIT/);
assert.match(pipeline,/PREVISIT_PRICE_PROVIDED_FINAL_AFTER_VISIT/);
assert.match(pipeline,/send_failed/);
assert.match(pipeline,/предварительная стоимость до выезда/);
assert.match(server,/decisionMode === 'auto_send'/);
assert.match(server,/sendServiceClarificationEmail/);
assert.match(account,/CLARIFICATION_CONFIRMATION_REQUIRED/);
assert.match(account,/clarificationSend=u\.pathname\.match/);
assert.match(account,/CLARIFICATION_CONFIRMATION_REQUIRED/);
assert.match(outreach,/X-Sdelaet-Clarification-ID/);
assert.match(task,/data-send-clarification/);
assert.match(task,/Уточнение отправлено автоматически/);
assert.match(task,/Исполнитель дал полезный ответ, но точную стоимость оставил до выезда|предварительн/i);

console.log('Previsit price clarification regression: PASS');
