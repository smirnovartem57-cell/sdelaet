import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const task=readFileSync(new URL('../task.html',import.meta.url),'utf8');

assert.match(task,/предварительную стоимость или диапазон стоимости до выезда мастера/);
assert.match(task,/отдельно стоимость работ и материалов/);
assert.match(task,/что может изменить стоимость после осмотра или замера/);
assert.match(task,/стоимость и условия выезда \/ замера, если он платный/);
assert.match(task,/на этом этапе выезд мастера не назначаем/);
assert.match(task,/реалистичный диапазон/);
assert.match(task,/каких именно данных, размеров или фото не хватает/);
assert.match(task,/сначала хотим сравнить предложения/);

console.log('Preliminary quote before visit regression: PASS');
