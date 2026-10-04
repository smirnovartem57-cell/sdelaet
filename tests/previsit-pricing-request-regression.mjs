import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const task=readFileSync(new URL('../task.html',import.meta.url),'utf8');
const outreach=readFileSync(new URL('../src/outreach.mjs',import.meta.url),'utf8');

assert.match(task,/normalizePrevisitFields/);
assert.match(task,/Нужен предварительный расчёт до выезда/);
assert.match(task,/если точную стоимость без осмотра назвать нельзя/i);
assert.match(task,/диапазон или типовой ориентир/i);
assert.match(task,/что может изменить цену после осмотра \/ замера/);
assert.match(task,/В первом ответе, до выезда, укажите:/);
assert.match(task,/После этого, если для окончательной сметы нужен осмотр или замер, мы согласуем его отдельно/);
assert.match(task,/если даже диапазон сейчас назвать нельзя/i);
assert.match(task,/каких конкретно данных, размеров или фото не хватает/i);
assert.match(task,/Мы уточним их до выезда/);

assert.match(outreach,/findIndex\(item => \/\^В \(\?:первом ответе, до выезда, \)\?укажите:\$\/i\.test\(item\)\)/);
assert.match(outreach,/Нужен предварительный расчёт до выезда/);
assert.match(outreach,/диапазон \/ типовой ориентир/);

console.log('Previsit pricing request regression: PASS');
