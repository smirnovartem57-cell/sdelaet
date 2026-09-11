import fs from 'node:fs';
import vm from 'node:vm';

const code=fs.readFileSync(new URL('../assets/offer-normalizer.js',import.meta.url),'utf8');
const context={window:{}};vm.createContext(context);vm.runInContext(code,context);
const n=context.window.sdOfferNormalizer;
const task={serviceCode:'BALCONY_INSULATION',goal:'Кабинет / использование зимой',scope:'Полный тёплый контур',window:'Остекление есть — сохранить'};

const offers=[
 {candidateName:'A',totalPrice:'31000',materialsIncluded:false,worksIncluded:['стены','парапет'],leadTime:'3 дня',warranty:'1 год',rawResponse:'31 000 только работа'},
 {candidateName:'B',totalPrice:'37000',materialsIncluded:true,worksIncluded:['пол','потолок','стены','парапет','герметизация примыканий','оценка остекления'],leadTime:'4 дня',warranty:'2 года'},
 {candidateName:'C',totalPrice:'42000',materialsIncluded:true,worksIncluded:['стены','потолок','герметизация примыканий','оценка остекления'],exclusions:['пол'],leadTime:'4 дня',warranty:'2 года'},
 {candidateName:'D',totalPrice:'48000',materialsIncluded:true,worksIncluded:['пол','потолок','стены','парапет','герметизация примыканий','оценка остекления'],leadTime:'5 дней',warranty:'3 года'},
 {candidateName:'E',totalPrice:'25000',materialsIncluded:true,worksIncluded:['пол','потолок','стены','парапет','герметизация примыканий','оценка остекления'],leadTime:'3 дня',warranty:'1 год',rawResponse:'Стоимость от 25 000 ₽, точнее после замера'},
 {candidateName:'F',totalPrice:'35000',materialsIncluded:null,worksIncluded:[],leadTime:'',warranty:'',rawResponse:'Сделаем примерно за 35 000, детали после замера'}
];

const ranked=n.rank(offers,task);
function by(name){return ranked.find(x=>x.candidateName===name)}
function check(ok,msg){if(!ok)throw new Error(msg)}
check(by('A').comparable===false,'A must be non-comparable: materials missing and incomplete scope');
check(by('B').comparable===true&&by('B').comparableTotalPrice===37000,'B must be comparable at 37k');
check(by('C').comparable===false&&by('C').missingCriticalWorks.includes('пол'),'C must be non-comparable without floor');
check(by('D').comparable===true&&by('D').comparableTotalPrice===48000,'D must be comparable at 48k');
check(by('E').comparable===false&&by('E').isFromPrice===true,'E price-from must be non-comparable');
check(by('F').comparable===false,'F vague offer must be non-comparable');
check(ranked[0].candidateName==='B','B must rank first as cheapest comparable complete offer');
console.log('BALCONY OFFER NORMALIZER: 6/6 PASS');
