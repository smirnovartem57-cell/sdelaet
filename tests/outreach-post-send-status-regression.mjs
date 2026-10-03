import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const task=readFileSync(new URL('../task.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../assets/account-v1.css',import.meta.url),'utf8');
const review=readFileSync(new URL('../review.html',import.meta.url),'utf8');

assert.match(task,/function outreachStateBanner\(t\)/);
assert.match(task,/Запросы отправлены:/);
assert.match(task,/Ждём ответы исполнителей/);
assert.match(task,/: отправлено · ждём ответ/);
assert.match(task,/: доставлено · ждём ответ/);
assert.match(task,/: ответ получен/);
assert.match(task,/: не отправлено/);
assert.match(task,/attemptStatusMarkup\(a,label\)/);
assert.match(review,/Email отправлено:/);
assert.match(review,/Отправка завершена с ошибками/);
assert.match(review,/Вернуться к задаче →/);

assert.match(css,/outreach result\/status UX/);
assert.match(css,/\.outreach-state-banner/);
assert.match(css,/\.selection-send-result/);
assert.match(css,/\.outreach-attempt-card/);

console.log('Outreach post-send status UX regression: PASS');
