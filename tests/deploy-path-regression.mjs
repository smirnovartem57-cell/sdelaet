import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/deploy-site-vds.yml', import.meta.url), 'utf8');
const deploy = readFileSync(new URL('../ops/sdelaet-deploy-main.sh', import.meta.url), 'utf8');
const service = readFileSync(new URL('../ops/systemd/sdelaet-main-deploy.service', import.meta.url), 'utf8');
const timer = readFileSync(new URL('../ops/systemd/sdelaet-main-deploy.timer', import.meta.url), 'utf8');

for (const secret of ['VDS_HOST', 'VDS_USER', 'VDS_SSH_KEY']) {
  assert.ok(!workflow.includes(secret), `legacy SSH secret leaked into workflow: ${secret}`);
}

assert.match(workflow, /deploy-version\.txt/);
assert.match(workflow, /GITHUB_SHA/);
assert.match(workflow, /tests\/metrika-goals-regression\.mjs/);
assert.match(workflow, /tests\/deploy-path-regression\.mjs/);

assert.match(deploy, /git ls-remote/);
assert.match(deploy, /tools\/platform-readiness\.mjs/);
assert.match(deploy, /tests\/metrika-goals-regression\.mjs/);
assert.match(deploy, /DEPLOY_BACKUP=/);
assert.match(deploy, /DEPLOY_PASS sha=/);
assert.match(deploy, /DEPLOY_API_HEALTH_TIMEOUT/);
assert.match(deploy, /seq 1 20/);
assert.match(deploy, /assets\/deploy-version\.txt/);

assert.match(service, /ExecStart=\/usr\/local\/sbin\/sdelaet-deploy-main/);
assert.match(timer, /OnUnitActiveSec=60s/);
assert.match(timer, /Persistent=true/);

console.log('Deploy path regression: PASS');
