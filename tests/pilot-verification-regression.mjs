import { assess } from '../tools/pilot-verification.mjs';
let fail=0;function ok(n,v){console.log(v?'PASS':'FAIL',n);if(!v)fail++}
const requirements={minimumTasksPerCategory:3,minimumOffersPerTask:3};
const wrap=(cases)=>({requirements,categories:[{serviceCode:'WINDOW_REPAIR',cases}]});
let r=assess(wrap([]));ok('empty evidence pending',!r.ready);
const good=[
  {evidenceRef:'PILOT-WR-001',offerCount:3,reviewedAt:'2026-09-13'},
  {evidenceRef:'PILOT-WR-002',offerCount:4,reviewedAt:'2026-09-13'},
  {evidenceRef:'PILOT-WR-003',offerCount:3,reviewedAt:'2026-09-13'}
];
r=assess(wrap(good));ok('three reviewed cases ready',r.ready&&r.rows[0].offers===10);
r=assess(wrap(good.map((x,i)=>i===2?{...x,reviewedAt:null}:x)));ok('unreviewed case pending',!r.ready);
r=assess(wrap(good.map((x,i)=>i===2?{...x,evidenceRef:'PILOT-WR-001'}:x)));ok('duplicate evidence pending',!r.ready&&!r.rows[0].unique);
r=assess(wrap(good.map((x,i)=>i===2?{...x,offerCount:2}:x)));ok('insufficient offers pending',!r.ready);
if(fail)process.exit(1);console.log('Pilot verification regression: 5/5 PASS');
