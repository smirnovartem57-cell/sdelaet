import {spawnSync} from'node:child_process';
import path from'node:path';
import {ROOT} from'./helpers.mjs';
const a=process.argv.slice(2),out=[];
for(let i=0;i<a.length;i++){if(a[i]==='--name')out.push('--title');else out.push(a[i])}
console.warn('scaffold.mjs is compatibility mode; use create-category.mjs for new categories.');
const r=spawnSync(process.execPath,[path.join(ROOT,'tools/category-agents/create-category.mjs'),...out],{stdio:'inherit'});process.exit(r.status??1);
