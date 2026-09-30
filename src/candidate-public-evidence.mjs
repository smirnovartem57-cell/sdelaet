/** Public evidence projection only. Called inside the existing paid + candidate-limit gate. */
const object=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const text=(v,n=700)=>(typeof v==='string'||typeof v==='number'?String(v):'').trim().slice(0,n);
const number=v=>v!==null&&v!==''&&v!==undefined&&Number.isFinite(Number(v))?Number(v):null;
const list=(v,n)=>Array.isArray(v)?v.slice(0,n):[];
const link=v=>{try{const u=new URL(text(v,2000));return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}};
export function candidatePublicEvidence(raw){
 const r=object(raw),trust=object(r.trustProfile),history=object(trust.history),legal=object(r.legalIdentity||trust.legalIdentity),fns=object(r.fnsProfile),domain=object(history.domain),experience=object(r.claimedExperience||history.claimedExperience);
 const sources=list(r.sources,30).map(s=>{s=object(s);return {id:text(s.id,160),kind:text(s.kind,80),label:text(s.label,160),host:text(s.host,250),url:link(s.url)};}).filter(s=>s.url);
 const facts=list(r.facts,40).map(f=>{f=object(f);return {label:text(f.label),status:['confirmed','claimed','risk','unknown'].includes(f.status)?f.status:'unknown',sourceId:text(f.sourceId,160)};}).filter(f=>f.label);
 const l=Object.keys(legal).length?{legalName:text(legal.legalName,250),legalForm:text(legal.legalForm,80),inn:text(legal.inn,30),ogrn:text(legal.ogrn||legal.ogrnip,30),registeredAt:text(legal.registeredAt,40),sourceUrl:link(legal.sourceUrl),discoveredVia:text(legal.discoveredVia,80),matchSignals:list(legal.matchSignals,12).map(v=>text(v,80))}:null;
 const f=Object.keys(fns).length?{available:fns.available===true?true:fns.available===false?false:null,inn:text(fns.inn,30),ogrn:text(fns.ogrn,30),active:typeof fns.active==='boolean'?fns.active:null,statusLabel:text(fns.statusLabel,200),registeredAt:text(fns.registeredAt,40),sourceUrl:link(fns.sourceUrl),dataDate:text(fns.dataDate||fns.checkedAt,50),cacheStatus:text(fns.cacheStatus,40),capital:{amount:number(fns.capital?.amount)},employees:{count:number(fns.employees?.count),year:text(fns.employees?.year,4)},finance:{income:number(fns.finance?.income),year:text(fns.finance?.year,4)},msp:{label:text(fns.msp?.label,100)},debt:{amount:number(fns.debt?.amount),year:text(fns.debt?.year,4),period:text(fns.debt?.period,10)}}:null;
 return {version:1,sources,facts,legalIdentity:l,fnsProfile:f,history:{domain:{domain:text(domain.domain,250),createdAt:text(domain.createdAt,40),ageYears:number(domain.ageYears)},claimedExperience:{sinceYear:number(experience.sinceYear),claimedYears:number(experience.claimedYears),sourceUrl:link(experience.sourceUrl)}}};
}
