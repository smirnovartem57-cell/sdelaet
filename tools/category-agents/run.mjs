import {runAll,runCategory,getProfile} from './orchestrator.mjs';
const args=process.argv.slice(2),asJson=args.includes('--json'),all=args.includes('--all'),ci=args.includes('--ci'),ix=args.indexOf('--category'),id=ix>=0?args[ix+1]:null;
if(!all&&!id){console.error('Usage: node tools/category-agents/run.mjs --all | --category <id> [--json] [--ci]');process.exit(2)}
const reports=all?runAll():[runCategory(getProfile(id))];
if(asJson)console.log(JSON.stringify(reports,null,2));else for(const r of reports){console.log(`\n[${r.overall}] ${r.serviceCode} (${r.lifecycle})`);for(const a of r.agents){console.log(`  ${a.status.padEnd(5)} ${a.agent}: ${a.summary}`);for(const x of a.actions||[])console.log(`        -> ${x}`)}console.log(`  RELEASE: ${r.releaseDecision}`)}
if(ci&&reports.some(r=>r.overall==='BLOCK'&&['TESTING','READY','ACTIVE','SEASONAL_PAUSE'].includes(r.lifecycle)))process.exit(1);
