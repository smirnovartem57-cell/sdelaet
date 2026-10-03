import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const server=readFileSync(new URL('../src/server.mjs',import.meta.url),'utf8');
const journey=readFileSync(new URL('../assets/task-journey-v1.js',import.meta.url),'utf8');

assert.match(server,/CREATE TABLE IF NOT EXISTS research_jobs/);
assert.match(server,/function startResearchJob\(body\)/);
assert.match(server,/setImmediate\(\(\) =>/);
assert.match(server,/\/v1\/candidates\/search-start/);
assert.match(server,/\/v1\/candidates\/search-status/);
assert.match(server,/async function executeCandidateSearch\(body\)/);
assert.match(server,/req\.url === '\/v1\/candidates\/search'/);

assert.match(journey,/async function waitForResearch\(\)/);
assert.match(journey,/\/v1\/candidates\/search-start/);
assert.match(journey,/\/v1\/candidates\/search-status\?taskId=/);
assert.match(journey,/240000/);
assert.match(journey,/2500/);
assert.match(journey,/Исследование всё ещё идёт на сервере/);
assert.doesNotMatch(journey,/post\('\/v1\/candidates\/search',payload\)/);

console.log('Async free research regression: PASS');
