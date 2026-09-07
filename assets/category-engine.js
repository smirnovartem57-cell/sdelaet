(function(){
  function clean(v){return (v||'').trim()}
  function low(v){return clean(v).toLowerCase().replace(/ё/g,'е')}
  function has(s,re){return re.test(s)}
  function dimMatches(text){return text.match(/\d{2,4}\s*[×xх]\s*\d{2,4}\s*(?:мм|см|м)?/gi)||[]}
  function normalizeDim(v){return clean(v).replace(/\s+/g,' ').replace(/[xх]/gi,'×')}
  function parseDim(v){var m=clean(v).match(/(\d+(?:[.,]\d+)?)\s*[×xх]\s*(\d+(?:[.,]\d+)?)\s*(мм|см|м)?/i);if(!m)return null;var a=parseFloat(m[1].replace(',','.')),b=parseFloat(m[2].replace(',','.')),u=(m[3]||'мм').toLowerCase(),k=u==='м'?1:(u==='см'?.01:.001);return{a:a*k,b:b*k,unit:u}}
  function calcNetArea(wall,opening){var w=parseDim(wall);if(!w)return'';var area=w.a*w.b,o=parseDim(opening);if(o)area-=o.a*o.b;if(area<=0)return'';return '≈ '+area.toFixed(2).replace('.',',')+' м²'+(o?' без проёма':'')}

  var categories={
    'balcony-insulation':{
      id:'balcony-insulation',
      title:'Утепление / отделка балкона',
      aliases:[/балкон/,/лоджи/,/утепл.{0,18}(стен|балкон|лоджи)/,/холодн.{0,18}(стен|балкон|лоджи)/],
      requestFields:[
        'предлагаемую систему утепления и состав слоёв',
        'материал, толщину и количество слоёв',
        'подготовку основания, щелей и дефектов',
        'решение стыков, углов и примыканий к окну',
        'работы и материалы отдельными суммами',
        'дополнительные расходы отдельными строками',
        'срок, необходимость замера, договор и гарантию'
      ],
      analyze:function(text){
        var s=low(text),d=dimMatches(text),p={};
        if(has(s,/одн\w*\s+(стен|поверх)|только\s+(одн|эту|одну)\s+стен|стен\w*\s+(около|вокруг|возле)\s+окн/)) p.scope='Одна стена балкона';
        else if(has(s,/весь\s+балкон|всю\s+лоджи|целиком\s+балкон|полностью\s+утепл.{0,15}балкон/)) p.scope='Весь балкон / лоджия';
        if(has(s,/окн.{0,28}(не\s+мен|остав|сохран)|не\s+(нужно\s+)?мен.{0,20}окн/)) p.window='Существующее окно сохранить';
        else if(has(s,/замен.{0,16}окн|нов.{0,12}окн|остеклен.{0,18}(замен|нов)/)) p.window='Работы с окном / остеклением посчитать отдельно';
        if(has(s,/чистов/)) p.finish='Чистовая отделка';
        else if(has(s,/под\s+отдел|подготов.{0,15}отдел/)) p.finish='Основание под отделку';
        else if(has(s,/только\s+утепл|без\s+отдел/)) p.finish='Только утепление';
        if(has(s,/круглогод|жил.{0,8}(комнат|помещ)|полностью\s+тепл|тепл.{0,10}помещ/)) p.goal='Полностью тёплый балкон';
        else if(has(s,/утепл|холодн/)) p.goal='Сделать выбранную зону теплее';
        if(has(s,/пол.{0,18}(не\s+трог|не\s+нуж|не\s+дел)/)) p.floor='Не входит';
        if(has(s,/потол.{0,18}(не\s+трог|не\s+нуж|не\s+дел)/)) p.ceiling='Не входит';
        if(has(s,/остальн.{0,18}стен.{0,18}(не\s+трог|не\s+нуж|не\s+дел)/)) p.otherWalls='Не входят';
        if(d[0]) p.wallSize=normalizeDim(d[0]);
        if(d[1]) p.openingSize=normalizeDim(d[1]);
        if(has(s,/не\s+знаю.{0,16}размер|размер.{0,16}не\s+знаю|без\s+размер/)) p.sizesUnknown=true;
        if(has(s,/ближайш|как\s+можно\s+скор|сроч/)) p.timing='В ближайшее время';
        else if(has(s,/не\s+тороп|срок\s+не\s+крит/)) p.timing='Срок не критичен';
        if(has(s,/мытищ/)) p.city='Мытищи';
        else if(has(s,/москв/)) p.city='Москва';
        return p;
      },
      questions:function(p){
        var q=[];
        if(!p.city) q.push({id:'city',type:'text',title:'Где находится объект?',placeholder:'Например: Мытищи'});
        if(!p.scope) q.push({id:'scope',type:'choice',title:'Что хотите утеплить?',options:[['Одну стену / поверхность','Одна стена балкона'],['Несколько поверхностей','Несколько поверхностей'],['Весь балкон / лоджию','Весь балкон / лоджия'],['Пока не знаю — нужна оценка','Нужна оценка объёма']]});
        if(!p.goal) q.push({id:'goal',type:'choice',title:'Какой результат нужен?',options:[['Убрать холод от выбранной зоны','Сделать выбранную зону теплее'],['Сделать весь балкон тёплым','Полностью тёплый балкон'],['Подготовить под дальнейшую отделку','Подготовить под отделку']]});
        if(!p.window) q.push({id:'window',type:'choice',title:'Что делать с существующим окном / остеклением?',options:[['Оставить как есть','Существующее окно сохранить'],['Посчитать работы отдельно','Работы с окном / остеклением посчитать отдельно'],['Не знаю — нужна оценка','Нужна оценка остекления']]});
        if(!p.finish) q.push({id:'finish',type:'choice',title:'Какая отделка нужна после утепления?',options:[['Только утепление','Только утепление'],['Основание под отделку','Основание под отделку'],['Готовая чистовая отделка','Чистовая отделка'],['Пока не знаю','Отделку предложит исполнитель']]});
        if(!p.wallSize&&!p.sizesUnknown) q.push({id:'sizes',type:'sizes',title:'Размеры известны?'});
        if(!p.timing&&q.length<5) q.push({id:'timing',type:'choice',title:'Когда планируете начать?',options:[['В ближайшее время','В ближайшее время'],['Не тороплюсь','Срок не критичен']]});
        return q.slice(0,5);
      },
      summary:function(p){
        var exclusions=[];
        if(p.window==='Существующее окно сохранить') exclusions.push('существующее окно не менять');
        if(p.floor==='Не входит') exclusions.push('пол не включать');
        if(p.ceiling==='Не входит') exclusions.push('потолок не включать');
        if(p.otherWalls==='Не входят') exclusions.push('остальные стены не включать');
        var wall=p.wallSize||(p.sizesUnknown?'Уточнить на замере':''),opening=p.openingSize||(p.sizesUnknown?'Уточнить на замере':'');
        return {
          scope:p.scope||'Объём уточнить',
          goal:p.goal||'Цель уточнить',
          window:p.window||'Работы с окном уточнить',
          finish:p.finish||'Отделку уточнить',
          exclusions:exclusions.join('; '),
          wallSize:wall,
          openingSize:opening,
          area:calcNetArea(wall,opening),
          timing:p.timing||'Срок не критичен'
        }
      }
    }
  };

  function detectCategory(text){
    var s=low(text),best=null,bestScore=0;
    Object.keys(categories).forEach(function(id){var c=categories[id],score=0;c.aliases.forEach(function(re){if(re.test(s))score++});if(score>bestScore){best=c;bestScore=score}});
    return {category:best,score:bestScore};
  }
  function analyze(text){
    var d=detectCategory(text);
    if(!d.category){return {supported:false,categoryId:'',categoryTitle:'Категория пока не определена',confidence:'low',params:{},questions:[{id:'category',type:'unsupported',title:'Пока не удалось уверенно определить категорию'}]}}
    var p=d.category.analyze(text);
    return {supported:true,categoryId:d.category.id,categoryTitle:d.category.title,confidence:d.score>1?'high':'medium',params:p,questions:d.category.questions(p),requestFields:d.category.requestFields.slice()}
  }
  function merge(analysis,answers){
    var p=Object.assign({},analysis.params||{});
    Object.keys(answers||{}).forEach(function(k){var v=answers[k];if(v!==undefined&&v!==null&&v!=='')p[k]=v});
    if(answers&&answers.sizes==='unknown')p.sizesUnknown=true;
    if(answers&&answers.wallSize)p.wallSize=normalizeDim(answers.wallSize);
    if(answers&&answers.openingSize)p.openingSize=normalizeDim(answers.openingSize);
    var c=categories[analysis.categoryId];
    return c?c.summary(p):p;
  }
  function getCategory(id){return categories[id]||null}
  window.sdCategoryEngine={analyze:analyze,merge:merge,getCategory:getCategory,categories:categories};
})();