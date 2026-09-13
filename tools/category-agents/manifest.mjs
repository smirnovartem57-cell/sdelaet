import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from './helpers.mjs';
const MANIFEST=path.join(ROOT,'config/service-categories.json');
export function loadManifest(){return JSON.parse(fs.readFileSync(MANIFEST,'utf8'))}
export function categories(){return loadManifest().categories||[]}
export function categoryById(id){return categories().find(x=>x.categoryId===id)||null}
export const findById=categoryById;
export function categoryByCode(code){return categories().find(x=>x.serviceCode===code)||null}
export function assertManifest(){const list=categories(),ids=new Set(),codes=new Set();for(const c of list){if(!c.categoryId||!c.serviceCode)throw new Error('Manifest category missing identity');if(ids.has(c.categoryId))throw new Error('Duplicate categoryId '+c.categoryId);if(codes.has(c.serviceCode))throw new Error('Duplicate serviceCode '+c.serviceCode);ids.add(c.categoryId);codes.add(c.serviceCode)}return list}
