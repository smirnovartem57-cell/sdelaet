import fs from 'node:fs';
import path from 'node:path';
import {buildResearch} from './research-core.mjs';
import {fetchWordstatFrequency,getWordstatQuota} from './sources/wordstat-service.mjs';

const ROOT = path.resolve(process.cwd());
const manifestPath = path.join(ROOT,'config/service-categories.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const args = process.argv.slice(2);
const arg = key => { const i=args.indexOf(key); return i>=0 ? args[i+1] : ''; };
const categoryId = arg('--category');
const evidencePath = arg('--evidence');
const source = arg('--source');
const region = arg('--region') || '225';
const write = args.includes('--write');
const all = args.includes('--all');

if (!categoryId && !all) {
  console.error('Usage: node tools/seo/research-category.mjs --category <id> [--evidence file.json] [--write] | --all [--write]');
  process.exit(2);
}

let evidence = {};
if (source === 'wordstat') {
  const target = manifest.categories.find(c => c.categoryId === categoryId);
  if (!target) throw new Error(`Unknown category: ${categoryId}`);
  const phrases=[...(target.seo?.primaryQueries||[]),...(target.seo?.informationalQueries||[])];
  const quota=await getWordstatQuota();
  const wordstat=await fetchWordstatFrequency(phrases,{region});
  evidence={categoryId,sources:[{type:'yandex_wordstat',service:'wordstat-excel',region:String(region),quotaRemaining:quota.remaining}],queries:wordstat.queries,collectedAt:new Date().toISOString()};
}
if (evidencePath) {
  const absolute = path.isAbsolute(evidencePath) ? evidencePath : path.join(ROOT,evidencePath);
  if (!fs.existsSync(absolute)) throw new Error(`Evidence file not found: ${absolute}`);
  evidence = JSON.parse(fs.readFileSync(absolute,'utf8'));
}

const selected = manifest.categories.filter(c => all || c.categoryId === categoryId);
if (!selected.length) throw new Error(`Unknown category: ${categoryId}`);
const reports = [];
for (const category of selected) {
  if (!category.seo) throw new Error(`SEO contract missing: ${category.categoryId}`);
  const categoryEvidence = evidence.categoryId && evidence.categoryId !== category.categoryId ? {} : evidence;
  const research = buildResearch(category, manifest.categories, categoryEvidence);
  reports.push({categoryId:category.categoryId,status:research.status,queryCount:research.queryCount,evidenceQueryCount:research.evidenceQueryCount,cannibalization:research.cannibalization.length,unresolvedCannibalization:research.unresolvedCannibalization?.length || 0,recommendations:research.recommendations});
  if (write) {
    category.seo.research = research;
    category.seo.automation ||= {};
    category.seo.automation.needsQueryResearch = research.status !== 'READY_FOR_REVIEW';
    category.seo.automation.researchStatus = research.status;
  }
}

if (write) fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n','utf8');
console.log(JSON.stringify({write,count:reports.length,reports},null,2));
