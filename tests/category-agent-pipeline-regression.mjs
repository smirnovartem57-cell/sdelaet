import {allAgents,releaseController} from '../tools/category-agents/registry.mjs';
import {runCategory,getProfile} from '../tools/category-agents/orchestrator.mjs';
let fail=0;function ok(n,v){console.log(v?'PASS':'FAIL',n);if(!v)fail++}
ok('nine production roles including consistency',allAgents.length===9);
const tile=runCategory(getProfile('tile-installation'));
ok('tile pipeline has nine results',tile.agents.length===9);
ok('tile pipeline no blockers',tile.agents.every(x=>x.status!=='BLOCK'));
ok('consistency agent pass',tile.agents.find(x=>x.agent==='CATEGORY_CONSISTENCY_AGENT')?.status==='PASS');
ok('tile release remains testing',/ручн/i.test(tile.releaseDecision));
const fake={...getProfile('tile-installation'),status:'READY',releaseGate:null};
const prior=tile.agents.slice(0,8).map(x=>({...x,status:'PASS'}));
const gate=releaseController.run({profile:fake,results:prior});
ok('release controller blocks fake READY',gate.status==='BLOCK');
if(fail)process.exit(1);console.log('Category agent pipeline regression: 6/6 PASS');
