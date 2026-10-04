import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const task=readFileSync(new URL('../task.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../assets/account-v1.css',import.meta.url),'utf8');

assert.match(task,/function bindWorkspaceProgress\(\)/);
assert.match(task,/new IntersectionObserver/);
assert.match(task,/aria-current','step'/);
assert.match(task,/rootMargin:'-145px 0px -65% 0px'/);
assert.match(task,/bindWorkspaceProgress\(\)/);

assert.match(css,/active task progress \+ candidate density polish/);
assert.match(css,/\.workspace-progress a\.active/);
assert.match(css,/aria-current="step"/);
assert.match(css,/\.decision-candidate\{padding:13px!important\}/);
assert.match(css,/\.decision-why-compact/);

console.log('Task progress active regression: PASS');
