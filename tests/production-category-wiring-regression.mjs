import fs from'node:fs';
import {categories} from '../tools/category-agents/manifest.mjs';
const launch=fs.readFileSync(new URL('../assets/launch-v2.js',import.meta.url),'utf8');
const core=fs.readFileSync(new URL('../search-api/core.mjs',import.meta.url),'utf8');
let fail=0;
for(const c of categories().filter(x=>!['IDEA','RESEARCH'].includes(x.status))){
 const a=launch.includes('category-manifest.generated.js')||launch.includes(c.serviceCode);console.log(a?'PASS':'FAIL','expert wiring',c.serviceCode);if(!a)fail++;
 const b=core.includes('category-config.generated.mjs')||core.includes(`'${c.categoryId}':`);console.log(b?'PASS':'FAIL','search wiring',c.categoryId);if(!b)fail++;
}
if(/task\.serviceCode!==['\"]BALCONY_INSULATION/.test(launch)){console.log('FAIL insulation-only expert guard remains');fail++;}else console.log('PASS no insulation-only expert guard');
if(fail)process.exit(1);console.log('Production category wiring regression: PASS');
