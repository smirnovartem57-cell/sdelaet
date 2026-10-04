import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const source = process.env.SDELAET_DB_PATH || '/var/lib/sdelaet/db/sdelaet.sqlite';
const backupDir = process.env.SDELAET_DB_BACKUP_DIR || '/var/lib/sdelaet/db/backups';
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*$/, '').replace('T', '-');

if (!fs.existsSync(source)) throw new Error(`DB_NOT_FOUND:${source}`);
fs.mkdirSync(backupDir, { recursive: true });

const backup = path.join(backupDir, `sdelaet-${stamp}.sqlite`);
const restoreProbe = path.join(backupDir, `.restore-probe-${stamp}.sqlite`);

const db = new DatabaseSync(source);
db.exec(`VACUUM INTO '${backup.replaceAll("'", "''")}'`);
db.close();

fs.copyFileSync(backup, restoreProbe);
const restored = new DatabaseSync(restoreProbe, { readOnly: true });
const quick = restored.prepare('PRAGMA quick_check').get();
const tables = restored.prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`).all();
const required = ['tasks', 'clients', 'client_followups'];
const names = new Set(tables.map(x => x.name));
const missing = required.filter(x => !names.has(x));
const counts = {};
for (const name of required.filter(x => names.has(x))) counts[name] = restored.prepare(`SELECT COUNT(*) AS n FROM ${name}`).get().n;
restored.close();
fs.unlinkSync(restoreProbe);

const ok = quick?.quick_check === 'ok' && missing.length === 0;
console.log(JSON.stringify({ ok, source, backup, quick_check: quick?.quick_check || null, missing_required_tables: missing, counts }, null, 2));
if (!ok) process.exit(1);
