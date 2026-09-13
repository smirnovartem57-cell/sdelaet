import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'config','service-categories.json'),'utf8'));
const categories=manifest.categories.filter((item)=>item.serviceCode!=='BALCONY_INSULATION');
assert.equal(categories.length,70,'SEO generator must cover 70 non-balcony categories after expansion wave 4');
const titles=new Set(), descriptions=new Set();
for(const item of categories){
  const file=path.join(root,'uslugi',item.categoryId,'index.html');
  assert.ok(fs.existsSync(file),`missing SEO page: ${item.categoryId}`);
  const html=fs.readFileSync(file,'utf8');
  const title=html.match(/<title>(.*?)<\/title>/)?.[1];
  const description=html.match(/<meta name="description" content="(.*?)">/)?.[1];
  assert.ok(title&&description&&html.includes('<h1>'),'title, description and h1 are required');
  assert.ok(html.includes(`rel="canonical" href="https://onsdelaet.ru/uslugi/${item.categoryId}/"`),'canonical is required');
  assert.ok(html.includes('"@type":"Service"')&&html.includes('"@type":"FAQPage"'),'structured data is required');
  assert.ok(!html.includes('noindex'),'SEO page must be indexable');
  titles.add(title); descriptions.add(description);
}
assert.equal(titles.size,categories.length,'titles must be unique');
assert.equal(descriptions.size,categories.length,'descriptions must be unique');
const sitemap=fs.readFileSync(path.join(root,'sitemap.xml'),'utf8');
assert.equal((sitemap.match(/<url>/g)||[]).length,72,'sitemap must contain root, index and 70 category pages');
assert.ok(!sitemap.includes('/uslugi/balcony-insulation/'),'balcony insulation stays reserved');
assert.match(fs.readFileSync(path.join(root,'robots.txt'),'utf8'),/Sitemap: https:\/\/onsdelaet\.ru\/sitemap\.xml/);
console.log('SEO category pages regression: 70/70 PASS');
