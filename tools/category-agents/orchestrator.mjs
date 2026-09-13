import fs from 'node:fs';
import path from 'node:path';
import {ROOT,json,runtime,worst} from './helpers.mjs';
import {categories,categoryById} from './manifest.mjs';
import {productionAgents,releaseController} from './registry.mjs';
export function loadProfiles(){return categories().map(c=>json(c.profile))}
export function runCategory(profile){const ctx={profile,runtime:runtime(),results:[]};for(const agent of productionAgents){const r=agent.run(ctx);ctx.results.push(r)}const release=releaseController.run(ctx);ctx.results.push(release);return{categoryId:profile.categoryId,serviceCode:profile.serviceCode,lifecycle:profile.status,overall:worst(ctx.results),agents:ctx.results,releaseDecision:release.summary}}
export function runAll(){return loadProfiles().map(runCategory)}
export function getProfile(id){const c=categoryById(id);if(!c)throw new Error(`Unknown category: ${id}`);if(!fs.existsSync(path.join(ROOT,c.profile)))throw new Error(`Missing profile for category: ${id}`);return json(c.profile)}
