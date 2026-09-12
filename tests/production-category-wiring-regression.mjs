import fs from'node:fs';
const launch=fs.readFileSync(new URL('../assets/launch-v2.js',import.meta.url),'utf8');
const core=fs.readFileSync(new URL('../search-api/core.mjs',import.meta.url),'utf8');
const serviceCodes=['BALCONY_INSULATION','BALCONY_GLAZING','WINDOW_REPLACEMENT','WINDOW_REPAIR','BALCONY_FINISHING','BALCONY_LEAK_REPAIR','ELECTRICAL_INSTALLATION','PLUMBING_WORKS','RADIATOR_HEATING','MINOR_APARTMENT_REPAIR'];
const categoryIds=['balcony-insulation','balcony-glazing','window-replacement','window-repair','balcony-finishing','balcony-leak-repair','electrical-installation','plumbing-works','radiator-heating','minor-apartment-repair'];
let fail=0;
for(const x of serviceCodes){const ok=launch.includes("'"+x+"'");console.log(ok?'PASS':'FAIL','expert wiring',x);if(!ok)fail++;}
for(const x of categoryIds){const ok=core.includes("'"+x+"':");console.log(ok?'PASS':'FAIL','search wiring',x);if(!ok)fail++;}
if(/task\.serviceCode!==['\"]BALCONY_INSULATION/.test(launch)){console.log('FAIL insulation-only expert guard remains');fail++;}else console.log('PASS no insulation-only expert guard');
if(fail)process.exit(1);console.log('Production category wiring regression: PASS');