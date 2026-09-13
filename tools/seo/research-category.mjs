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
const pending = args.includes('--pending');
const saveEvidence = args.includes('--save-evidence');
const evidenceDir = arg('--evidence-dir') || 'docs/product/seo-research';

if (!categoryId && !all && !pending) {
  console.error('Usage: node tools/seo/research-category.mjs --category <id> | --all | --pending [--source wordstat] [--region 213] [--write] [--save-evidence]');
  process.exit(2);
}
if ((all || pending) && evidencePath) {
  console.error('--evidence can only be used with one --category. Use --source wordstat for --all/--pending.');
  process.exit(2);
}

const selected = manifest.categories.filter(c => {
  if (all) return true;
  if (pending) {
    return Boolean(c.seo) && (
      c.seo?.automation?.needsQueryResearch !== false ||
      !c.seo?.research ||
      c.seo?.research?.status === 'EVIDENCE_REQUIRED'
    );
  }
  return c.categoryId === categoryId;
});
if (!selected.length) {
  if (pending) {
    console.log(JSON.stringify({write,source:source||null,region:String(region),count:0,summary:{},reports:[],message:'NO_PENDING_SEO_RESEARCH'},null,2));
    process.exit(0);
  }
  throw new Error(`Unknown category: ${categoryId}`);
}
for (const category of selected) {
  if (!category.seo) throw new Error(`SEO contract missing: ${category.categoryId}`);
}

let staticEvidence = {};
if (evidencePath) {
  const absolute = path.isAbsolute(evidencePath) ? evidencePath : path.join(ROOT,evidencePath);
  if (!fs.existsSync(absolute)) throw new Error(`Evidence file not found: ${absolute}`);
  staticEvidence = JSON.parse(fs.readFileSync(absolute,'utf8'));
}

const quota = source === 'wordstat' ? await getWordstatQuota() : null;
const reports = [];
let totalYandexRequestsUsed = 0;

function preservedReviews(category) {
  return category.seo?.research?.cannibalizationReviews || [];
}

async function evidenceFor(category) {
  if (source !== 'wordstat') {
    return staticEvidence.categoryId && staticEvidence.categoryId !== category.categoryId ? {} : staticEvidence;
  }

  const phrases = [
    ...(category.seo?.primaryQueries || []),
    ...(category.seo?.informationalQueries || [])
  ];
  const wordstat = await fetchWordstatFrequency(phrases,{region});
  totalYandexRequestsUsed += Number(wordstat.yandexRequestsUsed || 0);

  return {
    categoryId:category.categoryId,
    sources:[{
      type:'yandex_wordstat',
      service:'wordstat-excel',
      region:String(region),
      quotaLimit:quota?.limit ?? null,
      quotaRemainingAtStart:quota?.remaining ?? null
    }],
    queries:wordstat.queries,
    cannibalizationReviews:preservedReviews(category),
    collectedAt:new Date().toISOString()
  };
}

function saveEvidenceFile(category,evidence) {
  if (!saveEvidence || !evidence?.queries?.length) return null;
  const dir = path.isAbsolute(evidenceDir) ? evidenceDir : path.join(ROOT,evidenceDir);
  fs.mkdirSync(dir,{recursive:true});
  const target = path.join(dir,`${category.categoryId}.wordstat.json`);
  fs.writeFileSync(target,JSON.stringify(evidence,null,2)+'\n','utf8');
  return path.relative(ROOT,target).replaceAll('\\','/');
}

for (const category of selected) {
  const evidence = await evidenceFor(category);
  const evidenceFile = saveEvidenceFile(category,evidence);
  const research = buildResearch(category, manifest.categories, evidence);
  reports.push({
    categoryId:category.categoryId,
    status:research.status,
    queryCount:research.queryCount,
    evidenceQueryCount:research.evidenceQueryCount,
    cannibalization:research.cannibalization.length,
    unresolvedCannibalization:research.unresolvedCannibalization?.length || 0,
    evidenceFile,
    recommendations:research.recommendations
  });
  if (write) {
    category.seo.research = research;
    category.seo.automation ||= {};
    category.seo.automation.needsQueryResearch = research.status !== 'READY_FOR_REVIEW';
    category.seo.automation.researchStatus = research.status;
    category.seo.automation.lastResearchAt = research.collectedAt || new Date().toISOString();
    category.seo.automation.researchProvider = source || 'evidence_file';
    if (evidenceFile) category.seo.automation.researchEvidenceFile = evidenceFile;
  }
}

if (write) fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n','utf8');

const summary = reports.reduce((acc,row) => {
  acc[row.status] = (acc[row.status] || 0) + 1;
  return acc;
},{});
console.log(JSON.stringify({
  write,
  mode:all?'all':pending?'pending':'category',
  source:source || null,
  region:String(region),
  count:reports.length,
  quotaAtStart:quota,
  yandexRequestsUsed:totalYandexRequestsUsed,
  summary,
  reports
},null,2));
