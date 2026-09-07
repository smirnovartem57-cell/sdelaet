import http from 'node:http';
import { searchCandidates } from './core.mjs';

const env=process.env;
const port=Number(env.PORT||8788);
const server=http.createServer(async(req,res)=>{
  res.setHeader('content-type','application/json; charset=utf-8');
  res.setHeader('access-control-allow-origin',env.ALLOWED_ORIGIN||'https://onsdelaet.ru');
  res.setHeader('access-control-allow-methods','POST,GET,OPTIONS');
  res.setHeader('access-control-allow-headers','content-type');
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
  if(req.url==='/health'){res.writeHead(200);return res.end(JSON.stringify({ok:true,service:'sdelaet-search-api',providers:{yandexSearch:Boolean(env.YANDEX_SEARCH_API_KEY&&env.YANDEX_FOLDER_ID),dgis:Boolean(env.DGIS_API_KEY)}}));}
  if(req.url!=='/v1/candidates/search'||req.method!=='POST'){res.writeHead(404);return res.end(JSON.stringify({ok:false,error:'NOT_FOUND'}));}
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>12000){res.writeHead(413);return res.end(JSON.stringify({ok:false,error:'PAYLOAD_TOO_LARGE'}));}}
  let body={};try{body=JSON.parse(raw||'{}')}catch{res.writeHead(400);return res.end(JSON.stringify({ok:false,error:'BAD_JSON'}));}
  try{const out=await searchCandidates(env,body);res.writeHead(out.status||200);res.end(JSON.stringify(out));}
  catch(e){res.writeHead(502);res.end(JSON.stringify({ok:false,error:'SEARCH_FAILED',message:'Не удалось выполнить поиск.',detail:env.DEBUG==='1'?String(e?.message||e):undefined}));}
});
server.listen(port,'127.0.0.1',()=>console.log(`sdelaet search api on 127.0.0.1:${port}`));
