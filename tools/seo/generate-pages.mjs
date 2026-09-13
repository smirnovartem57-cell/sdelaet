import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const manifestPath = path.join(ROOT, 'config/service-categories.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const categories = Array.isArray(manifest) ? manifest : manifest.categories || [];

const only = process.argv.includes('--category')
  ? process.argv[process.argv.indexOf('--category') + 1]
  : null;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));
const json = value => JSON.stringify(value).replace(/</g, '\\u003c');
const absolute = p => `https://onsdelaet.ru${p}`;

function pageTarget(c) {
  const rel = c.seo.canonicalPath.replace(/^\//, '');
  return path.join(ROOT, rel, 'index.html');
}

function breadcrumbJson(c) {
  return {
    '@context':'https://schema.org', '@type':'BreadcrumbList',
    itemListElement:c.seo.breadcrumbs.map((b,i)=>({
      '@type':'ListItem', position:i+1, name:b.name, item:absolute(b.path)
    }))
  };
}
function faqJson(c) {
  return {
    '@context':'https://schema.org', '@type':'FAQPage',
    mainEntity:c.seo.faq.map(x=>({
      '@type':'Question', name:x.question,
      acceptedAnswer:{'@type':'Answer', text:[x.shortAnswer,x.details].filter(Boolean).join(' ')}
    }))
  };
}

function serviceJson(c) {
  return {
    '@context':'https://schema.org', '@type':'Service',
    name:c.title, serviceType:c.title,
    provider:{'@type':'Organization',name:'Сделает',url:'https://onsdelaet.ru/'},
    areaServed:{'@type':'Country',name:'Россия'},
    url:absolute(c.seo.canonicalPath),
    description:c.seo.description
  };
}

function nav(c) {
  return c.seo.breadcrumbs.map((b,i)=>
    i === c.seo.breadcrumbs.length-1
      ? `<span>${esc(b.name)}</span>`
      : `<a href="${esc(b.path)}">${esc(b.name)}</a>`
  ).join('<i>›</i>');
}
function renderInfoBlock(block) {
  const sections = (block.sections || []).map(x =>
    `<article class="seo-mini"><h3>${esc(x.title)}</h3><p>${esc(x.text)}</p></article>`
  ).join('');
  return `<section class="seo-section"><div class="section-head left"><div class="eyebrow">Полезно знать</div><h2>${esc(block.title)}</h2><p>${esc(block.shortAnswer)}</p></div><div class="seo-grid">${sections}</div></section>`;
}

function renderList(title, items, cls='check-list') {
  return `<section class="seo-section"><div class="section-head left"><h2>${esc(title)}</h2></div><div class="${cls}">${items.map(x=>`<div>${esc(x)}</div>`).join('')}</div></section>`;
}

function renderFaq(c) {
  return `<section class="seo-section"><div class="section-head left"><div class="eyebrow">Ответы на вопросы</div><h2>Частые вопросы об утеплении балкона</h2></div><div class="faq-list">${c.seo.faq.map(x=>`<details><summary>${esc(x.question)}</summary><p><strong>${esc(x.shortAnswer)}</strong></p>${x.details?`<p>${esc(x.details)}</p>`:''}</details>`).join('')}</div></section>`;
}

function related(c) {
  const map = new Map(categories.map(x=>[x.categoryId,x]));
  const items = (c.seo.relatedCategoryIds || []).map(id=>map.get(id)).filter(Boolean);
  if (!items.length) return '';
  return `<section class="seo-section"><div class="section-head left"><h2>Смежные задачи</h2></div><div class="related-grid">${items.map(x=>`<article><b>${esc(x.title)}</b><p>${esc(x.qualificationPhrase || '')}</p></article>`).join('')}</div></section>`;
}
function renderPage(c) {
  const s = c.seo;
  const robots = s.indexable ? 'index,follow' : 'noindex,follow';
  const info = (s.infoBlocks || []).map(renderInfoBlock).join('');
  const canonical = absolute(s.canonicalPath);
  const cta = `/create-task.html?category=${encodeURIComponent(c.categoryId)}`;
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="${robots}"><title>${esc(s.title)}</title><meta name="description" content="${esc(s.description)}"><link rel="canonical" href="${canonical}"><link rel="icon" href="/assets/logo-icon.svg" type="image/svg+xml"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800;900&family=Roboto:wght@400;500;700&display=swap" rel="stylesheet"><link rel="stylesheet" href="/assets/prod-ui.css"><style>
.seo-page{padding:34px 0 64px}.breadcrumbs{display:flex;gap:7px;flex-wrap:wrap;color:#74809b;font-size:12px;margin-bottom:18px}.breadcrumbs i{font-style:normal}.seo-hero{border:1px solid var(--line);border-radius:30px;background:radial-gradient(650px 280px at 85% 0,rgba(39,201,237,.13),transparent 65%),radial-gradient(550px 300px at 0 100%,rgba(91,85,245,.11),transparent 65%),#fff;padding:36px;box-shadow:var(--shadow)}.seo-hero h1{font:900 44px/1.04 Montserrat,Roboto,sans-serif;letter-spacing:-.045em;margin:8px 0 14px;max-width:880px}.seo-hero p{font-size:18px;color:var(--muted);max-width:800px}.seo-points{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:22px}.seo-points div,.seo-mini,.related-grid article{border:1px solid var(--line);border-radius:18px;background:#fff;padding:15px}.seo-section{padding:34px 0 0}.section-head.left{text-align:left;margin:0 0 16px;max-width:850px}.seo-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.seo-mini h3{font-size:16px;margin:0 0 7px}.seo-mini p{margin:0;color:var(--muted);font-size:14px}.check-list{display:grid;grid-template-columns:1fr 1fr;gap:9px}.check-list div{border:1px solid var(--line);border-radius:14px;padding:12px;background:#fff}.check-list div:before{content:'✓';color:var(--green);font-weight:900;margin-right:8px}.factor-list div:before{content:'→';color:var(--blue)}.faq-list{display:grid;gap:8px}.faq-list details{border:1px solid var(--line);border-radius:16px;background:#fff;padding:0 15px}.faq-list summary{font-weight:800;padding:14px 0;cursor:pointer}.faq-list p{color:var(--muted);margin:0 0 14px}.related-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.related-grid p{margin:5px 0 0;color:var(--muted);font-size:13px}.seo-cta{margin-top:38px;border-radius:25px;padding:28px;background:linear-gradient(135deg,#5d51f4,#2f7df8 55%,#27c9ed);color:#fff;display:flex;justify-content:space-between;align-items:center;gap:20px}.seo-cta h2{margin:0 0 5px;font-size:26px}.seo-cta p{margin:0;opacity:.88}.seo-cta .btn{background:#fff;color:#3946b9}@media(max-width:800px){.seo-points,.seo-grid,.related-grid,.check-list{grid-template-columns:1fr}.seo-hero{padding:24px}.seo-hero h1{font-size:34px}.seo-cta{display:block}.seo-cta .btn{margin-top:16px;width:100%}}
</style><script type="application/ld+json">${json(breadcrumbJson(c))}</script><script type="application/ld+json">${json(serviceJson(c))}</script><script type="application/ld+json">${json(faqJson(c))}</script></head><body>`;
}
function renderBody(c) {
  const s = c.seo;
  const cta = `/create-task.html?category=${encodeURIComponent(c.categoryId)}`;
  return `<header class="site-header"><div class="site-header-inner"><a class="brand" href="/"><img src="/assets/logo-icon.svg" alt=""><div>Сдела<span>ет</span></div></a><nav class="site-nav"><a href="#how">Что учесть</a><a href="#estimate">Смета</a><a href="#faq">Вопросы</a></nav><a class="btn primary" href="${cta}">Описать задачу →</a></div></header><main class="seo-page"><div class="site-wrap"><nav class="breadcrumbs" aria-label="Хлебные крошки">${nav(c)}</nav><section class="seo-hero"><div class="eyebrow">${esc(c.title)}</div><h1>${esc(s.h1)}</h1><p>${esc(s.description)}</p><div class="hero-actions"><a class="btn primary large" href="${cta}">Подготовить задачу бесплатно →</a></div><div class="seo-points"><div><b>Опишите задачу своими словами</b><br><span class="muted">Не нужно заранее знать технологию и материалы.</span></div><div><b>Получите одинаковое ТЗ</b><br><span class="muted">Исполнителям проще дать сопоставимые предложения.</span></div><div><b>Сравните не только цену</b><br><span class="muted">Проверяем состав работ, исключения и возможные доплаты.</span></div></div></section><div id="how">${renderInfoBlock(s.infoBlocks[0])}</div><div id="estimate">${renderInfoBlock(s.infoBlocks[1])}</div>${renderList('Что проверить в смете',s.quoteChecklist)}${renderList('Что влияет на стоимость',s.costFactors,'check-list factor-list')}<div id="faq">${renderFaq(c)}</div>${related(c)}<section class="seo-cta"><div><h2>Не хотите разбираться во всём самостоятельно?</h2><p>Опишите, какой результат нужен. «Сделает» структурирует задачу и подготовит ТЗ.</p></div><a class="btn large" href="${cta}">Описать задачу →</a></section></div></main><footer class="footer-note">Информация носит справочный характер. Техническое решение для конкретного объекта уточняется после осмотра, когда это необходимо.</footer></body></html>`;
}

function validate(c) {
  const s = c.seo || {};
  const required = ['canonicalPath','title','description','h1','primaryIntent'];
  for (const key of required) if (!s[key]) throw new Error(`SEO_REQUIRED ${c.serviceCode} ${key}`);
  if (!Array.isArray(s.infoBlocks) || s.infoBlocks.length < 2) throw new Error(`SEO_INFO_BLOCKS ${c.serviceCode}`);
  if (!Array.isArray(s.faq) || s.faq.length < 3) throw new Error(`SEO_FAQ ${c.serviceCode}`);
  if (s.indexable === true && s.publicationStatus !== 'APPROVED') throw new Error(`SEO_INDEX_GUARD ${c.serviceCode}`);
}

function build(c) {
  if (!c.seo?.canonicalPath) return false;
  validate(c);
  const target = pageTarget(c);
  fs.mkdirSync(path.dirname(target), { recursive:true });
  fs.writeFileSync(target, renderPage(c) + renderBody(c), 'utf8');
  console.log(`SEO_PAGE_GENERATED ${c.serviceCode} ${c.seo.canonicalPath} indexable=${Boolean(c.seo.indexable)}`);
  return true;
}

const canonicalOwners = new Map();
for (const c of categories.filter(x=>x.seo?.canonicalPath)) {
  const canonical = c.seo.canonicalPath;
  if (canonicalOwners.has(canonical)) throw new Error(`SEO_DUPLICATE_CANONICAL ${canonical}`);
  canonicalOwners.set(canonical,c.serviceCode);
}

const selected = only
  ? categories.filter(c => c.categoryId === only || c.serviceCode === only)
  : categories.filter(c => c.seo?.canonicalPath);
if (only && selected.length !== 1) {
  console.error(`CATEGORY_NOT_FOUND ${only}`);
  process.exit(2);
}
let count = 0;
for (const c of selected) if (build(c)) count++;
console.log(`SEO_PAGES_GENERATED=${count}`);
