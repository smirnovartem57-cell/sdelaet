import fs from 'node:fs';
import path from 'node:path';
import {buildSeoDraft} from './seo-draft.mjs';

const ROOT=path.resolve(process.cwd());
const manifestPath=path.join(ROOT,'config/service-categories.json');
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const args=process.argv.slice(2);
const write=args.includes('--write');
const refresh=args.includes('--refresh');
const id=args.includes('--category')?args[args.indexOf('--category')+1]:'';

const selected=manifest.categories.filter(c=>!id||c.categoryId===id);
if(id&&!selected.length){console.error(`Unknown category: ${id}`);process.exit(2)}
let changed=0,skipped=0;
for(const category of selected){
  if(category.seo && !refresh){skipped++;continue}
  const current=category.seo||{};
  const generated=buildSeoDraft(ROOT,category,manifest.categories);
  if(refresh){
    category.seo=current.automation?.status==='AUTO_DRAFT'?generated:current;
  } else {
    category.seo=generated;
  }
  changed++;
}

if(write){fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n','utf8')}
console.log(JSON.stringify({selected:selected.length,changed,skipped,write,refresh},null,2));
