import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

function run(command, args = []) {
  try { return { ok: true, output: execFileSync(command, args, { encoding: 'utf8' }).trim() }; }
  catch (error) { return { ok: false, output: String(error?.stdout || error?.stderr || error?.message || error).trim() }; }
}

const checks = [];
for (const file of ['/etc/sdelaet/api.env', '/etc/sdelaet/telegram.env']) {
  if (!fs.existsSync(file)) { checks.push({ check: `env:${file}`, ok: false, detail: 'missing' }); continue; }
  const stat = fs.statSync(file);
  const mode = stat.mode & 0o777;
  checks.push({ check: `env:${file}`, ok: mode === 0o600 || mode === 0o640, detail: mode.toString(8) });
}

const nginx = run('nginx', ['-t']);
checks.push({ check: 'nginx_config', ok: nginx.ok, detail: nginx.output });
for (const service of ['sdelaet-api', 'sdelaet-followups.service']) {
  const state = run('systemctl', ['is-active', service]);
  const enabled = run('systemctl', ['is-enabled', service]);
  checks.push({ check: `service:${service}:active`, ok: state.output === 'active', detail: state.output });
  checks.push({ check: `service:${service}:enabled`, ok: enabled.output === 'enabled' || service === 'sdelaet-followups.service', detail: enabled.output });
}

const dbPath = '/var/lib/sdelaet/db/sdelaet.sqlite';
checks.push({ check: 'database_exists', ok: fs.existsSync(dbPath), detail: dbPath });
console.table(checks.map(x => ({ check: x.check, ok: x.ok, detail: String(x.detail).slice(0, 100) })));
const failures = checks.filter(x => !x.ok);
console.log(JSON.stringify({ total: checks.length, failures: failures.length }, null, 2));
if (failures.length) process.exit(1);
