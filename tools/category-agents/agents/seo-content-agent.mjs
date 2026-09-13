import {categoryById} from '../manifest.mjs';
import {result} from '../helpers.mjs';

export const meta={id:'SEO_CONTENT_AGENT',name:'SEO Content Agent',stage:'SEO'};

export function run(ctx){
  const entry=categoryById(ctx.profile.categoryId);
  const seo=entry?.seo||{};
  const ev=[],act=[];
  if(!seo.canonicalPath) act.push('Сформировать canonicalPath для категории.'); else ev.push(`canonical=${seo.canonicalPath}`);
  if(!seo.title||!seo.description||!seo.h1) act.push('Заполнить title, description и H1.'); else ev.push('meta present');
  if((seo.infoBlocks||[]).length<2) act.push('Добавить минимум два информационных intent-блока.'); else ev.push('infoBlocks>=2');
  if((seo.faq||[]).length<4) act.push('Добавить минимум четыре answer/FAQ блока.'); else ev.push('faq>=4');
  if(seo.indexable===true && seo.publicationStatus!=='APPROVED') act.push('Запретить индексацию до APPROVED.');
  if(seo.automation?.needsQueryResearch) act.push('Провести SEO query research перед APPROVED/indexable.');
  const hard=act.filter(x=>!x.startsWith('Провести SEO query research'));
  const status=hard.length?'BLOCK':'PASS';
  return result(meta.id,status,status==='PASS'?'SEO draft формально готов; research может оставаться задачей до публикации.':'SEO contract неполный.',ev,act);
}
