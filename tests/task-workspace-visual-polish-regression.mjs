import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const task=readFileSync(new URL('../task.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../assets/account-v1.css',import.meta.url),'utf8');

assert.match(task,/function sectionDivider\(step,title,note\)/);
assert.match(task,/task-stage-divider/);
assert.match(task,/workspace-progress/);
assert.match(task,/task-status-rail compact/);
assert.match(task,/task-rail-metrics/);
assert.match(task,/task-rail-facts/);

assert.match(css,/task workspace visual polish/);
assert.match(css,/\.task-stage-divider/);
assert.match(css,/\.workspace-progress/);
assert.match(css,/\.task-status-rail\.compact/);
assert.match(css,/\.task-rail-metrics/);
assert.match(css,/\.task-rail-facts/);
assert.match(css,/@media\(max-width:1180px\)/);
assert.match(css,/@media\(max-width:820px\)/);

console.log('Task workspace visual polish regression: PASS');
