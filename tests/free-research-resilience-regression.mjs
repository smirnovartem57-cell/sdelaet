import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const server=readFileSync(new URL('../src/server.mjs',import.meta.url),'utf8');
const journey=readFileSync(new URL('../assets/task-journey-v1.js',import.meta.url),'utf8');

assert.match(server,/site:uslugi\.yandex\.ru\/profile \$\{query\} \$\{city\}[\s\S]{0,100}\.catch\(\(\) => \[\]\)/);
assert.match(server,/site:avito\.ru \$\{query\} \$\{city\}[\s\S]{0,100}\.catch\(\(\) => \[\]\)/);
assert.match(server,/const runId = saveSearchRun\(result, body\);[\s\S]{0,1200}customerAccount\.captureAttribution/);
assert.match(server,/try \{[\s\S]{0,300}customerAccount\.captureAttribution/);
assert.match(server,/try \{[\s\S]{0,300}updateTaskLifecycle/);
assert.match(server,/try \{[\s\S]{0,300}scheduleSelectionFollowup/);

assert.match(journey,/Исследование не завершилось:/);
assert.match(journey,/оплату начинать не нужно/);
assert.doesNotMatch(journey,/Проверьте соединение и повторите запрос/);

console.log('Free research resilience regression: PASS');
