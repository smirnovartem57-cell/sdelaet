import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir=mkdtempSync(join(tmpdir(),'sdelaet-server-runtime-'));
const db=join(dir,'test.sqlite');
const child=spawn(process.execPath,['src/server.mjs'],{
  cwd:new URL('..',import.meta.url),
  env:{...process.env,HOST:'127.0.0.1',PORT:'0',DB_PATH:db},
  stdio:['ignore','pipe','pipe'],
});

let stdout='',stderr='',settled=false;
const cleanup=()=>{try{child.kill('SIGTERM')}catch{};setTimeout(()=>rmSync(dir,{recursive:true,force:true}),50)};
const result=await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{
    if(settled)return;
    settled=true;
    reject(new Error('SERVER_RUNTIME_START_TIMEOUT\n'+stderr));
  },8000);
  child.stdout.on('data',(chunk)=>{
    stdout+=chunk;
    if(!settled&&stdout.includes('Sdelaet API v0.2.0 listening')){
      settled=true;clearTimeout(timer);resolve(true);
    }
  });
  child.stderr.on('data',(chunk)=>{stderr+=chunk});
  child.on('exit',(code)=>{
    if(settled)return;
    settled=true;clearTimeout(timer);
    reject(new Error('SERVER_RUNTIME_EXIT_'+code+'\n'+stderr));
  });
});

assert.equal(result,true);
cleanup();
console.log('Server runtime wiring regression: PASS');
