(function(){
'use strict';
var API='https://api.onsdelaet.ru';
function track(name,extra){if(window.sdTrack)sdTrack(name,extra||{})}
async function api(path,options){
  var r=await fetch(API+path,Object.assign({credentials:'include',headers:{'content-type':'application/json'}},options||{}));
  var d=await r.json().catch(function(){return{}});
  if(!r.ok){var e=new Error(d.error||'REQUEST_FAILED');e.status=r.status;throw e}
  return d;
}
function safeReturn(){
  var value=location.pathname+location.search+location.hash;
  return value.charAt(0)==='/'&&!value.startsWith('//')?value:'/my-tasks.html';
}
async function syncAccountRegion(){
  try{
    var d=await api('/v1/account/profile'),p=d.profile||{},local=window.sdGetRegionPreference?sdGetRegionPreference():null;
    if(p.geo||p.region){
      if(window.sdSetRegionPreference)sdSetRegionPreference({label:p.region||((p.geo&&p.geo.canonicalLocality)||(p.geo&&p.geo.canonicalRegion)||''),geo:p.geo||null,manual:true,updatedAt:p.updatedAt?Date.parse(p.updatedAt):Date.now()});
    }else if(local&&local.manual&&local.label){
      await api('/v1/account/profile',{method:'POST',body:JSON.stringify({region:local.label,geo:local.geo||null})});
    }
  }catch(e){}
}
async function requireAuth(){
  var r=await fetch(API+'/v1/auth/session',{credentials:'include'}),d=await r.json().catch(function(){return{}});
  if(!d.authenticated){location.replace('/?login=1&return='+encodeURIComponent(safeReturn()));throw new Error('AUTH_REQUIRED')}
  document.querySelectorAll('[data-account-email]').forEach(function(x){x.textContent=d.user&&d.user.email||''});
  await syncAccountRegion();
  return d.user;
}
function fmtDate(v){
  if(!v)return '—';var d=new Date(v);if(Number.isNaN(d.getTime()))return '—';
  return new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'short',year:'numeric'}).format(d);
}
function money(v){return Number(v||0).toLocaleString('ru-RU')+' ₽'}
async function resumeTask(taskId){
  track('task_resume',{task_id:taskId});
  var d=await api('/v1/account/tasks/'+encodeURIComponent(taskId));
  var t=d.task&&d.task.taskJson||{};
  if(!t.id)t.id=taskId;
  localStorage.setItem('sdelaet.task.v2',JSON.stringify(t));
  localStorage.setItem('sdelaet.draft_task_id.v1',taskId);
  location.href='/create-task.html?edit=1';
}
function newTask(){
  track('new_task_from_account');
  localStorage.removeItem('sdelaet.task.v2');
  localStorage.removeItem('sdelaet.draft_task_id.v1');
  location.href='/create-task.html?new=1';
}
async function logout(){
  await fetch(API+'/v1/auth/logout',{method:'POST',credentials:'include'}).catch(function(){});
  location.href='/';
}
window.sdAccount={API:API,api:api,requireAuth:requireAuth,fmtDate:fmtDate,money:money,track:track,resumeTask:resumeTask,newTask:newTask,logout:logout};
document.addEventListener('click',function(e){
  var n=e.target.closest('[data-new-task]');if(n){e.preventDefault();newTask();return}
  var r=e.target.closest('[data-resume-task]');if(r){e.preventDefault();resumeTask(r.dataset.resumeTask).catch(function(){location.href='/my-tasks.html'});return}
  var l=e.target.closest('[data-account-logout]');if(l){e.preventDefault();logout()}
});
})();