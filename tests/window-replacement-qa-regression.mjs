import fs from'node:fs';import vm from'node:vm';
const ctx={window:{}};vm.createContext(ctx);
for(const f of ['category-engine.js','expert-agent.js','offer-parser.js','offer-followup.js','offer-normalizer.js'])vm.runInContext(fs.readFileSync(new URL('../assets/'+f,import.meta.url),'utf8'),ctx);
const E=ctx.window.sdCategoryEngine,X=ctx.window.sdExpertAgent,P=ctx.window.sdOfferParser,F=ctx.window.sdOfferFollowup,N=ctx.window.sdOfferNormalizer;
let n=0,fail=0;function t(name,ok){n++;console.log(ok?'PASS':'FAIL',String(n).padStart(2,'0'),name);if(!ok)fail++}
let a=E.analyze('Нужно заменить три старых окна в квартире, хочу тише');t('category',a.serviceCode==='WINDOW_REPLACEMENT');t('intake max5',a.questions.length<=5);
let task={serviceCode:'WINDOW_REPLACEMENT',city:'Москва',goal:'Заменить старые окна',scope:'Замена 3 старых окон',description:'хочу лучше шумоизоляцию'};
let ex=X.run(task);t('expert brief',ex.expert.contractorBrief.responseRequirements.length>=8);t('noise warning',ex.expert.technicalRisks.some(x=>/шумоизоляц/i.test(x)));
let full=P.parse('Итого 89 000 ₽ под ключ. Профиль REHAU Grazio. Стеклопакет двухкамерный 40 мм. Фурнитура Roto. Монтаж окон, демонтаж старых окон, подоконники, откосы и отливы входят. Срок 3 дня. Гарантия 3 года.');
t('parse profile',!!full.profileSystem);t('parse glass',!!full.glassUnit);t('parse hardware',!!full.hardware);t('parse sill/reveals/flashing',full.sill===true&&full.reveals===true&&full.flashing===true);
let nf=N.normalize(full,task);t('full comparable',nf.comparable===true&&nf.comparableTotalPrice===89000);
let cheap=N.normalize(P.parse('Цена от 55 000 ₽. Профиль KBE, монтаж после замера.'),task);t('from noncomparable',cheap.comparable===false&&cheap.isFromPrice===true);
let nohw=P.parse('Итого 82 000 ₽ под ключ. Профиль VEKA. Стеклопакет двухкамерный. Монтаж окон, демонтаж, подоконник, откосы, отлив. Срок 4 дня. Гарантия 2 года.');let fu=F.build(task,nohw);t('followup hardware',fu.items.some(x=>/фурнитур/i.test(x)));
let nofinish=N.normalize(P.parse('Итого 80 000 ₽ под ключ. Профиль VEKA. Стеклопакет двухкамерный. Фурнитура Roto. Монтаж окон, демонтаж. Срок 4 дня. Гарантия 2 года.'),task);t('finish elements critical',nofinish.missingCriticalWorks.some(x=>/подоконник|откос|отлив/i.test(x)));
let draft=P.parse('Итого 70 000 ₽. Материалы отдельно. Монтаж окон.');t('materials excluded',draft.materialsIncluded===false);t('warranty gap',N.normalize(draft,task).gaps.some(x=>/гарант/i.test(x)));
if(fail)process.exit(1);console.log('Window replacement QA: '+n+'/'+n+' PASS');