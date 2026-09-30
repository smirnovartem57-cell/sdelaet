import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const categorySource=readFileSync(new URL('../assets/category-engine.js',import.meta.url),'utf8');
const intake=readFileSync(new URL('../create-task.html',import.meta.url),'utf8');
const tz=readFileSync(new URL('../task-tz.html',import.meta.url),'utf8');
const pricing=readFileSync(new URL('../assets/research-pricing-v2.js',import.meta.url),'utf8');
const journey=readFileSync(new URL('../assets/task-journey-v1.js',import.meta.url),'utf8');
const task=readFileSync(new URL('../task.html',import.meta.url),'utf8');

const sandbox={window:{}};
vm.createContext(sandbox);
vm.runInContext(categorySource,sandbox);
const engine=sandbox.window.sdCategoryEngine;

const typo=engine.analyze('Нужно утоплеить одну сторону балкона, размеры приложил');
assert.equal(typo.categoryId,'balcony-insulation');
assert.match(typo.normalizedText,/утеплить/i);
assert.doesNotMatch(typo.normalizedText,/утоплеить/i);

const universal=engine.analyze('Нужно сделать что-то нестандартное в квартире');
assert.equal(universal.categoryId,'universal-home-repair');
assert.ok(universal.questions.some(q=>q.id==='objectPlace'&&Array.isArray(q.suggestions)&&q.suggestions.length>=3));
assert.ok(universal.questions.some(q=>q.id==='goal'&&Array.isArray(q.suggestions)&&q.suggestions.length>=3));

assert.match(intake,/type:'regionConfirm'/);
assert.match(intake,/Да, верно/);
assert.match(intake,/Нет, выбрать другой/);
assert.match(intake,/sdSetRegionPreference/);
assert.match(intake,/task_spelling_normalized/);

assert.match(tz,/id="assignmentDetails" open/);
assert.match(tz,/Детали задания и схема/);
assert.match(tz,/sdBalconyScheme\.render/);

assert.doesNotMatch(pricing,/Сейчас подготовлено/);
assert.match(pricing,/На первом этапе найдено/);
assert.match(pricing,/Продолжим поиск и сможем расширить подбор/);
assert.doesNotMatch(journey,/сейчас подготовлено/);
assert.match(journey,/найдено на первом этапе/);
assert.match(task,/На первом этапе найдено/);

console.log('Task intake / region / TZ regression: PASS');
