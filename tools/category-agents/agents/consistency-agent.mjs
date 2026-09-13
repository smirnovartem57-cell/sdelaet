import {read,exists,result,runNode} from '../helpers.mjs';
export const meta={id:'CATEGORY_CONSISTENCY_AGENT',name:'Category Consistency Agent',stage:'INTEGRATION'};
function count(hay,needle){return hay.split(needle).length-1}
export function run(ctx){
  const p=ctx.profile,ev=[],act=[];
  const launch=read('assets/launch-v2.js'),search=read('search-api/core.mjs'),life=read('tests/category-lifecycle-regression.mjs'),wire=read('tests/production-category-wiring-regression.mjs'),qual=read('tests/search-qualification-regression.mjs');
  const state=read('docs/product/PROJECT_STATE.md'),taxonomy=read('docs/product/SERVICE_TAXONOMY.md'),workflow=read('.github/workflows/deploy-site-vds.yml');
  const qualCases=qual.slice(qual.indexOf('const cases=['),qual.indexOf('const bad='));
  const auditRun=runNode('tests/category-system-audit-regression.mjs'),qa=`node tests/${p.categoryId}-qa-regression.mjs`,e2e=`node tests/${p.categoryId}-e2e-regression.mjs`;
  const checks=[
    ['launch wiring',launch.includes(p.serviceCode)],['unique search config',count(search,`'${p.categoryId}':`)===1],
    ['lifecycle registry',life.includes(`${p.categoryId}.json`)],['production wiring test',wire.includes(p.serviceCode)&&wire.includes(p.categoryId)],
    ['unique search qualification case',count(qualCases,`'${p.categoryId}'`)===1],['actual system audit coverage',auditRun.ok&&auditRun.stdout.includes(`PASS ${p.serviceCode} profile identity`)],
    ['expert model',exists(`docs/product/EXPERT_MODELS/${p.serviceCode}.md`)],['unique PROJECT_STATE row',count(state,`- \`${p.serviceCode}\``)===1],
    ['unique SERVICE_TAXONOMY row',count(taxonomy,`| \`${p.serviceCode}\` |`)===1],['unique CI QA command',p.categoryId==='balcony-insulation'||count(workflow,qa)===1],
    ['unique CI E2E command',p.categoryId==='balcony-insulation'||count(workflow,e2e)===1]
  ];
  for(const [name,ok] of checks){if(ok)ev.push(name);else act.push(`Исправить ${name} для ${p.serviceCode}.`)}
  return act.length?result(meta.id,'BLOCK','Категория не полностью или неоднозначно синхронизирована между runtime, search, tests, CI и source-of-truth.',ev,act):result(meta.id,'PASS','Runtime/search/tests/CI/source-of-truth согласованы и уникальны.',ev,[]);
}