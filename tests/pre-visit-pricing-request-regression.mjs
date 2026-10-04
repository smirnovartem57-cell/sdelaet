import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const task=readFileSync(new URL('../task.html',import.meta.url),'utf8');

assert.match(task,/предварительную оценку до выезда мастера/);
assert.match(task,/ориентировочную стоимость или диапазон цены до выезда/);
assert.match(task,/что входит в эту предварительную оценку/);
assert.match(task,/какие факторы могут изменить стоимость после осмотра/);
assert.match(task,/стоимость и условия выезда \/ замера/);
assert.match(task,/каких данных, размеров или фото не хватает/);
assert.match(task,/сравнить предварительные условия нескольких исполнителей без обязательного выезда/);

console.log('Pre-visit pricing request regression: PASS');
