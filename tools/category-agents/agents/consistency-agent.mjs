import {exists,result,runNode,read} from '../helpers.mjs';
import {categoryById} from '../manifest.mjs';
export const meta={id:'CATEGORY_CONSISTENCY_AGENT',name:'Category Consistency Agent',stage:'INTEGRATION'};
let auditCache=null;function audit(){if(!auditCache)auditCache=runNode('tests/category-system-audit-regression.mjs');return auditCache}
export function run(ctx){
  const p=ctx.profile,ev=[],act=[],m=categoryById(p.categoryId),strict=['TESTING','READY','ACTIVE','SEASONAL_PAUSE'].includes(p.status);
  const checks=[['manifest identity',!!m&&m.serviceCode===p.serviceCode&&m.status===p.status],['profile file',!!m&&exists(m.profile)],['expert model',!!m&&exists(m.expertModel)]];
  if(strict){const ar=audit();checks.push(['QA test',!!m?.qaTest&&exists(m.qaTest)],['E2E test',!!m?.e2eTest&&exists(m.e2eTest)],['generated runtime registry',read('assets/category-manifest.generated.js').includes(p.serviceCode)],['generated search registry',read('search-api/category-config.generated.mjs').includes(`"${p.categoryId}"`)],['actual system audit coverage',ar.ok&&ar.stdout.includes(`PASS ${p.serviceCode} profile identity`)],['manifest regression runner in CI',read('.github/workflows/deploy-site-vds.yml').includes('node tests/category-regression-manifest.mjs')]);}
  for(const [name,ok] of checks){if(ok)ev.push(name);else act.push(`Исправить ${name} для ${p.serviceCode}.`)}
  return act.length?result(meta.id,'BLOCK','Manifest/runtime/tests/source-of-truth рассинхронизированы.',ev,act):result(meta.id,'PASS',strict?'Manifest/runtime/tests/source-of-truth согласованы.':'RESEARCH зарегистрирован в manifest; production wiring будет обязательным с TESTING.',ev,[]);
}
