import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';

export const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(.:)/,'$1')),'../..');
export function read(rel){return fs.readFileSync(path.join(ROOT,rel),'utf8')}
export function exists(rel){return fs.existsSync(path.join(ROOT,rel))}
export function json(rel){return JSON.parse(read(rel))}
export function result(agent,status,summary,evidence=[],actions=[]){return{agent,status,summary,evidence,actions}}
export function worst(results){return results.some(x=>x.status==='BLOCK')?'BLOCK':results.some(x=>x.status==='WARN')?'WARN':'PASS'}
export function runNode(rel){const r=spawnSync(process.execPath,[path.join(ROOT,rel)],{encoding:'utf8'});return{ok:r.status===0,status:r.status,stdout:r.stdout||'',stderr:r.stderr||''}}
export function runtime(){const ctx={window:{}};vm.createContext(ctx);for(const f of ['assets/category-engine.js','assets/expert-agent.js'])vm.runInContext(read(f),ctx);return ctx.window}
export function profilePath(id){return`assets/category-profiles/${id}.json`}
export function expertModelPath(code){return`docs/product/EXPERT_MODELS/${code}.md`}
