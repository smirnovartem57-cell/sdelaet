import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const task=readFileSync(new URL('../task.html',import.meta.url),'utf8');
const tz=readFileSync(new URL('../task-tz.html',import.meta.url),'utf8');
const expert=readFileSync(new URL('../assets/expert-agent.js',import.meta.url),'utf8');

for(const src of [task,tz,expert]){
  assert.match(src,/стоимость выезда \/ замера, если он платный/i);
  assert.match(src,/засчитывается ли стоимость выезда \/ замера в стоимость работ при заказе/i);
  assert.match(src,/минимальн(ую|ая) стоимость заказа \/ минимальный чек, если есть/i);
  assert.match(src,/что входит в предварительный расчёт сейчас и что будет уточняться только после выезда \/ замера/i);
}

assert.match(task,/Ответ только «стоимость после замера» без предварительного ориентира не поможет сравнить предложения/);
assert.match(task,/В первом ответе, до выезда, укажите:/);

console.log('Previsit commercial estimate v2 regression: PASS');
