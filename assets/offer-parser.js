(function(){
  function clean(s){return String(s||'').replace(/\r/g,'').trim()}
  function lines(s){return clean(s).split(/\n+/).map(function(x){return x.trim()}).filter(Boolean)}
  function rubles(s){var m=String(s||'').match(/(?:от\s*)?(\d{1,3}(?:[\s\u00a0.]?\d{3})+|\d{4,6})\s*(?:₽|руб(?:\.|лей)?)/i);return m?Number(m[1].replace(/[\s\u00a0.]/g,'')):null}
  function moneyCount(s){return (String(s||'').match(/\d{1,3}(?:[\s\u00a0.]?\d{3})+\s*(?:₽|руб(?:\.|лей)?)/gi)||[]).length}
  function parse(text){var raw=clean(text),low=raw.toLowerCase().replace(/ё/g,'е'),ls=lines(raw),o={rawResponse:raw,worksIncluded:[],exclusions:[],extraCosts:[],unknowns:[]};
    var priceMatch=low.match(/(?:^|\s)от\s+(\d[\d\s\u00a0.]*)\s*(?:₽|руб)/i);
    var mp=low.match(/материал[^\n]{0,35}?(\d[\d\s\u00a0.]*)\s*(?:₽|руб)/i);if(mp)o.materialsPrice=Number(mp[1].replace(/[\s\u00a0.]/g,''));
    var explicitTotal=/(?:итого|всего|общая\s+стоимость|итоговая\s+стоимость|цена\s*[:\-]?|стоимость\s+(?:работ|всего)|работ[аы]?\s+\d|сделаем\s+за|под\s+ключ[^\n]{0,20}\d)/i.test(low);
    var materialOnlyPrice=!!mp&&moneyCount(raw)===1&&!explicitTotal&&!priceMatch;
    o.priceType=priceMatch?'from':'fixed';o.totalPrice=priceMatch?Number(priceMatch[1].replace(/[\s\u00a0.]/g,'')):(materialOnlyPrice?null:rubles(raw));
    if(/материал.{0,20}(вход|включ)|все\s+материал.{0,15}(вход|включ)|под\s+ключ/i.test(low))o.materialsIncluded=true;else if(/материал.{0,20}(не\s+вход|отдельно)|без\s+материал/i.test(low))o.materialsIncluded=false;
    var tm=low.match(/(?:срок|работ[аы]\s+займут?|сделаем\s+за)\s*[:\-]?\s*(\d+\s*(?:-|–|до)?\s*\d*\s*(?:рабочих\s+дней|рабочих\s+дня|дней|дня|день|дн))/i);if(tm)o.leadTime=tm[1].trim();
    var gm=low.match(/гаранти[яию]\s*[:\-]?\s*(\d+\s*(?:месяцев|месяца|месяц|года|год|лет))/i);if(gm)o.warranty=gm[1].trim();
    var dict=[['утепление пола',/утепл.{0,12}пол|(?:^|[,.\s])пол(?:\s+тоже)?\s+(?:вход|включ)/],['утепление потолка',/утепл.{0,12}потол|потолок(?:\s+тоже)?\s+(?:вход|включ)/],['утепление стен / парапета',/утепл.{0,15}(стен|парапет)|(стен|парапет)[^\n]{0,12}(вход|включ)/],['герметизация / примыкания',/(гермет|примыкан|монтажн.{0,8}шв)/],['проверка остекления',/(провер|осмотр|диагност).{0,18}(остеклен|окон)|(остеклен|окон).{0,18}(провер|осмотр|диагност)/],['демонтаж',/демонтаж/],['монтаж остекления',/(монтаж|установк).{0,18}(остеклен|окон|рам|профил)/],['усиление парапета',/(усилен|укреп).{0,15}парапет/],['козырёк / отлив / водоотвод',/(козыр|отлив|водоотвод|нащельник|добор)/],['чистовая отделка',/(чистов|отделк)/],['электрика',/(розет|электрик|освещ)/],['тёплый пол',/тепл.{0,5}пол/],['вывоз мусора',/(вывоз|мусор)/]];dict.forEach(function(d){if(d[1].test(low))o.worksIncluded.push(d[0])});
    var pm=raw.match(/(?:профиль|профильная\s+система)\s*[:\-]?\s*([^,;\n.]{2,60})/i);if(pm)o.profileSystem=pm[1].trim();else{var brand=raw.match(/\b(VEKA|REHAU|KBE|Deceuninck|Melke|Provedal|Alutech|АЛЮТЕХ)\b[^,;\n.]*/i);if(brand)o.profileSystem=brand[0].trim()}
    var gu=raw.match(/(?:стеклопакет|заполнение)\s*[:\-]?\s*([^;\n.]{2,80})/i);if(gu)o.glassUnit=gu[1].trim();else{var chambers=low.match(/(однокамерн|двухкамерн|трехкамерн)[^,;\n.]*(?:стеклопакет)?/i);if(chambers)o.glassUnit=chambers[0].trim()}
    var hw=raw.match(/(?:фурнитура|hardware)\s*[:\-]?\s*([^,;\n.]{2,60})/i);if(hw)o.hardware=hw[1].trim();else{var hwb=raw.match(/\b(Roto|Maco|Siegenia|Winkhaus|Vorne)\b[^,;\n.]*/i);if(hwb)o.hardware=hwb[0].trim()}
    var vc=raw.match(/(?:выезд|диагностик)[^\n]{0,25}?(\d[\d\s\u00a0.]*)\s*(?:₽|руб)/i);if(vc)o.visitCost=Number(vc[1].replace(/[\s\u00a0.]/g,''));
    if(/(?:выезд|диагностик)[^\n]{0,25}(?:бесплат|0\s*(?:₽|руб))/.test(low)){o.visitCost=0;o.diagnosticsIncluded=true}else if(/диагност|осмотр мастера/.test(low))o.diagnosticsIncluded=true;
    var dg=raw.match(/(?:диагноз|причина|неисправность)\s*[:\-]?\s*([^.;\n]{3,120})/i);if(dg)o.diagnosis=dg[1].trim();
    if(/регулиров/.test(low)){o.repairType='adjustment';o.worksIncluded.push('регулировка')}else if(/замен.{0,15}уплотн/.test(low)){o.repairType='seal';o.worksIncluded.push('замена уплотнителя')}else if(/замен.{0,15}фурнитур|ремонт.{0,15}фурнитур/.test(low)){o.repairType='hardware';o.worksIncluded.push('ремонт / замена фурнитуры')}else if(/замен.{0,15}стеклопак/.test(low)){o.repairType='glass_unit';o.worksIncluded.push('замена стеклопакета')}else if(/гермет|монтажн.{0,8}шв/.test(low)){o.repairType='joint';o.worksIncluded.push('ремонт монтажного шва')}
    if(/запчаст|детал|комплектующ|фурнитур.{0,20}(вход|включ)|уплотнител.{0,20}(вход|включ)/.test(low))o.partsIncluded=true;else if(/запчаст|детал|комплектующ|фурнитур.{0,20}(отдельно|не вход)|уплотнител.{0,20}(отдельно|не вход)/.test(low))o.partsIncluded=false;
    var fs=raw.match(/(?:отделка|материал(?:ы)? отделки|финиш)\s*[:\-]?\s*([^,;\n.]{2,80})/i);if(fs)o.finishSystem=fs[1].trim();
    if(/пвх.?панел|вагонк|гипсокарт|ламинат|линолеум|плитк|краск/.test(low)&&!o.finishSystem){var fm=raw.match(/(ПВХ.?панел[^,;\n.]*|вагонк[^,;\n.]*|гипсокарт[^,;\n.]*|ламинат[^,;\n.]*|линолеум[^,;\n.]*|плитк[^,;\n.]*)/i);if(fm)o.finishSystem=fm[1].trim()}
    if(/подготовк.{0,20}(основан|поверх)|выравнив|грунтов/.test(low)){o.preparationIncluded=true;o.worksIncluded.push('подготовка основания')}
    if(/чернов.{0,10}пол|основан.{0,10}пол|стяжк|фанер|osb|осп/.test(low)){o.floorBaseIncluded=true;o.worksIncluded.push('основание пола')}
    var dc=raw.match(/(?:диагностик[аи]|выезд)\s*[:\-]?\s*(\d[\d\s\u00a0.]*)\s*(?:₽|руб)/i);if(dc)o.diagnosticsCost=Number(dc[1].replace(/[\s\u00a0.]/g,''));
    if(/козыр|верхн.{0,12}примыкан|кровл/.test(low))o.leakSource='козырёк / верхнее примыкание';else if(/фасадн.{0,12}шв|межпанел/.test(low))o.leakSource='фасадный / межпанельный шов';else if(/монтажн.{0,12}шв|окон.{0,12}примыкан|примыкан.{0,12}окон/.test(low))o.leakSource='оконный монтажный шов / примыкание';else if(/конденсат|вентиляц|влажностн.{0,10}режим/.test(low))o.leakSource='конденсация / влажностный режим';else if(/балконн.{0,10}плит|трещин/.test(low))o.leakSource='плита / трещины';
    if(/фасадн.{0,12}шв|межпанел/.test(low))o.worksIncluded.push('герметизация фасадного / межпанельного шва');if(/ремонт.{0,15}козыр|замен.{0,15}козыр|гермет.{0,15}козыр|верхн.{0,12}примыкан/.test(low))o.worksIncluded.push('ремонт козырька / верхнего примыкания');if(/ремонт.{0,15}плит|заделк.{0,15}трещин/.test(low))o.worksIncluded.push('ремонт плиты / трещин');
    var pc=low.match(/(\d+)\s*(?:розеток|розетки|розетк|точек|точки)/i);if(pc)o.pointsCount=Number(pc[1]);
    var lc=low.match(/(\d+)\s*(?:линий|линии|линия|групп|группы)/i);if(lc)o.lineCount=Number(lc[1]);
    var cs=raw.match(/(ВВГнг(?:-LS)?|NYM|ПВС|КГ)[^,;\n]{0,35}?(\d\s*[xх×]\s*\d(?:[.,]\d+)?)/i);if(cs)o.cableSpec=(cs[1]+' '+cs[2]).replace(/х/g,'x').replace(/×/g,'x');
    if(/прокладк.{0,20}кабел|кабел.{0,20}проклад/.test(low)){o.cableLayingIncluded=true;o.worksIncluded.push('прокладка кабеля')}
    if(/штроб|борозд/.test(low)){o.chasingIncluded=true;o.worksIncluded.push('штробление')}
    if(/кабель.?канал|открыт.{0,12}проклад/.test(low))o.routeSpec='открытая прокладка / кабель-канал';else if(/скрыт.{0,12}проклад|штроб|борозд/.test(low))o.routeSpec='скрытая прокладка';
    if(/подрозетник/.test(low))o.worksIncluded.push('подрозетники');
    if(/заделк.{0,15}штроб|восстанов.{0,20}(стен|отдел)/.test(low)){o.restorationIncluded=true;o.worksIncluded.push('заделка штроб / восстановление')}
    if(/электрощит|щиток|сборк.{0,12}щит|монтаж.{0,12}щит/.test(low)){o.panelIncluded=true;o.worksIncluded.push('электрощит')}
    var ps=raw.match(/([^.;\n]{0,80}(?:дифавтомат|УЗО|автомат(?:ы|ов)?|реле\s+напряжения)[^.;\n]{0,100})/i);if(ps)o.protectionSpec=ps[1].trim();
    if(/измерен.{0,20}(изоляц|сопротив)|электроизмер|прозвон|провер.{0,20}(лини|защит|узо|автомат)|испытан/.test(low)){o.testingIncluded=true;o.worksIncluded.push('проверка / измерения')}
    if(/подоконник/.test(low)){o.sill=true;o.worksIncluded.push('подоконник')}
    if(/откос/.test(low)){o.reveals=true;o.worksIncluded.push('откосы')}
    if(/отлив/.test(low)){o.flashing=true;o.worksIncluded.push('отлив')}
    if(/раздвижн/.test(low))o.openingScheme='Раздвижная';else if(/распашн|поворотно|откид/.test(low))o.openingScheme='Распашная / поворотно-откидная';
    if(/усилен|укреп.{0,15}парапет/.test(low))o.parapetReinforcement=true;else if(/усилен.{0,15}парапет.{0,12}не\s+(?:нуж|треб)/.test(low))o.parapetReinforcement=false;
    if(/козыр|отлив|водоотвод|нащельник|добор/.test(low))o.externalElements=true;
    ls.forEach(function(line){var l=line.toLowerCase().replace(/ё/g,'е');if(/не\s+входит|не\s+включ|исключ/.test(l))o.exclusions.push(line);if(/доплат|дополнительн.{0,12}(работ|расход)|отдельно\s+оплач/.test(l))o.extraCosts.push(line)});
    if(/(?:замер.{0,12}бесплат|бесплатн.{0,12}замер)/.test(low))o.measurement='Бесплатный замер';else if(/(?:замер.{0,20}(платн|₽|руб)|платн.{0,12}замер)/.test(low))o.measurement='Платный замер';else if(/замер/.test(low))o.measurement='Замер требуется';
    if(o.materialsIncluded==null)o.unknowns.push('Неясно, входят ли материалы');if(!o.leadTime)o.unknowns.push('Не указан срок');if(!o.warranty)o.unknowns.push('Не указана гарантия');
    return o
  }
  window.sdOfferParser={parse:parse};
})();