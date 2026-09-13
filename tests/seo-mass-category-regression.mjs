import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const ROOT=path.resolve(process.cwd());
const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'config/service-categories.json'),'utf8'));
const failures=[];
const ok=(name,value)=>{if(value) console.log('PASS',name); else {console.error('FAIL',name);failures.push(name)}};

ok('30 categories',manifest.categories.length===30);
ok('all categories have seo',manifest.categories.every(c=>c.seo));
ok('all pages remain noindex',manifest.categories.every(c=>c.seo.indexable===false));
ok('all publication statuses are DRAFT',manifest.categories.every(c=>c.seo.publicationStatus==='DRAFT'));
ok('all have >=2 info blocks',manifest.categories.every(c=>(c.seo.infoBlocks||[]).length>=2));
ok('all have >=4 FAQ answers',manifest.categories.every(c=>(c.seo.faq||[]).length>=4));
ok('all have informational queries',manifest.categories.every(c=>(c.seo.informationalQueries||[]).length>=4));

const canonicals=manifest.categories.map(c=>c.seo.canonicalPath);
ok('canonical paths unique',new Set(canonicals).size===manifest.categories.length);
ok('canonical paths under /uslugi/remont/',canonicals.every(x=>x.startsWith('/uslugi/remont/')&&x.endsWith('/')));
const generatedOk=manifest.categories.every(c=>{
  const file=path.join(ROOT,c.seo.canonicalPath.replace(/^\//,''),'index.html');
  if(!fs.existsSync(file)) return false;
  const html=fs.readFileSync(file,'utf8');
  return html.includes('<meta name="robots" content="noindex,follow">') && html.includes(c.seo.canonicalPath);
});
ok('all generated pages exist and are noindex',generatedOk);

const auto=manifest.categories.filter(c=>c.seo.automation?.status==='AUTO_DRAFT');
ok('29 categories auto-drafted',auto.length===29);
ok('all categories require query research before index',manifest.categories.every(c=>c.seo.automation?.needsQueryResearch===true));
ok('all categories have research state',manifest.categories.every(c=>c.seo.research?.status==='EVIDENCE_REQUIRED'));
ok('all research states are unresearched initially',manifest.categories.every(c=>c.seo.research?.researched===false));
ok('all research automation statuses are synced',manifest.categories.every(c=>c.seo.automation?.researchStatus===c.seo.research?.status));
ok('balcony insulation curated SEO preserved',manifest.categories.find(c=>c.categoryId==='balcony-insulation').seo.automation?.status==='CURATED');

const dry=spawnSync(process.execPath,[path.join(ROOT,'tools/category-agents/create-category.mjs'),'--dry-run','--id','seo-agent-test','--code','SEO_AGENT_TEST','--title','Тестовая категория','--private-queries','тестовая услуга'],{encoding:'utf8'});
ok('create-category dry run succeeds',dry.status===0);
const payload=dry.status===0?JSON.parse(dry.stdout):{};
ok('new category gets SEO automatically',Boolean(payload.entry?.seo?.canonicalPath));
ok('new category starts noindex',payload.entry?.seo?.indexable===false);
ok('new category gets info blocks',payload.entry?.seo?.infoBlocks?.length>=2);
ok('new category marked AUTO_DRAFT',payload.entry?.seo?.automation?.status==='AUTO_DRAFT');

console.log(`SEO_MASS_CATEGORY ${21-failures.length} PASS / ${failures.length} FAIL`);
if(failures.length) process.exit(1);
