import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const task=readFileSync(new URL('../task.html',import.meta.url),'utf8');
const review=readFileSync(new URL('../review.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../assets/account-v1.css',import.meta.url),'utf8');

assert.match(task,/Email <em>автоматически<\/em>/);
assert.match(task,/Telegram <em>вручную<\/em>/);
assert.match(task,/Telegram не отправляется автоматически/);
assert.match(task,/Предпросмотр письма/);
assert.match(task,/Сервис «Сделает» &lt;requests@onsdelaet\.ru&gt;/);
assert.match(task,/outreach-mail-preview/);

assert.match(review,/Email будет отправлен сервисом автоматически/);
assert.match(review,/Telegram — только вручную/);
assert.match(review,/Открыть Telegram и отправить вручную/);
assert.match(review,/Я отправил сообщение в Telegram/);
assert.match(review,/сообщения ещё не отправлены/);

assert.match(css,/mailbox-style outreach preview \+ manual Telegram/);
assert.match(css,/\.outreach-mail-preview/);
assert.match(css,/\.outreach-mail-body/);
assert.match(css,/max-height:none/);
assert.doesNotMatch(css,/\.outreach-prep-message\{[^}]*max-height:260px/);

console.log('Manual Telegram outreach UX regression: PASS');
