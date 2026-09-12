import {qualifyCandidateForTask,searchCandidates} from '../search-api/core.mjs';
const cases=[
['balcony-insulation','Утепление балконов и лоджий','Москва'],['balcony-glazing','Остекление балконов и лоджий','Москва'],
['window-replacement','Пластиковые окна и стеклопакеты','Москва'],['window-repair','Ремонт окон, регулировка фурнитуры','Москва'],
['balcony-finishing','Отделка и обшивка балконов','Москва'],['balcony-leak-repair','Герметизация швов и ремонт протечек','Москва'],
['electrical-installation','Электромонтаж, замена проводки и сборка электрощита','Москва']
];
let fail=0;
for(const [categoryId,description,geo] of cases){
 const r=qualifyCandidateForTask({name:'Тест',description,geo},{categoryId,city:'Москва'});const ok=r.qualified===true;console.log(ok?'PASS':'FAIL','qualification',categoryId,r.status);if(!ok)fail++;
 const live=await searchCandidates({},{categoryId,city:'Москва'});const wired=live.error==='SEARCH_NOT_CONFIGURED';console.log(wired?'PASS':'FAIL','backend wiring',categoryId,live.error);if(!wired)fail++;
}
const bad=qualifyCandidateForTask({name:'Репетитор',description:'английский язык',geo:'Москва'},{categoryId:'window-repair',city:'Москва'});if(bad.qualified){console.log('FAIL unrelated candidate qualified');fail++;}else console.log('PASS unrelated candidate rejected');
const geo=qualifyCandidateForTask({name:'Окна',description:'ремонт окон регулировка',geo:'Казань'},{categoryId:'window-repair',city:'Москва'});if(geo.qualified){console.log('FAIL wrong geo qualified');fail++;}else console.log('PASS wrong geo rejected');
if(fail)process.exit(1);console.log('Search qualification regression: 16/16 PASS');