import fs from 'node:fs';
import vm from 'node:vm';

const context={window:{}};
vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL('../assets/geo-classifier.js',import.meta.url),'utf8'),context);
const G=context.window.sdGeoClassifier;
let n=0,fail=0;
function test(name,value){console.log(value?'PASS':'FAIL',++n,name);if(!value)fail++}

let x=G.classify('Мытищи');
test('Mytishchi region',x.regionId==='ru-mos'&&x.canonicalRegion==='Московская область');
test('Mytishchi locality',x.canonicalLocality==='Мытищи'&&x.localityId==='ru-mos-mytishchi');
test('Moscow',G.classify('Москва').regionId==='ru-mow');

let explicit=G.classify('Тульская область, Тула');
test('explicit region',explicit.regionId==='ru-tulskaya-oblast'&&explicit.canonicalLocality==='Тула'&&!explicit.needsConfirmation);

let kazan=G.classify('Казань');
test('Kazan directory locality',kazan.regionId==='ru-respublika-tatarstan'&&kazan.canonicalRegion==='Республика Татарстан'&&kazan.canonicalLocality==='Казань'&&!kazan.needsConfirmation);

let unknown=G.classify('Усть-Кукуево');
test('unknown not guessed',unknown.canonicalRegion===''&&unknown.regionId===''&&unknown.needsConfirmation&&unknown.canonicalLocality==='Усть-Кукуево');

let enriched=G.enrichTask({serviceCode:'WINDOW_REPAIR',city:'Химки'});
test('task enriched',enriched.regionId==='ru-mos'&&enriched.locality==='Химки'&&enriched.geo.countryCode==='RU');
test('empty safe',G.classify('').needsConfirmation);

const html=fs.readFileSync(new URL('../create-task.html',import.meta.url),'utf8');
test('create task wiring',html.includes('assets/geo-classifier.js')&&html.includes('regionId:geo.regionId')&&html.includes('localityId:geo.localityId'));

if(fail)process.exit(1);
console.log('Geo classifier regression: '+n+'/'+n+' PASS');
