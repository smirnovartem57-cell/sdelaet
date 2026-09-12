import fs from'node:fs';import vm from'node:vm';
const ctx={window:{}};vm.createContext(ctx);
for(const f of ['category-engine.js','expert-agent.js','offer-parser.js','offer-followup.js','offer-normalizer.js'])vm.runInContext(fs.readFileSync(new URL('../assets/'+f,import.meta.url),'utf8'),ctx);
const E=ctx.window.sdCategoryEngine,X=ctx.window.sdExpertAgent,P=ctx.window.sdOfferParser,F=ctx.window.sdOfferFollowup,N=ctx.window.sdOfferNormalizer;
let n=0,fail=0;function t(name,ok){n++;console.log(ok?'PASS':'FAIL',String(n).padStart(2,'0'),name);if(!ok)fail++}
let a=E.analyze('Нужно сделать разводку воды и канализации в ванной на 5 точек');t('category',a.serviceCode==='PLUMBING_WORKS');t('intake max5',a.questions.length<=5);
let task={serviceCode:'PLUMBING_WORKS',city:'Москва',goal:'Разводка водоснабжения',scope:'5 точек воды и канализация',plumbingJob:'water_distribution',objectState:'renovation'};
let ex=X.run(task);t('expert brief',ex.expert.contractorBrief.responseRequirements.length>=9);t('expert pressure-test risk',ex.expert.contractorBrief.scope.some(x=>/опрессов|герметич/i.test(x)));
let full=P.parse('Итого 96 000 ₽ под ключ. 5 точек, 22 м труб. REHAU PE-Xa, коллекторная разводка воды, канализация входит. Демонтаж старых труб и штробление входят. После монтажа опрессовка и проверка герметичности. Срок 4 дня. Гарантия 2 года.');
t('parse points/meters',full.plumbingPoints===5&&full.pipeMeters===22);t('parse pipe/scheme',!!full.pipeSystem&&full.distributionScheme==='коллекторная');t('parse drainage',full.drainageIncluded===true);t('parse pressure test',full.pressureTestIncluded===true);
let nf=N.normalize(full,task);t('full comparable',nf.comparable===true&&nf.comparableTotalPrice===96000);
let cheap=N.normalize(P.parse('Цена от 45 000 ₽. Разводка труб после осмотра. Материалы отдельно.'),task);t('from noncomparable',cheap.comparable===false&&cheap.isFromPrice===true);
let incomplete=P.parse('Итого 82 000 ₽. Материалы включены. 5 точек. Разводка воды. Срок 3 дня. Гарантия 1 год.');let fu=F.build(task,incomplete);t('followup pipe system',fu.items.some(x=>/система труб/i.test(x)));t('followup pressure test',fu.items.some(x=>/опрессов|герметич/i.test(x)));
let fixture=P.parse('Замена смесителя 3 500 ₽. Демонтаж старого смесителя и установка нового. Срок 1 день. Гарантия 1 год.');t('fixture parsed',fixture.fixtureType==='смеситель'&&fixture.plumbingDemolitionIncluded===true);
let hazard=X.run({serviceCode:'PLUMBING_WORKS',city:'Москва',goal:'Ремонт',scope:'Течет стояк и затапливает соседей',description:'сильная течь стояка'});t('riser emergency review',hazard.qa.status==='EXPERT_REVIEW_REQUIRED');
if(fail)process.exit(1);console.log('Plumbing works QA: '+n+'/'+n+' PASS');