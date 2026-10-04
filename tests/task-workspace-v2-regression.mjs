import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const task=readFileSync(new URL('../task.html',import.meta.url),'utf8');
const review=readFileSync(new URL('../review.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../assets/account-v1.css',import.meta.url),'utf8');
const account=readFileSync(new URL('../src/customer-account.mjs',import.meta.url),'utf8');
const outreach=readFileSync(new URL('../src/outreach.mjs',import.meta.url),'utf8');

assert.match(task,/taskStatusRail\(t\)/);
assert.match(task,/task-workspace-layout/);
assert.match(task,/Фото и файлы ·/);
assert.match(task,/Ответы через «Сделает»/);
assert.match(task,/Передать мои контакты исполнителю/);
assert.match(task,/Получать ответы через «Сделает»/);
assert.match(task,/contactSharing/);
assert.match(task,/attachmentCount:attachments\.length/);
assert.match(task,/outreach-send-summary/);
assert.match(task,/фото приложено/);

assert.match(review,/reviewSummary/);
assert.match(review,/attachmentCount:channel==='email'\?taskAttachments\.length:0/);
assert.match(review,/contactSharing:r\.contactSharing/);
assert.match(review,/sharedContactFields/);

assert.match(account,/attachmentCount:/);
assert.match(account,/contactSharing:/);
assert.match(account,/sharedContactFields:/);
assert.match(outreach,/attachmentCount:/);
assert.match(outreach,/contactSharing:/);
assert.match(outreach,/sharedContactFields:/);

assert.match(css,/task workspace v2/);
assert.match(css,/\.task-status-rail/);
assert.match(css,/\.contact-sharing-box/);
assert.match(css,/\.outreach-attachment-summary/);
assert.match(css,/@media\(max-width:1180px\)/);
assert.match(css,/@media\(max-width:820px\)/);
assert.match(css,/selection-review-actions\{position:sticky/);

console.log('Task workspace v2 regression: PASS');
