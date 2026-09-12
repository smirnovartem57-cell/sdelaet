import {read,exists,result} from '../helpers.mjs';
export const meta={id:'CATEGORY_CONSISTENCY_AGENT',name:'Category Consistency Agent',stage:'INTEGRATION'};
export function run(ctx){
  const p=ctx.profile,ev=[],act=[];
  const launch=read('assets/launch-v2.js'),search=read('search-api/core.mjs'),life=read('tests/category-lifecycle-regression.mjs'),wire=read('tests/production-category-wiring-regression.mjs'),qual=read('tests/search-qualification-regression.mjs');
  const checks=[
    ['launch wiring',launch.includes(p.serviceCode)],
    ['search config',search.includes(`'${p.categoryId}'`)],
    ['lifecycle registry',life.includes(`${p.categoryId}.json`)],
    ['production wiring test',wire.includes(p.serviceCode)&&wire.includes(p.categoryId)],
    ['search qualification case',qual.includes(`'${p.categoryId}'`)],
    ['expert model',exists(`docs/product/EXPERT_MODELS/${p.serviceCode}.md`)]
  ];
  for(const [name,ok] of checks){if(ok)ev.push(name);else act.push(`Исправить ${name} для ${p.serviceCode}.`)}
  return act.length?result(meta.id,'BLOCK','Категория не полностью синхронизирована между runtime, search и test registry.',ev,act):result(meta.id,'PASS','Runtime/search/lifecycle/qualification/test wiring согласованы.',ev,[]);
}
