(function(){
  function uniq(a){return Array.from(new Set((a||[]).filter(Boolean)))}
  function hasWork(offer,re){return (offer.worksIncluded||[]).some(function(x){return re.test(String(x).toLowerCase().replace(/ё/g,'е'))})}
  function build(task,offer){task=task||{};offer=offer||{};var items=[];var winter=/зим|круглогод/i.test(task.goal||'');
    if(offer.priceType==='from'||offer.isFromPrice===true)items.push('какая фиксированная цена после замера и от чего она может измениться');else if(offer.totalPrice==null)items.push('итоговую стоимость');
    if(offer.materialsIncluded==null)items.push('входят ли материалы в цену');
    if(task.serviceCode==='BALCONY_LEAK_REPAIR'){
      if(!offer.diagnosis)items.push('какая причина протечки / сырости подтверждена после диагностики');
      if(!offer.leakSource)items.push('где локализован источник проблемы');
      if(offer.diagnosticsCost==null&&!/диагностик.{0,20}(бесплат|включ)/i.test(offer.rawResponse||''))items.push('сколько стоит диагностика / выезд и входит ли она в итоговую цену');
      if(!offer.warranty)items.push('какая гарантия даётся именно на устранённый узел');
    }else if(task.serviceCode==='BALCONY_GLAZING'){
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
    }else if(task.serviceCode==='BALCONY_FINISHING'){
      if(!offer.finishSystem)items.push('какой материал / система чистовой отделки предлагается');
      if(offer.preparationIncluded!==true)items.push('какая подготовка основания входит в стоимость');
      if(/стар|передел/i.test((task.currentState||'')+' '+(task.scope||''))&&!hasWork(offer,/демонтаж/))items.push('входит ли демонтаж старой отделки');
      if(/пол/i.test((task.scope||'')+' '+(task.surfaces||''))&&offer.floorBaseIncluded!==true)items.push('что входит в подготовку / основание пола');
      if(!offer.warranty)items.push('гарантию на отделочные работы');
    }else if(task.serviceCode==='WALL_FINISHING'){
      var ws=((task.goal||'')+' '+(task.scope||'')+' '+(task.finishType||'')+' '+(task.wallState||'')+' '+(task.quality||'')).toLowerCase();
      var wallpaper=/wallpaper|обо/.test(ws),paint=/paint|покрас|краск/.test(ws);
      if(offer.wallPrimerIncluded!==true)items.push('входит ли грунтовка стен');
      if(offer.wallPuttyIncluded!==true)items.push('какая подготовка / шпаклёвка основания входит');
      if(paint&&offer.wallSandingIncluded!==true)items.push('входит ли шлифовка под покраску');
      if(paint&&offer.wallPaintingIncluded!==true)items.push('сколько слоёв покраски входит');
      if(wallpaper&&offer.wallpaperInstallationIncluded!==true)items.push('входит ли поклейка обоев');
      if(/old_wallpaper|old_paint|стар/.test(ws)&&offer.wallDemolitionIncluded!==true)items.push('входит ли демонтаж старого покрытия');
    }else if(task.serviceCode==='FLOORING_INSTALLATION'){
      var fs=((task.goal||'')+' '+(task.scope||'')+' '+(task.flooringType||'')+' '+(task.layout||'')+' '+(task.baseState||'')).toLowerCase();
      if(!offer.flooringType)items.push('какой тип покрытия учтён');
      if(!offer.flooringLayout)items.push('какая схема укладки учтена');
      if(offer.floorBasePreparationIncluded!==true)items.push('входит ли подготовка / выравнивание основания');
      if(/laminate|spc|engineered|ламинат|паркет|кварц/.test(fs)&&offer.underlayIncluded!==true&&offer.installationMethod!=='glued')items.push('входит ли подложка и какая');
      if(/engineered|паркет/.test(fs)&&!offer.installationMethod)items.push('укладка замковая или клеевая');
      if(/old_covering|стар.{0,10}покрыт/.test(fs)&&offer.floorDemolitionIncluded!==true)items.push('входит ли демонтаж старого покрытия');
    }else if(task.serviceCode==='TILE_INSTALLATION'){
      var ts=((task.goal||'')+' '+(task.scope||'')+' '+(task.tileZone||'')+' '+(task.tileFormat||'')+' '+(task.layout||'')).toLowerCase();
      if(!offer.tileFormat)items.push('какой тип и формат плитки учтён в цене');
      if(!offer.tileLayout)items.push('какая раскладка учтена в цене');
      if(offer.substratePreparationIncluded!==true)items.push('входит ли подготовка / выравнивание основания');
      if(/wet_room|ванн|сануз|душ/.test(ts)&&offer.waterproofingIncluded!==true)items.push('входит ли гидроизоляция пола и мокрых зон');
      if(!offer.groutType)items.push('какая затирка входит');
      if(offer.tileCutsIncluded!==true)items.push('входят ли подрезки и отверстия');
    }else if(task.serviceCode==='MINOR_APARTMENT_REPAIR'){
      var ms=((task.goal||'')+' '+(task.scope||'')+' '+(task.repairJob||'')+' '+(task.workList||'')).toLowerCase();
      if(/mounting|креп|полк|карниз|зеркал|телевиз/.test(ms)&&offer.fastenersSpecified!==true)items.push('какой крепёж / расходники входят и кто их предоставляет');
      if(/mounting|креп|полк|карниз|зеркал|телевиз/.test(ms)&&offer.drillingIncluded!==true)items.push('входит ли сверление и монтаж крепежа');
      if(offer.minimumVisit==null)items.push('есть ли минимальная стоимость выезда / заказа');
      if(!offer.warranty)items.push('гарантию на выполненные работы');
    }else if(task.serviceCode==='RADIATOR_HEATING'){
      var hs=((task.goal||'')+' '+(task.scope||'')+' '+(task.heatingJob||'')+' '+(task.system||'')+' '+(task.riserWork||'')).toLowerCase();
      if(!offer.radiatorSpec&&!/valves/.test(hs))items.push('какой радиатор: модель / мощность / размер предлагается');
      if(!offer.heatingConnection&&!/valves/.test(hs))items.push('какая схема подключения радиатора');
      if(offer.heatingValvesIncluded!==true)items.push('какие краны / клапаны / комплектующие входят');
      if(/central|стояк|yes/.test(hs)&&offer.riserWorkIncluded!==true)items.push('как организуется отключение и работы со стояком');
      if(offer.heatingPressureTestIncluded!==true)items.push('входит ли опрессовка / проверка герметичности после монтажа');
      if(!offer.warranty)items.push('гарантию на монтаж и соединения');
    }else if(task.serviceCode==='PLUMBING_WORKS'){
      var pscope=((task.goal||'')+' '+(task.scope||'')+' '+(task.plumbingJob||'')+' '+(task.currentState||'')).toLowerCase();
      var network=/(развод|water_distribution|relocation|труб|водоснабж)/.test(pscope),drain=/(канализац|drainage|слив)/.test(pscope),fixture=/(fixture|смесител|унитаз|раковин|ванн)/.test(pscope);
      if(network&&!offer.pipeSystem)items.push('какая система труб и фитингов предлагается');
      if(network&&!offer.distributionScheme)items.push('какая схема разводки предлагается — коллекторная или тройниковая');
      if(network&&offer.waterDistributionIncluded!==true)items.push('что именно входит в разводку водоснабжения');
      if(network&&offer.pressureTestIncluded!==true)items.push('будет ли выполнена опрессовка / проверка герметичности после монтажа');
      if(drain&&offer.drainageIncluded!==true)items.push('что входит в канализацию / слив и как определяется трасса');
      if(fixture&&!offer.fixtureType)items.push('какой именно прибор / узел устанавливается или заменяется');
      if(/замен/.test(pscope)&&offer.plumbingDemolitionIncluded!==true)items.push('входит ли демонтаж существующего оборудования');
      if(!offer.warranty)items.push('гарантию на сантехнические работы и соединения');
    }else if(task.serviceCode==='ELECTRICAL_INSTALLATION'){
      var scope=((task.goal||'')+' '+(task.scope||'')+' '+(task.electricalJob||'')+' '+(task.panelScope||'')).toLowerCase();
      if(!offer.cableSpec&&/(лини|проводк|розет|выключател)/.test(scope))items.push('какой кабель и сечение закладываются');
      if(!offer.routeSpec&&/(лини|проводк|розет|выключател)/.test(scope))items.push('как будет проложен кабель и что входит в подготовку трассы');
      if(offer.cableLayingIncluded!==true&&/(лини|проводк|розет|выключател)/.test(scope))items.push('входит ли прокладка кабеля в указанную стоимость');
      if(/щит|panel|replace|extend/.test(scope)&&offer.panelIncluded!==true)items.push('что именно входит в работы по электрощиту');
      if(/щит|panel|replace|extend/.test(scope)&&!offer.protectionSpec)items.push('какие автоматы / УЗО / дифавтоматы входят в смету');
      if(offer.testingIncluded!==true)items.push('какая проверка / измерения выполняются после монтажа');
      if(!offer.warranty)items.push('гарантию на электромонтажные работы');
    }else if(task.serviceCode==='WINDOW_REPAIR'){
      if(!offer.diagnosis)items.push('какая причина неисправности подтверждена после осмотра');
      if(!offer.repairType)items.push('какой конкретно ремонт требуется');
      if(offer.visitCost==null&&!offer.diagnosticsIncluded)items.push('сколько стоит выезд / диагностика');
      if(offer.partsIncluded==null)items.push('входят ли необходимые детали / запчасти в цену');
      if(!offer.warranty)items.push('гарантию на выполненный ремонт и заменённые детали');
      if(/конден|запот/i.test((task.goal||'')+' '+(task.scope||'')+' '+(task.description||''))&&!/(вентиляц|влажност|температур|причин)/i.test(offer.rawResponse||''))items.push('как будет диагностирована причина конденсата, а не только само окно');
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