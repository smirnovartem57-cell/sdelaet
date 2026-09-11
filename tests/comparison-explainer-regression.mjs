import fs from 'fs';import vm from 'vm';
const code=fs.readFileSync(new URL('../assets/comparison-explainer.js',import.meta.url),'utf8');const sandbox={window:{}};vm.createContext(sandbox);vm.runInContext(code,sandbox);const x=sandbox.window.sdComparisonExplainer;
function assert(cond,msg){if(!cond)throw new Error(msg)}
const task={goal:'Кабинет / использование зимой'};
const offers=[
 {candidateName:'Полный 37',totalPrice:37000,comparable:true,comparableTotalPrice:37000,materialsIncluded:true,criticalGaps:[],completenessScore:95,warranty:'2 года',leadTime:'4 дня',extraCosts:[],exclusions:[]},
 {candidateName:'Дешёвый 31',totalPrice:31000,comparable:false,comparableTotalPrice:null,materialsIncluded:false,criticalGaps:['утепление пола'],completenessScore:55,warranty:'',leadTime:'',extraCosts:[],exclusions:[]},
 {candidateName:'Полный 48',totalPrice:48000,comparable:true,comparableTotalPrice:48000,materialsIncluded:true,criticalGaps:[],completenessScore:90,warranty:'3 года',leadTime:'5 дней',extraCosts:[],exclusions:[]}
];
const r=x.explain(offers,task);assert(r.winner&&r.winner.candidateName==='Полный 37','winner must be cheapest comparable');assert(r.reasons.some(v=>v.includes('31 000')),'must explain cheaper non-comparable headline');assert(r.reasons.some(v=>v.includes('48 000')),'must compare with next comparable offer');assert(r.checks.some(v=>/остеклен/i.test(v)),'winter scenario must remind glazing check');assert(r.reasons.length<=4&&r.checks.length<=4,'explanation must stay compact');
const none=x.explain([{candidateName:'A',comparable:false,totalPrice:25000}],task);assert(none.winner===null,'no winner when nothing comparable');assert(/нельзя выбрать/i.test(none.summary),'must explain that selection is premature');
console.log('comparison-explainer-regression: PASS');