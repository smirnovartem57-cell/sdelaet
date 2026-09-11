(function(){
  function clean(s){return String(s||'').replace(/\r/g,'').trim()}
  function lines(s){return clean(s).split(/\n+/).map(function(x){return x.trim()}).filter(Boolean)}
  function rubles(s){var m=String(s||'').match(/(?:от\s*)?(\d{1,3}(?:[\s\u00a0.]?\d{3})+|\d{4,6})\s*(?:₽|руб(?:\.|лей)?)/i);return m?Number(m[1].replace(/[\s\u00a0.]/g,'')):null}
  function parse(text){var raw=clean(text),low=raw.toLowerCase().replace(/ё/g,'е'),ls=lines(raw),o={rawResponse:raw,worksIncluded:[],exclusions:[],extraCosts:[],unknowns:[]};
    var priceMatch=low.match(/\bот\s+(\d[\d\s\u00a0.]*)\s*(?:₽|руб)/i);o.priceType=priceMatch?'from':'fixed';o.totalPrice=priceMatch?Number(priceMatch[1].replace(/[\s\u00a0.]/g,'')):rubles(raw);
    if(/материал.{0,20}(вход|включ)|все\s+материал.{0,15}(вход|включ)|под\s+ключ/i.test(low))o.materialsIncluded=true;else if(/материал.{0,20}(не\s+вход|отдельно)|без\s+материал/i.test(low))o.materialsIncluded=false;
    var mp=low.match(/материал[^\n]{0,25}?(\d[\d\s\u00a0.]*)\s*(?:₽|руб)/i);if(mp)o.materialsPrice=Number(mp[1].replace(/[\s\u00a0.]/g,''));
    var tm=low.match(/(?:срок|работ[аы]\s+займут?|сделаем\s+за)\s*[:\-]?\s*(\d+\s*(?:-|–|до)?\s*\d*\s*(?:дн|дня|дней|рабочих\s+дн))/i);if(tm)o.leadTime=tm[1].trim();
    var gm=low.match(/гаранти[яию]\s*[:\-]?\s*(\d+\s*(?:год|года|лет|месяц|месяца|месяцев))/i);if(gm)o.warranty=gm[1].trim();
    var dict=[['утепление пола',/утепл.{0,12}пол/],['утепление потолка',/утепл.{0,12}потол/],['утепление стен / парапета',/утепл.{0,15}(стен|парапет)/],['герметизация / примыкания',/(гермет|примыкан|монтажн.{0,8}шв)/],['проверка остекления',/(провер|осмотр|диагност).{0,18}(остеклен|окон)/],['демонтаж',/демонтаж/],['чистовая отделка',/(чистов|отделк)/],['электрика',/(розет|электрик|освещ)/],['тёплый пол',/тепл.{0,5}пол/],['вывоз мусора',/(вывоз|мусор)/]];dict.forEach(function(d){if(d[1].test(low))o.worksIncluded.push(d[0])});
    ls.forEach(function(line){var l=line.toLowerCase().replace(/ё/g,'е');if(/не\s+входит|не\s+включ|исключ/.test(l))o.exclusions.push(line);if(/доплат|дополнительн.{0,12}(работ|расход)|отдельно\s+оплач/.test(l))o.extraCosts.push(line)});
    if(/замер.{0,12}бесплат/.test(low))o.measurement='Бесплатный замер';else if(/замер.{0,20}(платн|₽|руб)/.test(low))o.measurement='Платный замер';else if(/замер/.test(low))o.measurement='Замер требуется';
    if(o.materialsIncluded==null)o.unknowns.push('Неясно, входят ли материалы');if(!o.leadTime)o.unknowns.push('Не указан срок');if(!o.warranty)o.unknowns.push('Не указана гарантия');
    return o
  }
  window.sdOfferParser={parse:parse};
})();