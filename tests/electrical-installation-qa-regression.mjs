import fs from'node:fs';import vm from'node:vm';
const ctx={window:{}};vm.createContext(ctx);
for(const f of ['category-engine.js','expert-agent.js','offer-parser.js','offer-followup.js','offer-normalizer.js'])vm.runInContext(fs.readFileSync(new URL('../assets/'+f,import.meta.url),'utf8'),ctx);
const E=ctx.window.sdCategoryEngine,X=ctx.window.sdExpertAgent,P=ctx.window.sdOfferParser,F=ctx.window.sdOfferFollowup,N=ctx.window.sdOfferNormalizer;
let n=0,fail=0;function t(name,ok){n++;console.log(ok?'PASS':'FAIL',String(n).padStart(2,'0'),name);if(!ok)fail++}
let a=E.analyze('Нужно полностью заменить проводку в квартире и собрать новый электрощит');t('category',a.serviceCode==='ELECTRICAL_INSTALLATION');t('intake max5',a.questions.length<=5);
let task={serviceCode:'ELECTRICAL_INSTALLATION',city:'Москва',goal:'Полная замена проводки',scope:'Квартира 55 м², новая проводка и щит',electricalJob:'full_rewire',panelScope:'replace',objectState:'renovation'};
let ex=X.run(task);t('expert brief',ex.expert.contractorBrief.responseRequirements.length>=9);t('expert cable risk',ex.expert.technicalRisks.some(x=>/кабел|сечен|защит/i.test(x)));
let full=P.parse('Итого 148 000 ₽ под ключ. 28 розеток, 9 линий. Кабель ВВГнг-LS 3x2.5, скрытая прокладка кабеля, штробление и подрозетники. Новый электрощит, автоматы и УЗО входят. После монтажа проверка линий и измерение сопротивления изоляции. Срок 7 дней. Гарантия 2 года.');
t('parse counts',full.pointsCount===28&&full.lineCount===9);t('parse cable route',!!full.cableSpec&&full.routeSpec==='скрытая прокладка');t('parse panel protection',full.panelIncluded===true&&!!full.protectionSpec);t('parse testing',full.testingIncluded===true);
let nf=N.normalize(full,task);t('full comparable',nf.comparable===true&&nf.comparableTotalPrice===148000);
let cheap=N.normalize(P.parse('Стоимость от 90 000 ₽. Электрика под ключ после осмотра.'),task);t('from noncomparable',cheap.comparable===false&&cheap.isFromPrice===true);
let weak=P.parse('Итого 120 000 ₽. Материалы включены. Кабель ВВГнг-LS 3x2.5, скрытая прокладка кабеля, штробление. Новый электрощит. Срок 6 дней. Гарантия 1 год.');let fu=F.build(task,weak);t('followup protection',fu.items.some(x=>/автомат|узо|диф/i.test(x)));t('followup testing',fu.items.some(x=>/провер|измер/i.test(x)));
let nt=N.normalize(weak,task);t('missing protection/testing',nt.missingCriticalWorks.some(x=>/защитн/i.test(x))&&nt.missingCriticalWorks.some(x=>/провер|измер/i.test(x)));
let hazard=X.run({serviceCode:'ELECTRICAL_INSTALLATION',city:'Москва',goal:'Ремонт',scope:'щит',description:'автомат выбивает, розетка искрит и пахнет гарью'});t('hazard review',hazard.qa.status==='EXPERT_REVIEW_REQUIRED');
if(fail)process.exit(1);console.log('Electrical installation QA: '+n+'/'+n+' PASS');