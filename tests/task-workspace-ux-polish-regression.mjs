import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const task=readFileSync(new URL('../task.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../assets/account-v1.css',import.meta.url),'utf8');
const evidence=readFileSync(new URL('../assets/candidate-evidence-v1.js',import.meta.url),'utf8');

assert.match(task,/function workspaceNav\(t\)/);
assert.match(task,/function workspaceKpis\(t\)/);
assert.match(task,/selection-toolbar/);
assert.match(task,/data-selection-filter="all"/);
assert.match(task,/data-selection-filter="contact"/);
assert.match(task,/data-selection-filter="fns"/);
assert.match(task,/Подробнее: проверки, юрданные и источники/);
assert.match(task,/decision-more/);
assert.match(task,/decision-why-compact/);
assert.match(task,/account-section-fold/);
assert.match(task,/sdCandidateEvidence\.fnsMatches\(c,e\)/);
assert.match(task,/applySelectionFilter\(filter\)/);

assert.match(evidence,/ФНС: связь с юрлицом не подтверждена/);
assert.match(evidence,/Перед заключением договора стоит сверить реквизиты/);
assert.doesNotMatch(evidence,/Сведения не показаны как подтверждённые/);

assert.match(css,/task workspace UX hierarchy/);
assert.match(css,/\.workspace-nav/);
assert.match(css,/\.workspace-kpis/);
assert.match(css,/\.decision-more/);
assert.match(css,/\.selection-toolbar/);
assert.match(css,/\.candidate-state-row/);

console.log('Task workspace UX polish regression: PASS');
