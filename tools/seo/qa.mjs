import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT,'config/service-categories.json'),'utf8'));
const categories = Array.isArray(data) ? data : data.categories || [];
const errors = [];
const warnings = [];
const canonicals = new Map();
const fail = (code,c,msg) => errors.push(`${code} ${c.serviceCode}: ${msg}`);
const warn = (code,c,msg) => warnings.push(`${code} ${c.serviceCode}: ${msg}`);

for (const c of categories) {
  const s = c.seo;
  if (!s) continue;
  for (const key of ['canonicalPath','title','description','h1','primaryIntent','publicationStatus']) {
    if (!s[key]) fail('SEO_REQUIRED',c,key);
  }
  if (!/^\/uslugi\/.+\/$/.test(s.canonicalPath || '')) fail('SEO_CANONICAL',c,s.canonicalPath);
  if (canonicals.has(s.canonicalPath)) fail('SEO_DUPLICATE_CANONICAL',c,s.canonicalPath);
  canonicals.set(s.canonicalPath,c.serviceCode);
  if ((s.title || '').length < 35 || (s.title || '').length > 75) warn('SEO_TITLE_LENGTH',c,String((s.title||'').length));
  if ((s.description || '').length < 100 || (s.description || '').length > 190) warn('SEO_DESCRIPTION_LENGTH',c,String((s.description||'').length));
  if (!Array.isArray(s.informationalQueries) || s.informationalQueries.length < 2) fail('SEO_INFO_QUERIES',c,'need >=2');
  if (!Array.isArray(s.infoBlocks) || s.infoBlocks.length < 2) fail('SEO_INFO_BLOCKS',c,'need >=2');
  if (!Array.isArray(s.faq) || s.faq.length < 3) fail('SEO_FAQ',c,'need >=3');
  if (s.indexable === true && s.publicationStatus !== 'APPROVED') fail('SEO_INDEX_GUARD',c,'indexable requires APPROVED');
  if (s.indexable === true && s.automation?.needsQueryResearch === true) fail('SEO_RESEARCH_GUARD',c,'indexable blocked until query research is completed');
  if (!Array.isArray(s.breadcrumbs) || s.breadcrumbs.length < 2) fail('SEO_BREADCRUMBS',c,'need >=2');
  const target = path.join(ROOT,s.canonicalPath.replace(/^\//,''),'index.html');
  if (fs.existsSync(target)) {
    const html = fs.readFileSync(target,'utf8');
    if (!html.includes(`<link rel="canonical" href="https://onsdelaet.ru${s.canonicalPath}">`)) fail('SEO_HTML_CANONICAL',c,'missing/mismatch');
    const expectedRobots = s.indexable ? 'index,follow' : 'noindex,follow';
    if (!html.includes(`<meta name="robots" content="${expectedRobots}">`)) fail('SEO_HTML_ROBOTS',c,expectedRobots);
    if (!html.includes('application/ld+json')) fail('SEO_STRUCTURED_DATA',c,'missing');
  } else {
    warn('SEO_HTML_NOT_GENERATED',c,target);
  }
}

for (const x of warnings) console.warn('WARN',x);
for (const x of errors) console.error('FAIL',x);
console.log(`SEO_QA categories=${categories.filter(x=>x.seo).length} warnings=${warnings.length} failures=${errors.length}`);
process.exit(errors.length ? 1 : 0);
