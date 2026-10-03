import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const task=readFileSync(new URL('../task.html',import.meta.url),'utf8');
const account=readFileSync(new URL('../src/customer-account.mjs',import.meta.url),'utf8');
const journey=readFileSync(new URL('../assets/task-journey-v1.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../assets/account-v1.css',import.meta.url),'utf8');

assert.match(task,/Сравните исполнителей и выберите подходящих/);
assert.match(task,/Почему подходит/);
assert.match(task,/Что удалось проверить/);
assert.match(task,/Подтверждено/);
assert.match(task,/Заявлено исполнителем/);
assert.match(task,/Не удалось проверить/);
assert.match(task,/Требует внимания/);
assert.match(task,/Продолжить с выбранными/);
assert.match(task,/Подготовка запроса/);
assert.match(task,/Текст запроса/);
assert.match(task,/Продолжить к финальной проверке/);
const review=readFileSync(new URL('../review.html',import.meta.url),'utf8');
assert.match(review,/Финальная проверка/);
assert.match(review,/Подтвердить отправку/);
assert.match(task,/data-candidate-select/);
assert.match(task,/sdCandidateEvidence\.render\(c\)/);

assert.match(account,/facts:Array\.isArray\(r\.facts\)/);
assert.match(account,/sources:Array\.isArray\(r\.sources\)/);
assert.match(account,/trustProfile:/);
assert.match(account,/legalIdentity:/);
assert.match(account,/fnsProfile:/);
assert.match(account,/selectionBreakdown:/);

assert.match(journey,/function sendOutreach\(ws,candidateId,btn,options\)/);
assert.match(journey,/options\.skipConfirm/);

assert.match(css,/restored decision-first candidate selection/);
assert.match(css,/\.decision-candidate/);
assert.match(css,/\.decision-selection-bar/);
assert.match(css,/\.selection-review-modal/);

console.log('Rich candidate selection regression: PASS');
