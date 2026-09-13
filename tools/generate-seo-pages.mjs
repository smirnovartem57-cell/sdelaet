import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'config','service-categories.json'),'utf8'));
const excluded=new Set(['BALCONY_INSULATION']);
const categories=manifest.categories.filter((item)=>!excluded.has(item.serviceCode));
const baseUrl='https://onsdelaet.ru';
const lastmod=process.env.SEO_LASTMOD||'2026-09-13';
const esc=(v)=>String(v??'').replace(/[&<>"']/g,(ch)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const readProfile=(item)=>JSON.parse(fs.readFileSync(path.join(root,item.profile),'utf8'));
const words=(item)=>[...(item.search?.keywords||[]),...(item.search?.qualifyKeywords||[])].map((x)=>String(x).toLowerCase());
const related=(item)=>categories.filter((other)=>other!==item).map((other)=>({other,score:words(item).filter((word)=>words(other).some((candidate)=>candidate.includes(word)||word.includes(candidate))).length})).sort((a,b)=>b.score-a.score||a.other.title.localeCompare(b.other.title,'ru')).slice(0,4).map((x)=>x.other);
const faq=(item)=>[
  {q:`Как сравнивать предложения на «${item.title.toLowerCase()}»?`,a:'Сравнивайте одинаковый состав работ: итоговую цену, материалы, подготовку, дополнительные расходы, сроки и гарантию. Цена «от» без состава работ не считается сопоставимой.'},
  {q:'Можно ли выбрать только по минимальной цене?',a:'Нет. Более дешёвое предложение может не включать обязательные работы, материалы, доставку или демонтаж. Сначала нужно привести ответы исполнителей к одинаковому объёму.'},
  {q:'Зачем нужен осмотр или замер?',a:'Часть технических параметров нельзя достоверно определить по описанию. Замер нужен, чтобы подтвердить состояние объекта и зафиксировать итоговый объём до начала работ.'}
];

function render(item){
  const profile=readProfile(item), rel=related(item), questions=profile.siteInspectionOnly||[];
  const title=`${item.title} в Москве и МО — найти и сравнить исполнителей | Сделает`;
  const description=`Подготовим понятное ТЗ на ${item.title.toLowerCase()}, найдём исполнителей в Москве и Московской области и поможем сравнить цену, состав работ, сроки и гарантию.`;
  const url=`${baseUrl}/uslugi/${item.categoryId}/`;
  const schema={'@context':'https://schema.org','@graph':[
    {'@type':'Service','name':item.title,'serviceType':item.title,'areaServed':['Москва','Московская область'],'provider':{'@type':'Organization','name':'Сделает','url':baseUrl},'url':url},
    {'@type':'BreadcrumbList','itemListElement':[{'@type':'ListItem','position':1,'name':'Сделает','item':baseUrl+'/'},{'@type':'ListItem','position':2,'name':'Услуги','item':baseUrl+'/uslugi/'},{'@type':'ListItem','position':3,'name':item.title,'item':url}]},
    {'@type':'FAQPage','mainEntity':faq(item).map((x)=>({'@type':'Question','name':x.q,'acceptedAnswer':{'@type':'Answer','text':x.a}}))}
  ]};
  const queryList=[...(item.search?.companyQueries||[]),...(item.search?.privateQueries||[])].slice(0,5);
  const inspection=questions.length?questions:['состояние основания и доступ к месту работ','точные размеры и фактический объём','скрытые дефекты и примыкания'];
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${url}">
<meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${url}">
<link rel="icon" href="../../assets/logo-icon.svg" type="image/svg+xml"><link rel="stylesheet" href="../../assets/prod-ui.css"><link rel="stylesheet" href="../../assets/seo-pages.css">
<script type="application/ld+json">${JSON.stringify(schema).replace(/</g,'\\u003c')}</script></head><body>
<header class="site-header"><div class="site-header-inner"><a class="brand" href="/"><img src="../../assets/logo-icon.svg" alt=""><div>Сдела<span>ет</span></div></a><nav class="site-nav"><a href="/#how">Как работает</a><a href="/#pricing">Тарифы</a></nav><a class="btn primary" href="../../create-task.html">Описать задачу →</a></div></header>
<main><div class="seo-wrap"><nav class="breadcrumbs"><a href="/">Главная</a><span>›</span><a href="../">Услуги</a><span>›</span><b>${esc(item.title)}</b></nav>
<section class="seo-hero"><div class="eyebrow">Москва и Московская область</div><h1>${esc(item.title)}: найти и сравнить исполнителей</h1><p>${esc(description)}</p><div class="hero-actions"><a class="btn primary large" href="../../create-task.html">Подготовить задачу →</a><a class="btn secondary large" href="#checklist">Что сравнивать</a></div></section>
<section class="seo-grid" id="checklist"><article class="seo-card"><div class="eyebrow">Сопоставимая смета</div><h2>Что запросить у каждого исполнителя</h2><ul><li>фиксированную итоговую цену после замера;</li><li>полный состав включённых работ и материалов;</li><li>отдельно доставку, подъём и демонтаж;</li><li>возможные дополнительные расходы;</li><li>срок начала и продолжительность работ;</li><li>гарантию, договор и порядок приёмки.</li></ul></article>
<article class="seo-card"><div class="eyebrow">Проверяется на объекте</div><h2>Что нельзя надёжно определить заочно</h2><ul>${inspection.map((x)=>`<li>${esc(x)}</li>`).join('')}</ul></article></section>
<section class="seo-section"><div class="eyebrow">Поиск исполнителей</div><h2>Какие специализации подходят для задачи</h2><div class="seo-chips">${queryList.map((x)=>`<span>${esc(x)}</span>`).join('')}</div><p>«Сделает» ищет по нескольким открытым источникам, отделяет подтверждённые сведения от заявленных и показывает неизвестные данные и сигналы риска.</p></section>
<section class="seo-section"><div class="eyebrow">Почему предложения отличаются</div><h2>Сравниваем комплектацию, а не только цену</h2><p>Две цены по одной услуге могут относиться к разному объёму. В одном предложении уже учтены подготовка, материалы и обязательные операции, а в другом указана только базовая работа. Сервис формирует одинаковый запрос, выявляет пропуски и задаёт уточняющие вопросы до рекомендации.</p></section>
<section class="seo-section"><div class="eyebrow">Частые вопросы</div><h2>Перед выбором исполнителя</h2><div class="faq-list">${faq(item).map((x)=>`<details><summary>${esc(x.q)}</summary><p>${esc(x.a)}</p></details>`).join('')}</div></section>
<section class="seo-section"><div class="eyebrow">Смежные задачи</div><h2>Другие услуги ремонта</h2><div class="related-grid">${rel.map((x)=>`<a href="../${x.categoryId}/"><b>${esc(x.title)}</b><span>Подготовить ТЗ и сравнить предложения →</span></a>`).join('')}</div></section>
<section class="seo-cta"><h2>Опишите задачу своими словами</h2><p>Профессиональные термины не нужны. Сервис уточнит только то, что влияет на объём, цену и выбор исполнителя.</p><a class="btn primary large" href="../../create-task.html">Описать задачу →</a></section></div></main>
<footer class="footer-note">«Сделает» — независимый сервис подготовки задачи, поиска и сравнения предложений. Работы оплачиваются исполнителю напрямую.</footer></body></html>`;
}

const outRoot=path.join(root,'uslugi');
fs.mkdirSync(outRoot,{recursive:true});
for(const item of categories){
  const dir=path.join(outRoot,item.categoryId);
  fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'index.html'),render(item));
}
const indexCards=categories.map((item)=>`<a class="seo-list-card" href="./${item.categoryId}/"><b>${esc(item.title)}</b><span>Найти и сравнить исполнителей →</span></a>`).join('');
const index=`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Услуги ремонта — найти и сравнить исполнителей | Сделает</title><meta name="description" content="Категории ремонта и домашних работ в Москве и Московской области. Подготовка ТЗ, поиск исполнителей и сравнение предложений."><link rel="canonical" href="${baseUrl}/uslugi/"><link rel="stylesheet" href="../assets/prod-ui.css"><link rel="stylesheet" href="../assets/seo-pages.css"></head><body><header class="site-header"><div class="site-header-inner"><a class="brand" href="/"><img src="../assets/logo-icon.svg" alt=""><div>Сдела<span>ет</span></div></a><a class="btn primary" href="../create-task.html">Описать задачу →</a></div></header><main><div class="seo-wrap"><section class="seo-hero"><div class="eyebrow">Дом и ремонт</div><h1>Услуги ремонта: подготовить задачу и сравнить исполнителей</h1><p>Выберите направление или опишите проблему своими словами.</p></section><div class="seo-list">${indexCards}</div></div></main></body></html>`;
fs.writeFileSync(path.join(outRoot,'index.html'),index);
const urls=[baseUrl+'/',baseUrl+'/uslugi/',...categories.map((item)=>baseUrl+'/uslugi/'+item.categoryId+'/')];
const sitemap='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+urls.map((url)=>`  <url><loc>${url}</loc><lastmod>${lastmod}</lastmod></url>`).join('\n')+'\n</urlset>\n';
fs.writeFileSync(path.join(root,'sitemap.xml'),sitemap);
fs.writeFileSync(path.join(root,'robots.txt'),`User-agent: *\nAllow: /\n\nSitemap: ${baseUrl}/sitemap.xml\n`);
console.log(`SEO pages generated: ${categories.length} categories + index; BALCONY_INSULATION reserved for parallel work.`);
