import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../assets/account-v1.css',import.meta.url),'utf8');

['task-description','research','selection','responses','comparison','payment','task-attachments'].forEach(id=>{
  assert.ok(css.includes('#taskRoot #'+id));
});
assert.match(css,/scroll-margin-top:150px/);
assert.match(css,/scroll-margin-top:142px/);
assert.match(css,/scroll-margin-top:126px/);

console.log('Task anchor offsets regression: PASS');
