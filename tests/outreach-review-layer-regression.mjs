import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const task=readFileSync(new URL('../task.html',import.meta.url),'utf8');
const review=readFileSync(new URL('../review.html',import.meta.url),'utf8');
const account=readFileSync(new URL('../src/customer-account.mjs',import.meta.url),'utf8');

assert.match(task,/Подготовка запроса/);
assert.match(task,/Telegram не отправляется автоматически/);
assert.match(task,/data-prep-channel="email"/);
assert.match(task,/data-prep-channel="telegram"/);
assert.match(task,/Предпросмотр письма/);
assert.match(task,/Продолжить к финальной проверке/);
assert.match(task,/sdelaet\.outreach\.review\.v1/);
assert.doesNotMatch(task,/Запросы не отправляются до следующего подтверждения/);

assert.match(review,/Я проверил получателей, каналы и текст запроса/);
assert.match(review,/Подтвердить отправку →/);
assert.match(review,/\/v1\/account\/tasks\/.*outreach-authorize/);
assert.match(review,/Email отправлено:/);
assert.match(review,/Telegram подготовлено:/);
assert.match(review,/Отправка завершена с ошибками/);
assert.match(review,/Вернуться к задаче →/);

assert.match(account,/Array\.isArray\(b\.candidateIds\)/);
assert.match(account,/candidateIds,message,explicitConfirm:true/);

console.log('Outreach review layer regression: PASS');
