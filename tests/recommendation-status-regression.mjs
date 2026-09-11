import fs from 'fs';import vm from 'vm';
const ctx={window:{}};vm.createContext(ctx);vm.runInContext(fs.readFileSync('assets/recommendation-status.js','utf8'),ctx);const s=ctx.window.sdRecommendationStatus;
function assert(ok,msg){if(!ok)throw new Error(msg)}
const task={goal:'Кабинет / использование зимой'};
const offers=[
{candidateName:'A',comparable:true,comparableTotalPrice:37000,completenessScore:92,materialsIncluded:true,gaps:[],missingCriticalWorks:[],flags:[],exclusions:[],extraCosts:[],rawResponse:'Гарантия 2 года'},
{candidateName:'B',comparable:true,comparableTotalPrice:48000,completenessScore:95,materialsIncluded:true,gaps:[],missingCriticalWorks:[],flags:[],exclusions:[],extraCosts:[],rawResponse:'Гарантия 3 года'},
{candidateName:'C',comparable:false,comparableTotalPrice:null,completenessScore:55,materialsIncluded:false,gaps:['Цена без материалов'],missingCriticalWorks:['пол'],flags:[],exclusions:[],extraCosts:[],rawResponse:'31000 только работа'},
{candidateName:'D',comparable:true,comparableTotalPrice:35000,completenessScore:90,materialsIncluded:true,gaps:[],missingCriticalWorks:[],flags:[],exclusions:[],extraCosts:[],rawResponse:'100% предоплата, без договора'},
{candidateName:'E',comparable:false,comparableTotalPrice:null,completenessScore:70,materialsIncluded:true,gaps:[],missingCriticalWorks:[],flags:[],exclusions:[],extraCosts:[],rawResponse:'Состав не сопоставим'}
];
const out=s.assign(offers,task);const by=n=>out.find(x=>x.candidateName===n);
assert(by('A').recommendationStatus==='RECOMMENDED','A should be recommended');
assert(by('B').recommendationStatus==='GOOD_ALTERNATIVE','B should be alternative');
assert(by('C').recommendationStatus==='NEEDS_CLARIFICATION','C should need clarification');
assert(by('D').recommendationStatus==='HIGH_RISK','D should be high risk');
assert(by('E').recommendationStatus==='NOT_COMPARABLE'||by('E').recommendationStatus==='NEEDS_CLARIFICATION','E should not be recommended');
assert(out.filter(x=>x.recommendationStatus==='RECOMMENDED').length===1,'Only one recommended offer expected');
console.log('recommendation-status regression: PASS');