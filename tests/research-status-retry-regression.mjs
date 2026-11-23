import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const task = Object.freeze({id:'balcony-qa', categoryId:'balcony-insulation', city:'Мытищи',
  description:'Утеплить лоджию 3 × 1 м под кабинет', attachments:Object.freeze(['photo.jpg'])});

async function runResearch(responses, {paid = false, pollDuration = 0} = {}) {
  const states = [];
  const requests = [];
  const savedTasks = [];
  const destinations = [];
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      dataset:{}, classList:{add(){}, remove(){}}, closest:() => null,
      querySelector:element, querySelectorAll:() => [], addEventListener(){},
    });
    return elements.get(id);
  }
  let statusReads = 0;
  let now = 0;
  const window = {
    document:{getElementById:id => id === 'demoSteps' || id === 'demoDraft' ? null : element(id), querySelectorAll:() => []},
    navigator:{onLine:true}, location:{pathname:'/task-tz.html', search:'', hash:''},
    setTimeout(callback, delay){now += delay; queueMicrotask(callback);},
    sdAccountSaveTask:async value => savedTasks.push(value),
    sdMotion:{boot(){}, operation:() => ({set:(...state) => states.push(state), dispose(){}}), text(){}, trap:() => ({})},
  };
  class Clock extends Date {static now(){return now;}}
  const context = vm.createContext({window, URL, Date:Clock});
  for (const file of ['research-pricing-v2.js', 'task-journey-v1.js']) {
    vm.runInContext(readFileSync(new URL(`../assets/${file}`, import.meta.url), 'utf8'), context);
  }
  const completed = () => responses[statusReads - 1]?.status === 'completed' && responses[statusReads - 1].count > 0;
  window.sdJourney.configure({navigate:path => destinations.push(path), request:async (path, {method = 'GET'}, deadline) => {
    requests.push([method, path]);
    if (paid && path === '/v1/account/tasks/balcony-qa') return {task:{payment:{status:'paid'}}};
    if (method === 'GET' && (path.startsWith('/v1/account/') || path === '/v1/auth/session')) return {};
    if (path === '/v1/shortlists/prepared') return completed() ? {prepared:true, count:3} : {};
    if (path === '/v1/candidates/search-start') return {accepted:true, jobId:'existing-job'};
    assert.equal(path, '/v1/candidates/search-status?taskId=balcony-qa');
    const value = responses[statusReads++];
    assert.ok(value, 'unexpected status poll');
    assert.equal(deadline, 240000);
    assert.ok(now < deadline, 'poll started after the deadline');
    now += pollDuration;
    if (value instanceof Error) throw value;
    return value;
  }});
  await window.sdJourney.initResearch(task).run();
  assert.deepEqual(savedTasks, paid ? [] : [task]);
  const writes = requests.filter(([method, path]) => method !== 'GET' && path !== '/v1/shortlists/prepared');
  assert.deepEqual(writes, paid ? [] : [['POST', '/v1/candidates/search-start']]);
  return {state:states.at(-1), statusReads, destinations, now, tariffs:element('.tariff-selector').innerHTML};
}

const badGateway = () => Object.assign(new Error('BAD_GATEWAY'), {status:502});
const connectionLost = () => new TypeError('Failed to fetch');
const recovered = await runResearch([connectionLost(), badGateway(), {status:'running'}, {status:'completed', count:3}]);
assert.equal(recovered.state[0], 'ready');
assert.equal(recovered.statusReads, 4);
assert.match(recovered.tariffs, /990\s*₽/);
assert.match(recovered.tariffs, /2\s*590\s*₽/);
assert.equal((await runResearch([{status:'completed', count:0}])).state[0], 'empty');
const persistent = await runResearch([badGateway(), badGateway(), badGateway()]);
assert.equal(persistent.state[0], 'error');
assert.equal(persistent.statusReads, 3);
assert.match((await runResearch([{status:'failed', error:'PROVIDER_FAILED'}])).state[2], /PROVIDER_FAILED/);
for (const status of [401, 403, 404, 422]) {
  const denied = await runResearch([Object.assign(new Error('PERMANENT_FAILURE'), {status})]);
  assert.match(denied.state[2], /PERMANENT_FAILURE/);
  assert.equal(denied.statusReads, 1);
}
const timedOutRead = Object.assign(new Error('Aborted'), {name:'AbortError'});
assert.equal((await runResearch([timedOutRead, {status:'completed', count:3}])).state[0], 'ready');
const deadline = await runResearch([badGateway()], {pollDuration:237000});
assert.equal(deadline.now, 240000);
assert.equal(deadline.statusReads, 1);
assert.match(deadline.state[2], /всё ещё идёт/);
const paid = await runResearch([], {paid:true});
assert.equal(paid.statusReads, 0);
assert.deepEqual(paid.destinations, ['/task.html?task=balcony-qa#selection']);
console.log('Research status retry regression: PASS');
