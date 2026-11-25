import {randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,rename,rm,stat} from 'node:fs/promises';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';

const file=()=>process.env.PAYMENT_STORE_FILE||'/var/lib/sdelaet-payments/orders.json';

async function load(filename=file()){
  try{return JSON.parse(await readFile(filename,'utf8'))}
  catch(error){if(error.code==='ENOENT')return {};throw error}
}

async function save(filename,orders){
  const temporary=filename+'.'+randomUUID()+'.tmp';
  try{
    const original=await stat(filename).catch(error=>{if(error.code==='ENOENT')return null;throw error});
    await writeFile(temporary,JSON.stringify(orders,null,2),{mode:original?original.mode&0o777:0o666,flush:true});
    await rename(temporary,filename);
  }finally{await rm(temporary,{force:true})}
}

// Hold a SQLite writer lock on a sidecar file. OS locks are released when
// the connection closes or the writer dies. The data stays in JSON.
export async function withFileLock(filename,update,{timeoutMs=12000}={}){
  const deadline=Date.now()+timeoutMs;
  await mkdir(path.dirname(filename),{recursive:true});
  const lock=new DatabaseSync(filename+'.lock.sqlite');
  try{
    for(;;){
      try{lock.exec('BEGIN IMMEDIATE');break}
      catch(error){
        if((error.errcode&255)!==5)throw error;
        if(Date.now()>=deadline)throw Object.assign(new Error('PAYMENT_STORE_BUSY'),{code:'PAYMENT_STORE_BUSY',status:503});
        await delay(25);
      }
    }
    return await update();
  }finally{lock.close()}
}

export function withOrders(update){
  const filename=file();
  return withFileLock(filename,async ()=>{
    const orders=await load(filename);
    return update(orders,()=>save(filename,orders));
  });
}

export async function getOrder(id){const orders=await load();return Object.hasOwn(orders,id)?orders[id]:null}
export async function listOrders(){return Object.values(await load())}
