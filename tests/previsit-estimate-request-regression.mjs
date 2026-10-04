import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const task=readFileSync(new URL('../task.html',import.meta.url),'utf8');
const tz=readFileSync(new URL('../task-tz.html',import.meta.url),'utf8');
const expert=readFileSync(new URL('../assets/expert-agent.js',import.meta.url),'utf8');

assert.match(task,/normalizePrevisitFields/);
assert.match(task,/Нужен предварительный расчёт до выезда/);
assert.match(task,/На этом этапе выезд мастера не требуется/);
assert.match(task,/диапазон или типовой ориентир/);
assert.match(task,/В первом ответе, до выезда, укажите/);
assert.match(task,/что может изменить цену после осмотра \/ замера/);
assert.match(task,/После этого, если для окончательной сметы нужен осмотр или замер/);

assert.match(tz,/normalizePrevisitRequirements/);
assert.match(tz,/Предварительная стоимость до выезда/);
assert.match(tz,/Нужен ли выезд \/ замер для окончательной сметы и сколько он стоит/);
assert.match(tz,/Что может изменить цену после осмотра \/ замера/);

assert.match(expert,/function previsitRequirements/);
assert.match(expert,/responseRequirements:previsitRequirements\(req\)/);
assert.match(expert,/Предварительная оценка стоимости до выезда/);

console.log('Pre-visit estimate request regression: PASS');
