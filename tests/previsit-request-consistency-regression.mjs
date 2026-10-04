import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const task=readFileSync(new URL('../task.html',import.meta.url),'utf8');
const legacy=readFileSync(new URL('../requests.html',import.meta.url),'utf8');
const outreach=readFileSync(new URL('../src/outreach.mjs',import.meta.url),'utf8');

for(const source of [task,legacy]){
  assert.match(source,/предварительн(?:ую|ый).*до выезда/i);
  assert.match(source,/диапазон|типовой ориентир/i);
  assert.match(source,/стоимость (?:выезда|выезда \/ замера|замера)/i);
  assert.match(source,/после.*(?:осмотра|замера)|после замера/i);
}
assert.doesNotMatch(legacy,/['"]— итоговую стоимость;['"]/);
assert.match(outreach,/Нужен предварительный расчёт до выезда/i);
assert.match(outreach,/диапазон \/ типовой ориентир/i);

console.log('Pre-visit request consistency regression: PASS');
