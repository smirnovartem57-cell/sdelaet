import {read,result} from '../helpers.mjs';
import {findById} from '../manifest.mjs';
export const meta={id:'OFFER_COMPARISON_ARCHITECT',name:'Offer Comparison Architect',stage:'TESTING'};
export function run(ctx){
  const p=ctx.profile,ev=[],act=[];
  const norm=read('assets/offer-normalizer.js'),follow=read('assets/offer-followup.js'),m=findById(p.categoryId);
  const baseline=p.serviceCode==='BALCONY_INSULATION';
  if(!baseline&&!norm.includes(p.serviceCode))act.push('Добавить category-specific normalizer rules.');else ev.push(baseline?'baseline normalizer path':'normalizer wired');
  if(!baseline&&!follow.includes(p.serviceCode))act.push('Добавить category-specific follow-up rules.');else ev.push(baseline?'baseline follow-up path':'follow-up wired');
  if(!m||!m.search||!Array.isArray(m.search.qualifyKeywords)||!m.search.qualifyKeywords.length)act.push('Добавить search qualification/config в manifest.');else ev.push('search wired via manifest');
  if(!p.normalization?.primaryMetric)act.push('Зафиксировать normalization.primaryMetric.');else ev.push(`primaryMetric=${p.normalization.primaryMetric}`);
  return result(meta.id,act.length?'BLOCK':'PASS',act.length?'Слой сравнения предложений неполный.':'Нормализация и уточнения подключены.',ev,act);
}
