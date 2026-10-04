import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'config','service-categories.json'),'utf8'));
const categories=manifest.categories;
assert.equal(categories.length,71,'SEO taxonomy must contain 71 services');

const ids=new Set(categories.map((item)=>item.categoryId));
assert.equal(ids.size,71,'service category ids must be unique');

const titles=new Set(), descriptions=new Set();
for(const item of categories){
  const file=path.join(root,'uslugi',item.categoryId,'index.html');
  assert.ok(fs.existsSync(file),`missing SEO base page: ${item.categoryId}`);
  const html=fs.readFileSync(file,'utf8');
  const title=html.match(/<title>(.*?)<\/title>/)?.[1];
  const description=html.match(/<meta name="description" content="(.*?)">/)?.[1];
  assert.ok(title&&description&&html.includes('<h1>'),'title, description and h1 are required');
  assert.ok(html.includes(`rel="canonical" href="https://onsdelaet.ru/uslugi/${item.categoryId}/"`),'canonical is required');
  assert.ok(html.includes('"@type":"Service"')&&html.includes('"@type":"FAQPage"'),'structured data is required');
  assert.ok(!html.includes('noindex'),'SEO page must be indexable');
  titles.add(title); descriptions.add(description);
}
assert.equal(titles.size,71,'base titles must be unique');
assert.equal(descriptions.size,71,'base descriptions must be unique');

const locs=(xml)=>[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match)=>match[1]);
const sitemap=locs(fs.readFileSync(path.join(root,'sitemap.xml'),'utf8'));
const regional=locs(fs.readFileSync(path.join(root,'sitemap-regions.xml'),'utf8'));
assert.equal(sitemap.length,73,'main sitemap must contain 73 primary URLs');
assert.equal(new Set(sitemap).size,73,'main sitemap URLs must be unique');
assert.equal(regional.length,2059,'regional sitemap must contain 2059 URLs');
assert.equal(new Set(regional).size,2059,'regional sitemap URLs must be unique');
assert.ok(sitemap.includes('https://onsdelaet.ru/'),'root must be in sitemap');
assert.ok(sitemap.includes('https://onsdelaet.ru/uslugi/'),'service catalog must be in sitemap');

const baseUrls=sitemap.filter((url)=>/^https:\/\/onsdelaet\.ru\/uslugi\/[^/]+\/$/.test(url));
assert.equal(baseUrls.length,71,'sitemap must contain 71 base service URLs');
for(const id of ids) assert.ok(baseUrls.includes(`https://onsdelaet.ru/uslugi/${id}/`),`missing base sitemap URL: ${id}`);

const cells=new Set(), geos=new Set(), perService=new Map();
for(const url of regional){
  const match=url.match(/^https:\/\/onsdelaet\.ru\/uslugi\/([^/]+)\/([^/]+)\/$/);
  assert.ok(match,`invalid regional URL: ${url}`);
  const [,service,geo]=match;
  assert.ok(ids.has(service),`unknown service in regional sitemap: ${service}`);
  cells.add(`${service}/${geo}`);
  geos.add(geo);
  if(!perService.has(service))perService.set(service,new Set());
  perService.get(service).add(geo);
}
assert.equal(geos.size,29,'regional matrix must contain 29 geographies');
assert.equal(cells.size,2059,'regional matrix must contain 2059 unique cells');
for(const id of ids) assert.equal(perService.get(id)?.size,29,`service must cover 29 geographies: ${id}`);
for(const url of regional) assert.ok(!sitemap.includes(url),`regional URL must stay out of main sitemap: ${url}`);

const robots=fs.readFileSync(path.join(root,'robots.txt'),'utf8');
assert.match(robots,/Sitemap: https:\/\/onsdelaet\.ru\/sitemap\.xml/);
assert.doesNotMatch(robots,/Sitemap: https:\/\/onsdelaet\.ru\/sitemap-regions\.xml/,'regional sitemap must not be advertised');
assert.doesNotMatch(robots,/comparison\.html/,'obsolete comparison.html robots rule must not return');
for(const privatePage of ['compare.html','payment-success.html','payment-failed.html','review.html','requests.html','replies.html']){
  const html=fs.readFileSync(path.join(root,privatePage),'utf8');
  assert.match(html,/<meta name="robots" content="noindex,nofollow">/,privatePage+' must remain noindex,nofollow');
}
const generator=fs.readFileSync(path.join(root,'tools','generate-seo-pages.mjs'),'utf8');
assert.match(generator,/expectedRegional=manifest\.categories\.length\*29/,'SEO generator must preserve the regional matrix');
assert.match(generator,/urls\.length!==73/,'SEO generator must fail closed if the primary sitemap shape changes');
assert.match(generator,/sitemap-regions\.xml/,'SEO generator must preserve the regional route inventory source');

console.log('SEO category pages regression: 71 services / 29 geos / 73 primary sitemap URLs PASS');
