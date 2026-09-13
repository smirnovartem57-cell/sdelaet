import fs from 'node:fs';
import path from 'node:path';

const ROUTES = {
  'balcony-finishing':['balkony','Балконы и лоджии','otdelka-balkona'],
  'balcony-glazing':['balkony','Балконы и лоджии','osteklenie-balkona'],
  'balcony-insulation':['balkony','Балконы и лоджии','uteplenie-balkona'],
  'balcony-leak-repair':['balkony','Балконы и лоджии','protechka-balkona'],
  'electrical-installation':['elektrika','Электрика','elektromontazhnye-raboty'],
  'flooring-installation':['poly','Полы','napolnye-pokrytiya'],
  'floor-screed':['poly','Полы','styazhka-pola'],
  'underfloor-heating':['poly','Полы','teplyy-pol'],
  'interior-doors':['dveri','Двери','mezhkomnatnye-dveri'],
  'entrance-doors':['dveri','Двери','vhodnye-dveri'],
  'minor-apartment-repair':['melkiy-remont','Мелкий ремонт','melkiy-remont-kvartiry'],
  'plumbing-works':['santehnika','Сантехника','santehnicheskie-raboty'],
  'water-heater-installation':['santehnika','Сантехника','ustanovka-vodonagrevatelya'],
  'radiator-heating':['otoplenie','Отопление','radiatory-otopleniya'],
  'stretch-ceiling':['potolki','Потолки','natyazhnoy-potolok'],
  'tile-installation':['plitka','Плиточные работы','ukladka-plitki'],
  'wall-finishing':['steny','Стены','otdelka-sten'],
  'wall-plastering':['steny','Стены','shtukaturka-sten'],
  'drywall-partitions':['steny','Стены','peregorodki-gkl'],
  'soundproofing':['steny','Стены','shumoizolyaciya'],
  'window-repair':['okna','Окна','remont-okon'],
  'window-replacement':['okna','Окна','zamena-okon'],
  'bathroom-waterproofing':['vannaya','Ванная и санузел','gidroizolyaciya-sanuzla'],
  'bathroom-renovation':['vannaya','Ванная и санузел','remont-vannoy-pod-klyuch'],
  'demolition-works':['demontazh','Демонтаж','demontazhnye-raboty'],
  'kitchen-installation':['kuhni','Кухни','montazh-kuhni'],
  'ventilation-exhaust':['ventilyaciya','Вентиляция','ventilyaciya-i-vytyazhka'],
  'roof-repair':['krovlya','Кровля','remont-krovli'],
  'facade-insulation':['fasady','Фасады','uteplenie-fasada'],
  'mold-remediation':['plesen-syrost','Плесень и сырость','ustranenie-pleseni-i-syrosti']
};

const cleanTitle = title => String(title||'').replace(/\s*\/\s*/g,' и ').trim();
const uniq = a => [...new Set((a||[]).filter(Boolean))];

function section(md, names){
  for(const name of names){
    const re=new RegExp(`^##\\s+${name}\\s*$([\\s\\S]*?)(?=^##\\s|$)`,'im');
    const m=md.match(re); if(m) return m[1].trim();
  }
  return '';
}
function bullets(text){
  return text.split(/\r?\n/).map(x=>x.match(/^\s*[-*]\s+(.+)/)?.[1]?.trim()).filter(Boolean);
}

function firstParagraph(text){
  return text.split(/\n\s*\n/).map(x=>x.replace(/\s+/g,' ').trim()).find(Boolean)||'';
}

function normalizationItems(text){
  const line=text.replace(/\s+/g,' ').match(/Обязательны:\s*(.+?)(?:\.|$)/i)?.[1]||'';
  return line.split(',').map(x=>x.trim()).filter(Boolean).map(x=>x[0]?.toUpperCase()+x.slice(1));
}

function expertData(root, entry){
  const file=path.join(root,entry.expertModel||'');
  const md=fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';
  const jtbd=firstParagraph(section(md,['JTBD']));
  const intake=bullets(section(md,['Минимальный Intake','Client Intake','Intake']));
  const norm=section(md,['Нормализация предложения','Quote model','Нормализация']);
  const red=firstParagraph(section(md,['Site inspection / red flags','Site inspection','Red flags']));
  return {jtbd,intake,norm,red,normItems:normalizationItems(norm)};
}

function genericCosts(name){
  return [
    `Объём и сложность работ по задаче «${name}»`,
    'Исходное состояние объекта и необходимость подготовки',
    'Материалы и выбранная технология выполнения',
    'Доступ, доставка, подъём и дополнительные организационные работы'
  ];
}
export function buildSeoDraft(root, entry, allCategories=[]){
  const name=cleanTitle(entry.title);
  const [groupSlug,groupName,serviceSlug]=ROUTES[entry.categoryId]||['drugie-raboty','Другие работы',entry.categoryId];
  const canonicalPath=`/uslugi/remont/${groupSlug}/${serviceSlug}/`;
  const expert=expertData(root,entry);
  const search=entry.search||{};
  const primaryQueries=uniq([...(search.privateQueries||[]),...(search.companyQueries||[])]).slice(0,6);
  const informationalQueries=uniq([
    `что входит в ${name.toLowerCase()}`,
    `как выбрать исполнителя для ${name.toLowerCase()}`,
    `как сравнить сметы на ${name.toLowerCase()}`,
    `от чего зависит стоимость ${name.toLowerCase()}`,
    `что проверить перед ${name.toLowerCase()}`
  ]);
  const siblings=allCategories.filter(x=>x.categoryId!==entry.categoryId && (ROUTES[x.categoryId]?.[0]===groupSlug)).map(x=>x.categoryId).slice(0,6);
  const quoteChecklist=expert.normItems.length?expert.normItems:[
    'Полный состав работ и материалов','Что прямо не входит в цену','Возможные дополнительные работы и доплаты','Срок выполнения и гарантия'
  ];
  const intakeText=expert.intake.length?expert.intake.join(', '):'цель, объём работ, исходное состояние, фотографии и ограничения объекта';
  const compareAnswer=firstParagraph(expert.norm)||`Сравнивать предложения нужно по одинаковому составу работ: цене, материалам, исключениям, доплатам, срокам и гарантии.`;
  const beforeAnswer=expert.jtbd||`До заказа важно зафиксировать ожидаемый результат, исходное состояние объекта, объём работ и ограничения, которые могут повлиять на технологию или итоговую смету.`;
  const siteAnswer=expert.red||'Часть параметров можно подтвердить только после замера или осмотра объекта; такие данные нельзя считать гарантированными заранее.';
  return {
    indexable:false,
    publicationStatus:'DRAFT',
    slug:serviceSlug,
    canonicalPath,
    title:`${name} — найти и сравнить исполнителей | Сделает`,
    description:`Что важно знать про ${name.toLowerCase()}, что проверить в смете и от чего зависит стоимость. «Сделает» подготовит единое ТЗ и поможет сравнить предложения.`,
    h1:`${name}: найти и сравнить исполнителей`,
    primaryIntent:`Подготовить задачу «${name}» и выбрать исполнителя`,
    primaryQueries,
    informationalQueries,
    breadcrumbs:[
      {name:'Услуги',path:'/uslugi/'},
      {name:'Ремонт',path:'/uslugi/remont/'},
      {name:groupName,path:`/uslugi/remont/${groupSlug}/`},
      {name,path:canonicalPath}
    ],
    infoBlocks:[
      {id:'before_order',title:`Что важно знать перед заказом: ${name}`,queryCluster:informationalQueries.slice(0,2),shortAnswer:beforeAnswer,sections:[
        {title:'Что нужно уточнить заранее',text:`Для предварительного расчёта полезно зафиксировать: ${intakeText}.`},
        {title:'Что нельзя обещать без осмотра',text:siteAnswer}
      ]},
      {id:'compare_quote',title:`Как сравнивать предложения на ${name.toLowerCase()}`,queryCluster:informationalQueries.slice(2,4),shortAnswer:compareAnswer,sections:[
        {title:'Сравнивайте одинаковый объём',text:'Итоговая цена имеет смысл только вместе с составом работ, материалами и исключениями.'},
        {title:'Проверяйте доплаты',text:'До выбора исполнителя нужно отдельно зафиксировать возможные дополнительные работы, доставку и другие условия, влияющие на итог.'}
      ]}
    ],
    quoteChecklist,
    costFactors:genericCosts(name),
    faq:[
      {question:`Что нужно сообщить для предварительного расчёта ${name.toLowerCase()}?`,shortAnswer:`Нужны данные, которые влияют на объём и способ работ: ${intakeText}.`,details:'Чем точнее исходные данные, тем меньше расхождений между предварительным и итоговым предложением.'},
      {question:`Что должно быть в смете на ${name.toLowerCase()}?`,shortAnswer:compareAnswer,details:'Сервис приводит предложения к единой структуре, чтобы было видно различия по составу, цене и исключениям.'},
      {question:`От чего зависит стоимость ${name.toLowerCase()}?`,shortAnswer:'Цена зависит не только от объёма, но и от исходного состояния, подготовки, материалов, технологии и дополнительных условий.',details:'Поэтому сравнивать только итоговую цифру без состава работ некорректно.'},
      {question:'Когда нужен выезд или замер?',shortAnswer:siteAnswer,details:'Если критичные параметры нельзя подтвердить дистанционно, они должны оставаться неизвестными до осмотра, а не выдаваться за факт.'},
      {question:'Как сравнить несколько предложений исполнителей?',shortAnswer:'Нужно отправить одинаковое ТЗ и сравнить одинаковые поля: состав работ, материалы, итоговую цену, исключения, доплаты, срок и гарантию.',details:'«Сделает» нормализует ответы исполнителей, чтобы различия были видны до выбора.'},
      {question:'Какие доплаты нужно уточнить заранее?',shortAnswer:'Нужно отдельно проверить всё, что исполнитель исключает из основной цены, а также дополнительные работы, материалы, доставку и организационные расходы.',details:'Список зависит от конкретной категории и исходного состояния объекта.'}
    ],
    relatedCategoryIds:siblings,
    research:{status:'EVIDENCE_REQUIRED',collectedAt:'',sources:[],queryCount:informationalQueries.length+primaryQueries.length,evidenceQueryCount:0,clusters:[],questions:[],aiAnswerTargets:[],cannibalization:[],recommendations:['Добавить внешний источник поисковых данных: Wordstat/Suggest/SERP/Search Console.'],researched:false,reviewedAt:'',researchVersion:1},
    reviewedAt:'',
    contentVersion:1,
    automation:{source:'SEO_CATEGORY_AGENT',status:'AUTO_DRAFT',expertModelUsed:Boolean(expert.jtbd||expert.norm),needsQueryResearch:true,researchStatus:'EVIDENCE_REQUIRED'}
  };
}

export function routeForCategory(categoryId){return ROUTES[categoryId]||null;}
