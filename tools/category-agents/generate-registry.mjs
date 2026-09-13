import fs from 'node:fs';import path from 'node:path';
import {ROOT} from './helpers.mjs';import {assertManifest} from './manifest.mjs';
const cats=assertManifest(),prod=cats.filter(c=>['TESTING','READY','ACTIVE','SEASONAL_PAUSE'].includes(c.status));
const js='window.sdCategoryManifest='+JSON.stringify(cats.map(c=>({categoryId:c.categoryId,serviceCode:c.serviceCode,title:c.title,status:c.status})))+';\n';
fs.writeFileSync(path.join(ROOT,'assets/category-manifest.generated.js'),js,'utf8');
const cfg=Object.fromEntries(prod.map(c=>{const search=c.search||{};return[c.categoryId,{...search,qualificationPolicy:{categoryId:c.categoryId,serviceCode:c.serviceCode,minServiceMatches:Number(search.minServiceMatches)||1,excludeKeywords:search.excludeKeywords||['вакансия','резюме','обучение','курс мастера','работа для мастера'],strongCompanySources:['official_site','2gis'],strongPrivateSources:['yandex_services'],requireGeoCompatibility:true}}]}));
fs.writeFileSync(path.join(ROOT,'search-api/category-config.generated.mjs'),'export const CATEGORY_CONFIG='+JSON.stringify(cfg,null,2)+';\n','utf8');
const rows=cats.map(c=>`| \`${c.serviceCode}\` | \`${c.categoryId}\` | ${c.title} | ${c.status} | ${c.priority||'P2'} |`).join('\n');
const tax=`# SERVICE_TAXONOMY\n\n## Active development domain\n\`CONSTRUCTION / HOME_REPAIR\`\n\n| Service code | Category id | Name | Lifecycle | Priority |\n|---|---|---|---|---|\n${rows}\n\nLifecycle is mandatory: \`IDEA → RESEARCH → EXPERT_MODEL → TESTING → READY → ACTIVE → SEASONAL_PAUSE\`.\n\nFuture planned domains such as AUTO, LEGAL, HEALTH & BEAUTY, IT, HOUSEHOLD, EVENT, EDUCATION and BUSINESS are not part of the current MVP launch scope.\n`;
fs.writeFileSync(path.join(ROOT,'docs/product/SERVICE_TAXONOMY.md'),tax,'utf8');
const statePath=path.join(ROOT,'docs/product/PROJECT_STATE.md');let state=fs.readFileSync(statePath,'utf8');
const a=state.indexOf('## Category state'),b=state.indexOf('\n## ',a+4);
if(a>=0&&b>a){const lines=cats.map(c=>{let p={};try{p=JSON.parse(fs.readFileSync(path.join(ROOT,c.profile),'utf8'))}catch{};return `- \`${c.serviceCode}\` — \`${c.status}\`${c.status==='READY'?', reference category':''}, profile ${p.profileVersion?'v'+p.profileVersion:'n/a'}.`}).join('\n');state=state.slice(0,a)+`## Category state\n${lines}\n`+state.slice(b);state=state.replace(/Dev-time pipeline из \d+ независимых ролей/,`Dev-time pipeline из 9 независимых ролей`);fs.writeFileSync(statePath,state,'utf8')}
console.log(`Generated registry for ${cats.length} categories (${prod.length} production-enabled).`);
