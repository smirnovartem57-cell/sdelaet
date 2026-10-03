import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const outreach=readFileSync(new URL('../src/outreach.mjs',import.meta.url),'utf8');
const journey=readFileSync(new URL('../assets/task-journey-v1.js',import.meta.url),'utf8');

assert.match(outreach,/EHLO onsdelaet\.ru/);
assert.doesNotMatch(outreach,/EHLO onsdelaet\.local/);

assert.match(journey,/function clearOutreachUnresolved\(key\)/);
assert.match(journey,/var sent=await post\('\/v1\/outreach\/email\/send'/);
assert.match(journey,/sent\.outreach&&sent\.outreach\.status/);
assert.match(journey,/Почтовый сервер принял запрос/);
assert.match(journey,/if\(deterministic\)clearOutreachUnresolved\(key\)/);
assert.match(journey,/Отправка отклонена сервером:/);
assert.match(journey,/Соединение прервалось до подтверждения результата/);

console.log('Outreach confirmation and SMTP identity regression: PASS');
