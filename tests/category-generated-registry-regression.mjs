import fs from 'node:fs';
import { categories } from '../tools/category-agents/manifest.mjs';
import { CATEGORY_CONFIG } from '../search-api/category-config.generated.mjs';

const read=(name)=>fs.readFileSync(new URL(name,import.meta.url),'utf8');
const runtime=read('../assets/category-manifest.generated.js');
const publicRegistry=read('../assets/public-category-registry.generated.js');
const navigation=read('../assets/navigation-taxonomy.generated.js');
const taxonomy=read('../docs/product/SERVICE_TAXONOMY.md');
const state=read('../docs/product/PROJECT_STATE.md');
const index=read('../index.html');
const createTask=read('../create-task.html');
const core=read('../search-api/core.mjs');
const categoryEngine=read('../assets/category-engine.js');


let fail=0,pass=0;
function ok(name,value){console.log(value?'PASS':'FAIL',name);value?pass++:fail++}

const cats=categories();
const prodStatus=new Set(['TESTING','READY','ACTIVE','SEASONAL_PAUSE']);
ok('unique category ids',new Set(cats.map((x)=>x.categoryId)).size===cats.length);
ok('unique service codes',new Set(cats.map((x)=>x.serviceCode)).size===cats.length);

for(const category of cats){
  ok('runtime '+category.categoryId,runtime.includes(category.serviceCode));
  ok('public registry '+category.categoryId,publicRegistry.includes(category.serviceCode));
  ok('navigation '+category.categoryId,navigation.includes(category.categoryId));
  ok('taxonomy '+category.categoryId,taxonomy.includes(`| \`${category.serviceCode}\` | \`${category.categoryId}\` |`));
  ok('project state '+category.categoryId,state.includes(`- \`${category.serviceCode}\` — \`${category.status}\``));
  ok('search status '+category.categoryId,prodStatus.has(category.status)?(category.categoryId in CATEGORY_CONFIG):!(category.categoryId in CATEGORY_CONFIG));
}

ok('homepage loads navigation taxonomy',index.includes('navigation-taxonomy.generated.js')&&index.includes('sdNavigationTaxonomy'));
ok('task intake loads public category registry',createTask.includes('public-category-registry.generated.js'));
ok('search core uses generated config',core.includes('category-config.generated.mjs'));

const engineVersions=new Map([...categoryEngine.matchAll(/categories\['([^']+)'\]=\{id:'[^']+',title:'[^']*',serviceCode:'([^']+)',profileVersion:'([^']+)'/g)].map((m)=>[m[1],{serviceCode:m[2],profileVersion:m[3]}]));
const publicMarker='window.sdPublicCategoryRegistry=';
const publicStart=publicRegistry.indexOf(publicMarker);
const publicEnd=publicRegistry.indexOf(';',publicStart);
const publicCategories=JSON.parse(publicRegistry.slice(publicStart+publicMarker.length,publicEnd));
for(const category of publicCategories){
  const engine=engineVersions.get(category.categoryId);
  if(engine)ok('engine profile version '+category.categoryId,engine.serviceCode===category.serviceCode&&engine.profileVersion===category.profileVersion);
}

if(fail)process.exit(1);
console.log(`Generated registry regression: ${pass} PASS, 0 FAIL`);
