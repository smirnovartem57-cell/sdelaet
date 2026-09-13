import {spawnSync} from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const args = process.argv.slice(2);
const arg = key => { const i=args.indexOf(key); return i>=0 ? args[i+1] : ''; };
const categoryId = arg('--category');
const all = args.includes('--all');
const region = arg('--region') || '213';

if (!categoryId && !all) {
  console.error('Usage: node tools/seo/run-pipeline.mjs --category <id> [--region 213] | --all [--region 213]');
  process.exit(2);
}

function run(label,script,scriptArgs=[]) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(process.execPath,[path.join(ROOT,script),...scriptArgs],{
    cwd:ROOT,
    encoding:'utf8',
    stdio:['inherit','pipe','pipe']
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    throw new Error(`${label}_FAILED exit=${result.status}`);
  }
}

const selector = all ? ['--all'] : ['--category',categoryId];

run(
  'SEO WORDSTAT RESEARCH',
  'tools/seo/research-category.mjs',
  [...selector,'--source','wordstat','--region',region,'--write','--save-evidence']
);

run(
  'SEO PAGE GENERATION',
  'tools/seo/generate-pages.mjs',
  all ? [] : ['--category',categoryId]
);

run(
  'SEO QA',
  'tools/seo/qa.mjs'
);

console.log('\nSEO_PIPELINE_OK');
console.log(JSON.stringify({mode:all?'all':'category',categoryId:all?null:categoryId,region,indexation:'unchanged'},null,2));
