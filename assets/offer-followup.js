(function(){
  function uniq(a){return Array.from(new Set((a||[]).filter(Boolean)))}
  function hasWork(offer,re){return (offer.worksIncluded||[]).some(function(x){return re.test(String(x).toLowerCase().replace(/ё/g,'е'))})}
  function build(task,offer){task=task||{};offer=offer||{};var items=[];var winter=/зим|круглогод/i.test(task.goal||'');
    if(offer.priceType==='from'||offer.isFromPrice===true)items.push('какая фиксированная цена после замера и от чего она может измениться');else if(offer.totalPrice==null)items.push('итоговую стоимость');
    if(offer.materialsIncluded==null)items.push('входят ли материалы в цену');
    if(task.serviceCode==='BALCONY_GLAZING'){
      if(!offer.profileSystem)items.push('какая профильная система предлагается');
      if(winter&&!offer.glassUnit)items.push('какой стеклопакет / заполнение предлагается для зимнего режима');
      if(!hasWork(offer,/(монтаж|установк).{0,18}(остеклен|окон|рам|профил)|монтаж остекления/))items.push('входит ли монтаж остекления в указанную стоимость');
      if(/стар|замен/i.test((task.currentGlazing||'')+' '+(task.scope||''))&&!hasWork(offer,/демонтаж/))items.push('входит ли демонтаж старого остекления');
      if(!/(козыр|отлив|водоотвод|нащельник|добор)/i.test((offer.rawResponse||'')+' '+(offer.worksIncluded||[]).join(' ')))items.push('учтены ли необходимые наружные элементы и водоотвод');
      if(!offer.warranty)items.push('гарантию на конструкцию и монтаж');
    }else if(task.serviceCode==='WINDOW_REPLACEMENT'){
      if(!offer.profileSystem)items.push('какая профильная система предлагается');
      if(!offer.glassUnit)items.push('какой стеклопакет предлагается');
      if(!offer.hardware)items.push('какая фурнитура предлагается');
      if(!hasWork(offer,/(монтаж|установк).{0,18}(окон|рам|профил)|монтаж окна/))items.push('входит ли монтаж окна в указанную стоимость');
      if(/замен|стар/i.test((task.goal||'')+' '+(task.scope||''))&&!hasWork(offer,/демонтаж/))items.push('входит ли демонтаж старого окна');
      if(offer.sill!==true)items.push('входит ли подоконник');
      if(offer.reveals!==true)items.push('входят ли откосы');
      if(offer.flashing!==true)items.push('входит ли наружный отлив');
      if(!offer.warranty)items.push('гарантию на конструкцию и монтаж');
    }else{
      if(!offer.leadTime)items.push('срок выполнения');
      if(!offer.warranty)items.push('гарантию на работы');
      if(winter){if(!hasWork(offer,/утепл.{0,12}пол/))items.push('входит ли утепление пола');if(!hasWork(offer,/утепл.{0,12}потол/))items.push('входит ли утепление потолка');if(!hasWork(offer,/утепл.{0,15}(стен|парапет)/))items.push('входит ли утепление стен / парапета');if(!hasWork(offer,/(гермет|примыкан|монтажн.{0,8}шв)/))items.push('учтена ли герметизация примыканий');if(!hasWork(offer,/(провер|осмотр|диагност).{0,18}(остеклен|окон)/))items.push('будет ли проверено существующее остекление на пригодность для зимнего режима');}
    }
    if((offer.exclusions||[]).length===0&&offer.materialsIncluded!==false)items.push('что не входит в указанную стоимость');
    items=uniq(items).slice(0,6);
    if(!items.length)return{needed:false,items:[],message:'Спасибо. Предложение достаточно полное для предварительного сравнения.'};
    return{needed:true,items:items,message:'Спасибо. Уточните, пожалуйста: '+items.join('; ')+'.'};
  }
  window.sdOfferFollowup={build:build};
})();