import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {buildResearch} from '../tools/seo/research-core.mjs';

const ROOT=path.resolve(process.cwd());
const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'config/service-categories.json'),'utf8'));
const category=manifest.categories.find(x=>x.categoryId==='balcony-insulation');
let pass=0,fail=0;
function check(name,cond){if(cond){pass++;console.log('PASS',name)}else{fail++;console.error('FAIL',name)}}

const evidence={
  categoryId:'balcony-insulation',
  collectedAt:'2026-09-13T12:00:00Z',
  sources:[{id:'wordstat-1',type:'yandex_wordstat',label:'Yandex Wordstat export'}],
  queries:[
    {query:'как правильно утеплить балкон',intent:'informational',demand:'high',sourceRefs:['wordstat-1']},
    {query:'чем утеплить балкон изнутри',intent:'informational',demand:'medium',sourceRefs:['wordstat-1']},
    {query:'утепление балкона под кабинет',intent:'informational',demand:'medium',sourceRefs:['wordstat-1']},
    {query:'ошибки утепления балкона',intent:'informational',demand:'medium',sourceRefs:['wordstat-1']},
    {query:'стоимость утепления балкона',intent:'commercial',demand:'high',sourceRefs:['wordstat-1']}
  ],
  questions:['Можно ли утеплить балкон без замены окон?']
};

const research=buildResearch(category,manifest.categories,evidence);
check('external evidence accepted',research.evidenceQueryCount===5);
check('informational clusters created',research.clusters.length>=2);
check('AI answer targets created',research.aiAnswerTargets.length>=1);
check('cannibalization array exists',Array.isArray(research.cannibalization));
check('research no longer evidence-required',research.status!=='EVIDENCE_REQUIRED');
const tmp=path.join(os.tmpdir(),`seo-research-${Date.now()}.json`);
fs.writeFileSync(tmp,JSON.stringify(evidence,null,2),'utf8');
const cli=spawnSync(process.execPath,['tools/seo/research-category.mjs','--category','balcony-insulation','--evidence',tmp],{cwd:ROOT,encoding:'utf8'});
check('research CLI exits 0',cli.status===0);
check('research CLI reports category',cli.stdout.includes('balcony-insulation'));
fs.unlinkSync(tmp);

const seeded=buildResearch(category,manifest.categories,{});
check('seed-only remains evidence-required',seeded.status==='EVIDENCE_REQUIRED');
check('seed-only never claims research complete',seeded.researched===false);

console.log(`SEO_RESEARCH_AGENT ${pass} PASS / ${fail} FAIL`);
process.exit(fail?1:0);
