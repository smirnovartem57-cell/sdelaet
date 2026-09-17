import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';

const file=()=>process.env.PAYMENT_STORE_FILE||'/var/lib/sdelaet-payments/orders.json';
async function load(){try{return JSON.parse(await readFile(file(),'utf8'))}catch(e){if(e.code==='ENOENT')return{};throw e}}
async function save(data){const f=file();await mkdir(path.dirname(f),{recursive:true});const tmp=f+'.tmp';await writeFile(tmp,JSON.stringify(data,null,2));await rename(tmp,f)}

export async function putOrder(order){const all=await load();all[order.id]=order;await save(all);return order}
export async function getOrder(id){const all=await load();return all[id]||null}
export async function patchOrder(id,patch){const all=await load();if(!all[id])return null;all[id]={...all[id],...patch,updatedAt:new Date().toISOString()};await save(all);return all[id]}
