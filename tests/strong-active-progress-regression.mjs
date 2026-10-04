import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../assets/account-v1.css',import.meta.url),'utf8');

assert.match(css,/workspace-progress a\.active/);
assert.match(css,/linear-gradient\(135deg,#edf5ff,#f7fbff\)/);
assert.match(css,/background:#2f74c8;color:#fff/);
assert.match(css,/workspace-progress a\.active:after/);

console.log('Strong active progress regression: PASS');
