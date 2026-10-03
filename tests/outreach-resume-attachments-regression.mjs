import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const task=readFileSync(new URL('../task.html',import.meta.url),'utf8');
const review=readFileSync(new URL('../review.html',import.meta.url),'utf8');
const account=readFileSync(new URL('../src/customer-account.mjs',import.meta.url),'utf8');

assert.match(account,/authorization_id/);
assert.match(account,/metadata_json/);
assert.match(account,/telegram:text\(m\.telegram/);

assert.match(task,/function telegramHref\(v\)/);
assert.match(task,/function activeAttempt\(list,channel\)/);
assert.match(task,/Email автоматически/);
assert.match(task,/Telegram вручную/);
assert.match(task,/data-manual-telegram-sent/);
assert.match(task,/\/v1\/outreach\/manual-sent/);
assert.match(task,/Открыть Telegram и отправить вручную/);

assert.match(review,/await get\('\/v1\/account\/tasks\/'/);
assert.match(review,/taskData&&taskData\.task&&taskData\.task\.taskJson/);
assert.doesNotMatch(review,/sdelaet\.task\.v2/);
assert.match(review,/Не удалось проверить вложения задачи/);

console.log('Outreach resume and server attachments regression: PASS');
