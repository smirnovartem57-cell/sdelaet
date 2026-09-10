import { searchCandidates } from './core.mjs';
import { analyzeConstructionTask } from './expert.mjs';

function cors(origin,env){
  const allowed=String(env.ALLOWED_ORIGINS||'https://onsdelaet.ru,https://www.onsdelaet.ru').split(',').map(x=>x.trim()).filter(Boolean);
  const ok=allowed.includes(origin)||/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin||'');
  return {'access-control-allow-origin':ok?origin:allowed[0]||'https://onsdelaet.ru','access-control-allow-methods':'POST,GET,OPTIONS','access-control-allow-headers':'content-type','vary':'Origin','content-type':'application/json; charset=utf-8'};
}
function json(data,status,origin,env){return new Response(JSON.stringify(data),{status,headers:cors(origin,env)})}
function textSize(v){try{return JSON.stringify(v).length}catch{return 999999}}

export default {
  async fetch(request,env){
    const url=new URL(request.url),origin=request.headers.get('origin')||'';
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(origin,env)});
    if(url.pathname==='/health')return json({ok:true,service:'sdelaet-search-api',providers:{yandexSearch:Boolean(env.YANDEX_SEARCH_API_KEY&&env.YANDEX_FOLDER_ID),dgis:Boolean(env.DGIS_API_KEY),openai:Boolean(env.OPENAI_API_KEY)}},200,origin,env);
    if(request.method!=='POST')return json({ok:false,error:'NOT_FOUND'},404,origin,env);
    let body={};try{body=await request.json()}catch{return json({ok:false,error:'BAD_JSON',message:'Некорректный JSON.'},400,origin,env)}
    if(textSize(body)>24000)return json({ok:false,error:'PAYLOAD_TOO_LARGE'},413,origin,env);
    try{
      if(url.pathname==='/v1/candidates/search'){
        const result=await searchCandidates(env,body);
        return json(result,result.status||200,origin,env);
      }
      if(url.pathname==='/v1/expert/construction/analyze'){
        const result=await analyzeConstructionTask(env,body);
        return json(result,result.status||200,origin,env);
      }
      return json({ok:false,error:'NOT_FOUND'},404,origin,env);
    }catch(e){
      return json({ok:false,error:'REQUEST_FAILED',message:'Не удалось выполнить запрос. Попробуйте ещё раз.',detail:env.DEBUG==='1'?String(e?.message||e):undefined},502,origin,env);
    }
  }
};
