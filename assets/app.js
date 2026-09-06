const SDELAET_JOB_KEY='sdelaet.job.v1';
const SDELAET_DB='sdelaet-mvp';
const SDELAET_STORE='files';

function sdOpenDb(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(SDELAET_DB,2);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(db.objectStoreNames.contains('jobFiles')) db.deleteObjectStore('jobFiles');
      if(!db.objectStoreNames.contains(SDELAET_STORE)) db.createObjectStore(SDELAET_STORE,{keyPath:'key'});
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}

async function sdSaveFiles(fileList,bucket='job'){
  const db=await sdOpenDb();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction(SDELAET_STORE,'readwrite');
    const store=tx.objectStore(SDELAET_STORE);
    const all=store.getAllKeys();
    all.onsuccess=()=>{
      (all.result||[]).filter(k=>String(k).startsWith(bucket+':')).forEach(k=>store.delete(k));
      Array.from(fileList||[]).forEach((file,i)=>store.put({key:bucket+':'+(i+1),bucket,id:String(i+1),name:file.name,type:file.type,size:file.size,blob:file}));
    };
    tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error);
  });
  db.close();
}

async function sdLoadFiles(bucket='job'){
  const db=await sdOpenDb();
  const rows=await new Promise((resolve,reject)=>{
    const tx=db.transaction(SDELAET_STORE,'readonly');
    const req=tx.objectStore(SDELAET_STORE).getAll();
    req.onsuccess=()=>resolve((req.result||[]).filter(x=>x.bucket===bucket)); req.onerror=()=>reject(req.error);
  });
  db.close();
  return rows;
}

async function sdRenderFiles(target,bucket='job'){
  const el=typeof target==='string'?document.getElementById(target):target;
  if(!el) return;
  const rows=await sdLoadFiles(bucket);
  el.innerHTML='';
  if(!rows.length){el.innerHTML='<div class="file-empty">Файлы пока не добавлены</div>';return;}
  rows.forEach(row=>{
    const card=document.createElement('div');card.className='file-preview';
    if(row.type&&row.type.startsWith('image/')){const img=document.createElement('img');img.src=URL.createObjectURL(row.blob);img.alt=row.name;card.appendChild(img);}else{const icon=document.createElement('div');icon.className='file-doc';icon.textContent='PDF';card.appendChild(icon);}
    const meta=document.createElement('div');meta.className='file-meta';meta.innerHTML='<b>'+row.name+'</b><span>'+Math.max(1,Math.round(row.size/1024))+' КБ</span>';card.appendChild(meta);el.appendChild(card);
  });
}

function sdSaveJob(data){localStorage.setItem(SDELAET_JOB_KEY,JSON.stringify(data))}
function sdLoadJob(){try{return JSON.parse(localStorage.getItem(SDELAET_JOB_KEY)||'{}')}catch(e){return{}}}
function sdSaveReply(candidate,data){localStorage.setItem('sdelaet.reply.'+candidate,JSON.stringify(data))}
function sdLoadReply(candidate){try{return JSON.parse(localStorage.getItem('sdelaet.reply.'+candidate)||'{}')}catch(e){return{}}}

window.Sdelaet={saveFiles:sdSaveFiles,loadFiles:sdLoadFiles,renderFiles:sdRenderFiles,saveJob:sdSaveJob,loadJob:sdLoadJob,saveReply:sdSaveReply,loadReply:sdLoadReply};

document.addEventListener('DOMContentLoaded',()=>{
  const dl=document.getElementById('regions');
  if(dl){['Республика Крым','Севастополь','Донецкая Народная Республика','Луганская Народная Республика','Запорожская область','Херсонская область'].forEach(name=>{if(![...dl.options].some(o=>o.value===name)){const o=document.createElement('option');o.value=name;dl.appendChild(o);}});}
});
