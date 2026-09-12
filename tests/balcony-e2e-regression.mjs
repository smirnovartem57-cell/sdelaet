import fs from 'node:fs';
import vm from 'node:vm';

const files=['assets/category-engine.js','assets/expert-agent.js','assets/offer-parser.js','assets/offer-followup.js','assets/offer-merge.js','assets/offer-normalizer.js','assets/recommendation-status.js','assets/comparison-explainer.js','assets/recommendation-actions.js'];
const context={window:{},console};vm.createContext(context);
for(const file of files) vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
const w=context.window;
function ok(cond,msg){if(!cond)throw new Error(msg)}

const description='Хочу утеплить лоджию и сделать там кабинет, пользоваться зимой. Остекление уже есть, менять не хочу. Мытищи, примерно 3 × 1 м.';
const analysis=w.sdCategoryEngine.analyze(description);
ok(analysis.supported,'category must be supported');
ok(analysis.serviceCode==='BALCONY_INSULATION','must detect balcony insulation');
const merged=w.sdCategoryEngine.merge(analysis,{currentState:'Без отделки / бетон'});
const task={serviceCode:analysis.serviceCode,categoryId:analysis.categoryId,category:analysis.categoryTitle,description,city:analysis.params.city||'Мытищи',goal:merged.goal,window:merged.window,currentState:merged.currentState,scope:merged.scope,wallSize:merged.wallSize||'3 × 1 м',attachments:[]};
const expert=w.sdExpertAgent.run(task);
ok(['PASS','PASS_WITH_WARNINGS'].includes(expert.qa.status),'expert QA should allow flow');
ok(expert.expert.contractorBrief.responseRequirements.length>=5,'contractor brief must be complete');

const rawA='31 000 ₽ только работа. Материалы отдельно. Утеплим стены и парапет. Срок 3 дня.';
const rawB='37 000 ₽ под ключ, материалы включены. Утепление пола, потолка, стен и парапета, герметизация примыканий, проверка остекления. Срок 4 дня. Гарантия 2 года.';
const rawC='48 000 ₽, материалы включены. Утепление пола, потолка, стен и парапета, герметизация примыканий, проверка остекления. Срок 5 дней. Гарантия 3 года.';
let offerA=w.sdOfferParser.parse(rawA);offerA.candidateName='Исполнитель A';
let offerB=w.sdOfferParser.parse(rawB);offerB.candidateName='Исполнитель B';
let offerC=w.sdOfferParser.parse(rawC);offerC.candidateName='Исполнитель C';
const fu=w.sdOfferFollowup.generate(offerA,task);
ok(fu.needed===true,'incomplete offer must require follow-up');
ok(fu.questions.length>0,'follow-up must contain questions');
const replyA='Материалы будут стоить 18 000 ₽. Потолок и пол тоже входят, герметизация примыканий входит. Остекление проверим на замере. Гарантия 1 год.';
offerA=w.sdOfferMerge.merge(offerA,w.sdOfferParser.parse(replyA));
const ranked=w.sdOfferNormalizer.rank([offerA,offerB,offerC],task);
const status=w.sdRecommendationStatus.assign(ranked,task);
const recommended=status.filter(x=>x.recommendationStatus==='RECOMMENDED');
ok(recommended.length===1,'must produce exactly one recommended offer');
ok(recommended[0].candidateName==='Исполнитель B','37k complete offer must win');
ok(status.find(x=>x.candidateName==='Исполнитель C').recommendationStatus==='GOOD_ALTERNATIVE','48k complete offer should be alternative');
const insight=w.sdComparisonExplainer.explain(status,task);
ok(insight.winner&&insight.winner.candidateName==='Исполнитель B','explainer winner must match recommendation');
ok(insight.reasons.length>=2,'winner must have concrete reasons');
const action=w.sdRecommendationActions.forOffer(recommended[0],task);
ok(action.title&&action.steps.length>0,'recommended offer must have action plan');
ok(action.steps.length<=5,'action plan must stay compact');
console.log('BALCONY_E2E PASS',{category:analysis.serviceCode,qa:expert.qa.status,winner:recommended[0].candidateName,price:recommended[0].comparableTotalPrice,action:action.title});
