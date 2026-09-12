import {allAgents} from '../tools/category-agents/registry.mjs';
import {runCategory,getProfile} from '../tools/category-agents/orchestrator.mjs';
import {releaseController} from '../tools/category-agents/registry.mjs';
let fail=0;function ok(n,v){console.log(v?'PASS':'FAIL',n);if(!v)fail++}
ok('eight production roles',allAgents.length===8);
const tile=runCategory(getProfile('tile-installation'));
ok('tile pipeline has eight results',tile.agents.length===8);
ok('tile pipeline no blockers',tile.agents.every(x=>x.status!=='BLOCK'));
ok('tile release remains testing',/ручн/i.test(tile.releaseDecision));
const fake={...getProfile('tile-installation'),status:'READY',releaseGate:null};const prior=tile.agents.slice(0,7).map(x=>({...x,status:'PASS'}));const gate=releaseController.run({profile:fake,results:prior});ok('release controller blocks fake READY',gate.status==='BLOCK');
if(fail)process.exit(1);console.log('Category agent pipeline regression: 5/5 PASS');
