import fs from 'node:fs';

function ok(name,value){if(!value)throw new Error('FAIL '+name);console.log('PASS',name)}

const workflow=fs.readFileSync(new URL('../.github/workflows/deploy-search-api.yml',import.meta.url),'utf8');
const siteDeploy=fs.readFileSync(new URL('../.github/workflows/deploy-site-vds.yml',import.meta.url),'utf8');

ok('search api changes trigger dedicated deploy',workflow.includes("- 'search-api/**'"));
ok('workflow deploys exact github sha',workflow.includes("EXPECTED_SHA='$GITHUB_SHA'"));
ok('workflow keeps search api isolated',workflow.includes('TARGET=/opt/sdelaet/search-api'));
ok('workflow restarts only search api service',workflow.includes('SERVICE=sdelaet-search-api.service'));
ok('workflow requires configured yandex search',workflow.includes("get('yandexSearch') is True"));
ok('workflow runs real candidate smoke',workflow.includes('/v1/candidates/search'));
ok('workflow persists search runtime sha',workflow.includes('search-api.sha'));
ok('main site deploy does not pretend to deploy search api',!siteDeploy.includes("'search-api/**'"));

console.log('SEARCH API DEPLOY CONTRACT: PASS');
