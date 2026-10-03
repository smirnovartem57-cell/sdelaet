import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const intake=readFileSync(new URL('../create-task.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../assets/prod-ui.css',import.meta.url),'utf8');

assert.match(intake,/function removeAttachment\(key\)/);
assert.match(intake,/status:'processing'/);
assert.match(intake,/attachments\.findIndex/);
assert.match(intake,/if\(idx<0\)continue/);
assert.match(intake,/invalidateAttachmentAnalysis\(\)/);
assert.match(intake,/task_photo_removed/);
assert.match(intake,/aria-label','Удалить /);
assert.match(intake,/Math\.max\(0,6-attachments\.length\)/);

assert.match(css,/\.file-remove\{/);
assert.match(css,/\.file-item \.file-item-state/);

console.log('Attachment delete regression: PASS');
