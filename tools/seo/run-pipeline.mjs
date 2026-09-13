import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const args = process.argv.slice(2);
const arg = key => { const i=args.indexOf(key); return i>=0 ? args[i+1] : ''; };
const categoryId = arg('--category');
const all = args.includes('--all');
const pending = args.includes('--pending');
const region = arg('--region') || '213';

if (!categoryId && !all && !pending) {
  console.error('Usage: node tools/seo/run-pipeline.mjs --category <id> | --all | --pending [--region 213]');
  process.exit(2);
}

function run(label,script,scriptArgs=[]) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(process.execPath,[path.join(ROOT,script),...scriptArgs],{
    cwd:ROOT, encoding:'utf8', stdio:['inherit','pipe','pipe']
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error(`${label}_FAILED exit=${result.status}`);
}

let selector;
if (pending) {
  const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'config/service-categories.json'),'utf8'));
  const ids=(manifest.categories||[]).filter(c=>c.seo?.automation?.needsQueryResearch===true).map(c=>c.categoryId);
  if (!ids.length) {
    console.log('SEO_PENDING_NONE');
    selector=[];
  } else {
    console.log(`SEO_PENDING_COUNT=${ids.length}`);
    for (const id of ids) run(`SEO WORDSTAT RESEARCH ${id}`,'tools/seo/research-category.mjs',['--category',id,'--source','wordstat','--region',region,'--write','--save-evidence']);
    selector=null;
  }
} else {
  selector=all?['--all']:['--category',categoryId];
  run('SEO WORDSTAT RESEARCH','tools/seo/research-category.mjs',[...selector,'--source','wordstat','--region',region,'--write','--save-evidence']);
}

run('SEO PAGE GENERATION','tools/seo/generate-pages.mjs',all||pending?[]:['--category',categoryId]);
run('SEO HUB GENERATION','tools/seo/generate-hubs.mjs');
run('SEO QA','tools/seo/qa.mjs');

console.log('\nSEO_PIPELINE_OK');
console.log(JSON.stringify({mode:pending?'pending':all?'all':'category',categoryId:all||pending?null:categoryId,region,indexation:'unchanged'},null,2));
