import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT,'config/service-categories.json'),'utf8'));
const categories = Array.isArray(data) ? data : data.categories || [];
const urls = categories
  .filter(c => c.seo?.indexable === true && c.seo?.publicationStatus === 'APPROVED' && c.seo?.canonicalPath)
  .map(c => ({loc:`https://onsdelaet.ru${c.seo.canonicalPath}`,lastmod:c.seo.reviewedAt || new Date().toISOString().slice(0,10)}));
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(x=>`  <url><loc>${x.loc}</loc><lastmod>${x.lastmod}</lastmod></url>`).join('\n')}\n</urlset>\n`;
fs.writeFileSync(path.join(ROOT,'sitemap-seo.xml'),xml,'utf8');
console.log(`SEO_SITEMAP_URLS=${urls.length}`);
