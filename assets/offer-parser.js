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