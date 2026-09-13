import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT,'config/service-categories.json'),'utf8'));
const category = manifest.categories.find(x=>x.serviceCode==='BALCONY_INSULATION');
let pass = 0, fail = 0;
function check(name, value) {
  if (value) { console.log('PASS',name); pass++; }
  else { console.error('FAIL',name); fail++; }
}
check('category exists',Boolean(category));
check('seo contract exists',Boolean(category?.seo));
check('canonical path',category?.seo?.canonicalPath==='/uslugi/remont/balkony/uteplenie-balkona/');
check('staging is noindex',category?.seo?.indexable===false && category?.seo?.publicationStatus==='DRAFT');
check('two info blocks',(category?.seo?.infoBlocks||[]).length>=2);
check('informational queries',(category?.seo?.informationalQueries||[]).length>=2);
check('faq coverage',(category?.seo?.faq||[]).length>=3);
const gen = spawnSync(process.execPath,[path.join(ROOT,'tools/seo/generate-pages.mjs'),'--category','balcony-insulation'],{cwd:ROOT,encoding:'utf8'});
check('generator exits 0',gen.status===0);
const target = path.join(ROOT,'uslugi/remont/balkony/uteplenie-balkona/index.html');
check('page generated',fs.existsSync(target));
const html = fs.existsSync(target) ? fs.readFileSync(target,'utf8') : '';
check('canonical rendered',html.includes('https://onsdelaet.ru/uslugi/remont/balkony/uteplenie-balkona/'));
check('robots guard rendered',html.includes('content="noindex,follow"'));
check('faq structured data',html.includes('"@type":"FAQPage"'));
check('service structured data',html.includes('"@type":"Service"'));
check('CTA category seed',html.includes('/create-task.html?category=balcony-insulation'));
const qa = spawnSync(process.execPath,[path.join(ROOT,'tools/seo/qa.mjs')],{cwd:ROOT,encoding:'utf8'});
check('SEO QA exits 0',qa.status===0);
console.log(`SEO_CATEGORY_FACTORY ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
