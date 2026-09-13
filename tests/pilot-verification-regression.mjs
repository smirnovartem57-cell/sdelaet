import { assess } from '../tools/pilot-verification.mjs';
let fail=0;function ok(n,v){console.log(v?'PASS':'FAIL',n);if(!v)fail++}
const base={requirements:{minimumTasksPerCategory:3,minimumOffersPerTask:3},categories:[{serviceCode:'WINDOW_REPAIR',realTasks:0,realOffers:0,reviewedAt:null,evidenceRefs:[]}]};
let r=assess(base);ok('empty evidence pending',!r.ready&&!r.rows[0].ready);
r=assess({...base,categories:[{serviceCode:'WINDOW_REPAIR',realTasks:3,realOffers:9,reviewedAt:'2026-09-13',evidenceRefs:['P1','P2','P3']}]});
ok('real threshold ready',r.ready&&r.rows[0].ready);
r=assess({...base,categories:[{serviceCode:'WINDOW_REPAIR',realTasks:3,realOffers:9,reviewedAt:'2026-09-13',evidenceRefs:['synthetic-only']}]});
ok('insufficient evidence pending',!r.ready);
if(fail)process.exit(1);console.log('Pilot verification regression: 3/3 PASS');
