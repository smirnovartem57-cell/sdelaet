import fs from'node:fs';import path from'node:path';import {ROOT}from'./helpers.mjs';import {categories}from'./manifest.mjs';
let fail=0;function check(name,v){console.log(v?'PASS':'FAIL',name);if(!v)fail++}
const runtime=fs.readFileSync(path.join(ROOT,'assets/category-manifest.generated.js'),'utf8');
for(const c of categories()){check('manifest runtime '+c.categoryId,runtime.includes(c.serviceCode));check('profile '+c.categoryId,fs.existsSync(path.join(ROOT,c.profile)));check('expert model '+c.categoryId,fs.existsSync(path.join(ROOT,c.expertModel)));if(['TESTING','READY','ACTIVE','SEASONAL_PAUSE'].includes(c.status)){check('qa '+c.categoryId,fs.existsSync(path.join(ROOT,c.qaTest)));check('e2e '+c.categoryId,fs.existsSync(path.join(ROOT,c.e2eTest)))}}
if(fail)process.exit(1);console.log(`Production category smoke: ${categories().length} categories PASS`);
