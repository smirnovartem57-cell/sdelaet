import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'../..');
const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'config/service-categories.json'),'utf8'));
const categories=manifest.categories||[];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const absolute=p=>`https://onsdelaet.ru${p}`;

const hubs=new Map();
for(const c of categories){
  const crumbs=c.seo?.breadcrumbs||[];
  for(let i=0;i<crumbs.length-1;i++){
    const crumb=crumbs[i];
    if(!crumb?.path?.startsWith('/uslugi/')) continue;
    const hub=hubs.get(crumb.path)||{path:crumb.path,name:crumb.name,depth:i+1,children:new Map(),services:new Map()};
    const next=crumbs[i+1];
    if(i+1<crumbs.length-1&&next?.path) hub.children.set(next.path,next.name);
    if(i===crumbs.length-2) hub.services.set(c.seo.canonicalPath,c.title);
    hubs.set(crumb.path,hub);
  }
}

function breadcrumbsFor(hub){
  const sample=categories.find(c=>(c.seo?.breadcrumbs||[]).some(b=>b.path===hub.path));
  const crumbs=sample?.seo?.breadcrumbs||[];
  const idx=crumbs.findIndex(b=>b.path===hub.path);
  return idx>=0?crumbs.slice(0,idx+1):[{name:hub.name,path:hub.path}];
}
function targetFor(p){return path.join(ROOT,p.replace(/^\//,''),'index.html');}
function breadcrumbJson(items){return {'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:items.map((b,i)=>({'@type':'ListItem',position:i+1,name:b.name,item:absolute(b.path)}))};}
function nav(items){return items.map((b,i)=>i===items.length-1?`<span>${esc(b.name)}</span>`:`<a href="${esc(b.path)}">${esc(b.name)}</a>`).join('<i>›</i>');}

function copyFor(hub){
  if(hub.path==='/uslugi/') return {
    title:'Услуги — подбор и сравнение исполнителей | Сделает',
    h1:'Услуги: найти и сравнить исполнителей',
    intro:'Выберите направление задачи. «Сделает» помогает сформировать понятное ТЗ, получить предложения и сравнить их по одинаковым критериям.',
    blocks:[['Как выбрать нужную услугу','Начните с результата, который хотите получить. Если точное название работ неизвестно, описание задачи можно уточнить уже внутри сервиса.'],['Почему полезно сравнивать одинаковые ТЗ','Одинаковое описание задачи уменьшает расхождения в сметах и помогает сравнить состав работ, материалы, исключения и доплаты.']]
  };
  if(hub.path==='/uslugi/remont/') return {
    title:'Ремонт и работы по дому — подбор исполнителей | Сделает',
    h1:'Ремонт и работы по дому',
    intro:'Задачи по ремонту удобно сравнивать не только по цене: важны состав работ, исходное состояние объекта, материалы, сроки и возможные дополнительные работы.',
    blocks:[['Сначала определите результат','Для предварительного расчёта достаточно описать, что нужно получить, приложить фото и указать известные ограничения. Технические детали можно уточнить позже.'],['Сравнивайте состав работ','Дешёвая смета может отличаться не ценой, а отсутствующими работами. Поэтому сравнение должно учитывать материалы, подготовку, доставку, демонтаж и исключения.']]
  };
  return {
    title:`${hub.name} — услуги и подбор исполнителей | Сделает`,
    h1:hub.name,
    intro:`Выберите конкретную задачу в разделе «${hub.name}». Для каждой услуги «Сделает» помогает подготовить единое ТЗ и сравнить предложения исполнителей.`,
    blocks:[['Что уточнить перед обращением','Зафиксируйте желаемый результат, текущее состояние, фотографии и ограничения объекта. Это помогает получить более сопоставимые предложения.'],['Как сравнивать предложения','Смотрите не только на итоговую цену, но и на состав работ, материалы, исключения, доплаты, сроки и гарантию.']]
  };
}

function render(hub){
  const copy=copyFor(hub); const crumbs=breadcrumbsFor(hub);
  const links=[...hub.children.entries(),...hub.services.entries()];
  const cards=links.map(([href,name])=>`<a class="hub-card" href="${esc(href)}"><b>${esc(name)}</b><span>Открыть →</span></a>`).join('');
  const blocks=copy.blocks.map(([h,p])=>`<article><h2>${esc(h)}</h2><p>${esc(p)}</p></article>`).join('');
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><title>${esc(copy.title)}</title><meta name="description" content="${esc(copy.intro)}"><link rel="canonical" href="${absolute(hub.path)}"><link rel="stylesheet" href="/assets/prod-ui.css"><script type="application/ld+json">${JSON.stringify(breadcrumbJson(crumbs)).replace(/</g,'\\u003c')}</script><style>.hub{padding:34px 0 64px}.breadcrumbs{display:flex;gap:7px;flex-wrap:wrap;color:#74809b;font-size:12px;margin-bottom:18px}.breadcrumbs i{font-style:normal}.hub-hero{padding:32px;border:1px solid var(--line);border-radius:28px;background:#fff;box-shadow:var(--shadow)}.hub-hero h1{font-size:42px;line-height:1.05;margin:0 0 12px}.hub-hero p{max-width:820px;color:var(--muted);font-size:17px}.hub-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:28px}.hub-card{display:flex;flex-direction:column;gap:10px;border:1px solid var(--line);border-radius:18px;background:#fff;padding:18px;color:inherit;text-decoration:none}.hub-card span{color:var(--blue)}.hub-info{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:34px}.hub-info article{border:1px solid var(--line);border-radius:18px;background:#fff;padding:20px}.hub-info h2{font-size:18px;margin:0 0 8px}.hub-info p{margin:0;color:var(--muted)}@media(max-width:800px){.hub-grid,.hub-info{grid-template-columns:1fr}.hub-hero h1{font-size:34px}}</style></head><body><header class="site-header"><div class="site-header-inner"><a class="brand" href="/"><img src="/assets/logo-icon.svg" alt=""><div>Сдела<span>ет</span></div></a><a class="btn primary" href="/create-task.html">Описать задачу →</a></div></header><main class="hub"><div class="site-wrap"><nav class="breadcrumbs">${nav(crumbs)}</nav><section class="hub-hero"><h1>${esc(copy.h1)}</h1><p>${esc(copy.intro)}</p></section><section class="hub-grid">${cards}</section><section class="hub-info">${blocks}</section></div></main></body></html>`;
}

let count=0;
for(const hub of [...hubs.values()].sort((a,b)=>a.path.localeCompare(b.path,'ru'))){
  if(!hub.children.size&&!hub.services.size) continue;
  const target=targetFor(hub.path); fs.mkdirSync(path.dirname(target),{recursive:true}); fs.writeFileSync(target,render(hub),'utf8');
  console.log(`SEO_HUB_GENERATED ${hub.path} links=${hub.children.size+hub.services.size} indexable=false`); count++;
}
console.log(`SEO_HUBS_GENERATED=${count}`);
