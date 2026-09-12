import fs from 'node:fs';
import path from 'node:path';
import {ROOT,json,profilePath,runtime,worst} from './helpers.mjs';
import {productionAgents,releaseController} from './registry.mjs';

export function loadProfiles(){const dir=path.join(ROOT,'assets/category-profiles');return fs.readdirSync(dir).filter(x=>x.endsWith('.json')).sort().map(x=>json(`assets/category-profiles/${x}`))}
export function runCategory(profile){const ctx={profile,runtime:runtime(),results:[]};for(const agent of productionAgents){const r=agent.run(ctx);ctx.results.push(r)}const release=releaseController.run(ctx);ctx.results.push(release);return{categoryId:profile.categoryId,serviceCode:profile.serviceCode,lifecycle:profile.status,overall:worst(ctx.results),agents:ctx.results,releaseDecision:release.summary}}
export function runAll(){return loadProfiles().map(runCategory)}
export function getProfile(id){const p=profilePath(id);if(!fs.existsSync(path.join(ROOT,p)))throw new Error(`Unknown category: ${id}`);return json(p)}
