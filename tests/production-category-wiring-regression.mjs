import fs from 'node:fs';
import { categories } from '../tools/category-agents/manifest.mjs';

const expert=fs.readFileSync(new URL('../assets/expert-agent.js',import.meta.url),'utf8');
const core=fs.readFileSync(new URL('../search-api/core.mjs',import.meta.url),'utf8');
let fail=0;

for(const category of categories().filter((item)=>!['IDEA','RESEARCH'].includes(item.status))){
  const expertWired=expert.includes(`c==='${category.serviceCode}'`)||
    expert.includes(`t.serviceCode==='${category.serviceCode}'`)||
    expert.includes(`t.serviceCode==="${category.serviceCode}"`)||
    (category.serviceCode==='BALCONY_INSULATION'&&expert.includes("var c=t.serviceCode||'BALCONY_INSULATION'")&&expert.includes(':insulation(t)'));
  console.log(expertWired?'PASS':'FAIL','expert wiring',category.serviceCode);
  if(!expertWired)fail++;

  const searchWired=core.includes('category-config.generated.mjs')||core.includes(`'${category.categoryId}':`);
  console.log(searchWired?'PASS':'FAIL','search wiring',category.categoryId);
  if(!searchWired)fail++;
}

const fallbackGuard=/task\.serviceCode!==['"]BALCONY_INSULATION/.test(expert);
if(fallbackGuard){console.log('FAIL insulation-only expert guard remains');fail++;}
else console.log('PASS no insulation-only expert guard');

if(!expert.includes('window.sdExpertAgent={run:run,constructionExpert:constructionExpert,reviewer:reviewer}')){
  console.log('FAIL expert runtime export');fail++;
}else console.log('PASS expert runtime export');

if(fail)process.exit(1);
console.log('Production category wiring regression: PASS');
