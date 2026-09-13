import {qualifyCandidateForTask,searchCandidates} from '../search-api/core.mjs';
import {categories} from '../tools/category-agents/manifest.mjs';
let fail=0,checks=0;
for(const c of categories().filter(x=>!['IDEA','RESEARCH'].includes(x.status))){
 const r=qualifyCandidateForTask({name:'Тест',description:c.qualificationPhrase,geo:'Москва'},{categoryId:c.categoryId,city:'Москва'});checks++;const ok=r.qualified===true;console.log(ok?'PASS':'FAIL','qualification',c.categoryId,r.status);if(!ok)fail++;
 const live=await searchCandidates({},{categoryId:c.categoryId,city:'Москва'});checks++;const wired=live.error==='SEARCH_NOT_CONFIGURED';console.log(wired?'PASS':'FAIL','backend wiring',c.categoryId,live.error);if(!wired)fail++;
}
const bad=qualifyCandidateForTask({name:'Репетитор',description:'английский язык',geo:'Москва'},{categoryId:'window-repair',city:'Москва'});checks++;if(bad.qualified){console.log('FAIL unrelated candidate qualified');fail++;}else console.log('PASS unrelated candidate rejected');
const geo=qualifyCandidateForTask({name:'Окна',description:'ремонт окон регулировка',geo:'Казань'},{categoryId:'window-repair',city:'Москва'});checks++;if(geo.qualified){console.log('FAIL wrong geo qualified');fail++;}else console.log('PASS wrong geo rejected');
if(fail)process.exit(1);console.log(`Search qualification regression: ${checks}/${checks} PASS`);
