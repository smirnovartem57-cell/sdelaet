import {createPublicKey,verify} from 'node:crypto';

let cachedKey=null,cachedAt=0;
function b64url(v){return Buffer.from(v.replace(/-/g,'+').replace(/_/g,'/'),'base64')}

async function getKey(){
  if(cachedKey&&Date.now()-cachedAt<3600000)return cachedKey;
  const r=await fetch('https://enter.tochka.com/doc/openapi/static/keys/public');
  if(!r.ok)throw new Error('TOCHKA_PUBLIC_KEY_UNAVAILABLE');
  const jwk=await r.json();
  cachedKey=createPublicKey({key:jwk,format:'jwk'});cachedAt=Date.now();return cachedKey;
}

export async function verifyTochkaWebhook(token){
  const parts=String(token||'').trim().split('.');
  if(parts.length!==3)throw new Error('BAD_WEBHOOK_JWT');
  const [h,p,s]=parts,header=JSON.parse(b64url(h).toString('utf8'));
  if(header.alg!=='RS256')throw new Error('BAD_WEBHOOK_ALG');
  const ok=verify('RSA-SHA256',Buffer.from(`${h}.${p}`),await getKey(),b64url(s));
  if(!ok)throw new Error('BAD_WEBHOOK_SIGNATURE');
  return JSON.parse(b64url(p).toString('utf8'));
}
