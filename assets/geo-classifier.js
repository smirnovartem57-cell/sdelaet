(function(g){
'use strict';
function clean(v){return String(v||'').trim().replace(/\s+/g,' ')}
function norm(v){return clean(v).toLowerCase().replace(/ё/g,'е').replace(/[.]/g,'').replace(/\s*,\s*/g,', ').replace(/\bобл\b/g,'область').replace(/\bресп\b/g,'республика')}
var tr={'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ы':'y','э':'e','ю':'yu','я':'ya','ь':'','ъ':''};
function slug(v){return norm(v).split('').map(function(c){return tr[c]!==undefined?tr[c]:/[a-z0-9]/.test(c)?c:'-'}).join('').replace(/-+/g,'-').replace(/^-|-$/g,'')}
var REGIONS=[{"name":"Москва","id":"ru-mow"},{"name":"Санкт-Петербург","id":"ru-spe"},{"name":"Республика Адыгея","id":"ru-respublika-adygeya"},{"name":"Республика Алтай","id":"ru-respublika-altay"},{"name":"Республика Башкортостан","id":"ru-respublika-bashkortostan"},{"name":"Республика Бурятия","id":"ru-respublika-buryatiya"},{"name":"Республика Дагестан","id":"ru-respublika-dagestan"},{"name":"Республика Ингушетия","id":"ru-respublika-ingushetiya"},{"name":"Кабардино-Балкарская Республика","id":"ru-kabardino-balkarskaya-respublika"},{"name":"Республика Калмыкия","id":"ru-respublika-kalmykiya"},{"name":"Карачаево-Черкесская Республика","id":"ru-karachaevo-cherkesskaya-respublika"},{"name":"Республика Карелия","id":"ru-respublika-kareliya"},{"name":"Республика Коми","id":"ru-respublika-komi"},{"name":"Республика Марий Эл","id":"ru-respublika-mariy-el"},{"name":"Республика Мордовия","id":"ru-respublika-mordoviya"},{"name":"Республика Саха (Якутия)","id":"ru-respublika-saha-yakutiya"},{"name":"Республика Северная Осетия — Алания","id":"ru-respublika-severnaya-osetiya-alaniya"},{"name":"Республика Татарстан","id":"ru-respublika-tatarstan"},{"name":"Республика Тыва","id":"ru-respublika-tyva"},{"name":"Удмуртская Республика","id":"ru-udmurtskaya-respublika"},{"name":"Республика Хакасия","id":"ru-respublika-hakasiya"},{"name":"Чеченская Республика","id":"ru-chechenskaya-respublika"},{"name":"Чувашская Республика","id":"ru-chuvashskaya-respublika"},{"name":"Алтайский край","id":"ru-altayskiy-kray"},{"name":"Забайкальский край","id":"ru-zabaykalskiy-kray"},{"name":"Камчатский край","id":"ru-kamchatskiy-kray"},{"name":"Краснодарский край","id":"ru-krasnodarskiy-kray"},{"name":"Красноярский край","id":"ru-krasnoyarskiy-kray"},{"name":"Пермский край","id":"ru-permskiy-kray"},{"name":"Приморский край","id":"ru-primorskiy-kray"},{"name":"Ставропольский край","id":"ru-stavropolskiy-kray"},{"name":"Хабаровский край","id":"ru-habarovskiy-kray"},{"name":"Амурская область","id":"ru-amurskaya-oblast"},{"name":"Архангельская область","id":"ru-arhangelskaya-oblast"},{"name":"Астраханская область","id":"ru-astrahanskaya-oblast"},{"name":"Белгородская область","id":"ru-belgorodskaya-oblast"},{"name":"Брянская область","id":"ru-bryanskaya-oblast"},{"name":"Владимирская область","id":"ru-vladimirskaya-oblast"},{"name":"Волгоградская область","id":"ru-volgogradskaya-oblast"},{"name":"Вологодская область","id":"ru-vologodskaya-oblast"},{"name":"Воронежская область","id":"ru-voronezhskaya-oblast"},{"name":"Ивановская область","id":"ru-ivanovskaya-oblast"},{"name":"Иркутская область","id":"ru-irkutskaya-oblast"},{"name":"Калининградская область","id":"ru-kaliningradskaya-oblast"},{"name":"Калужская область","id":"ru-kaluzhskaya-oblast"},{"name":"Кемеровская область — Кузбасс","id":"ru-kemerovskaya-oblast-kuzbass"},{"name":"Кировская область","id":"ru-kirovskaya-oblast"},{"name":"Костромская область","id":"ru-kostromskaya-oblast"},{"name":"Курганская область","id":"ru-kurganskaya-oblast"},{"name":"Курская область","id":"ru-kurskaya-oblast"},{"name":"Ленинградская область","id":"ru-leningradskaya-oblast"},{"name":"Липецкая область","id":"ru-lipetskaya-oblast"},{"name":"Магаданская область","id":"ru-magadanskaya-oblast"},{"name":"Московская область","id":"ru-mos"},{"name":"Мурманская область","id":"ru-murmanskaya-oblast"},{"name":"Нижегородская область","id":"ru-nizhegorodskaya-oblast"},{"name":"Новгородская область","id":"ru-novgorodskaya-oblast"},{"name":"Новосибирская область","id":"ru-novosibirskaya-oblast"},{"name":"Омская область","id":"ru-omskaya-oblast"},{"name":"Оренбургская область","id":"ru-orenburgskaya-oblast"},{"name":"Орловская область","id":"ru-orlovskaya-oblast"},{"name":"Пензенская область","id":"ru-penzenskaya-oblast"},{"name":"Псковская область","id":"ru-pskovskaya-oblast"},{"name":"Ростовская область","id":"ru-rostovskaya-oblast"},{"name":"Рязанская область","id":"ru-ryazanskaya-oblast"},{"name":"Самарская область","id":"ru-samarskaya-oblast"},{"name":"Саратовская область","id":"ru-saratovskaya-oblast"},{"name":"Сахалинская область","id":"ru-sahalinskaya-oblast"},{"name":"Свердловская область","id":"ru-sverdlovskaya-oblast"},{"name":"Смоленская область","id":"ru-smolenskaya-oblast"},{"name":"Тамбовская область","id":"ru-tambovskaya-oblast"},{"name":"Тверская область","id":"ru-tverskaya-oblast"},{"name":"Томская область","id":"ru-tomskaya-oblast"},{"name":"Тульская область","id":"ru-tulskaya-oblast"},{"name":"Тюменская область","id":"ru-tyumenskaya-oblast"},{"name":"Ульяновская область","id":"ru-ulyanovskaya-oblast"},{"name":"Челябинская область","id":"ru-chelyabinskaya-oblast"},{"name":"Ярославская область","id":"ru-yaroslavskaya-oblast"},{"name":"Еврейская автономная область","id":"ru-evreyskaya-avtonomnaya-oblast"},{"name":"Ненецкий автономный округ","id":"ru-nenetskiy-avtonomnyy-okrug"},{"name":"Ханты-Мансийский автономный округ — Югра","id":"ru-hanty-mansiyskiy-avtonomnyy-okrug-yugra"},{"name":"Чукотский автономный округ","id":"ru-chukotskiy-avtonomnyy-okrug"},{"name":"Ямало-Ненецкий автономный округ","id":"ru-yamalo-nenetskiy-avtonomnyy-okrug"}];
var LOCALITIES=[{"name":"Мытищи","region":"Московская область","regionId":"ru-mos"},{"name":"Химки","region":"Московская область","regionId":"ru-mos"},{"name":"Балашиха","region":"Московская область","regionId":"ru-mos"},{"name":"Королёв","region":"Московская область","regionId":"ru-mos"},{"name":"Подольск","region":"Московская область","regionId":"ru-mos"},{"name":"Люберцы","region":"Московская область","regionId":"ru-mos"},{"name":"Красногорск","region":"Московская область","regionId":"ru-mos"},{"name":"Одинцово","region":"Московская область","regionId":"ru-mos"},{"name":"Домодедово","region":"Московская область","regionId":"ru-mos"},{"name":"Реутов","region":"Московская область","regionId":"ru-mos"},{"name":"Долгопрудный","region":"Московская область","regionId":"ru-mos"},{"name":"Пушкино","region":"Московская область","regionId":"ru-mos"},{"name":"Щёлково","region":"Московская область","regionId":"ru-mos"},{"name":"Сергиев Посад","region":"Московская область","regionId":"ru-mos"},{"name":"Электросталь","region":"Московская область","regionId":"ru-mos"},{"name":"Коломна","region":"Московская область","regionId":"ru-mos"},{"name":"Раменское","region":"Московская область","regionId":"ru-mos"},{"name":"Видное","region":"Московская область","regionId":"ru-mos"},{"name":"Лобня","region":"Московская область","regionId":"ru-mos"},{"name":"Чехов","region":"Московская область","regionId":"ru-mos"},{"name":"Серпухов","region":"Московская область","regionId":"ru-mos"},{"name":"Воскресенск","region":"Московская область","regionId":"ru-mos"},{"name":"Ногинск","region":"Московская область","regionId":"ru-mos"},{"name":"Дзержинский","region":"Московская область","regionId":"ru-mos"},{"name":"Котельники","region":"Московская область","regionId":"ru-mos"},{"name":"Ивантеевка","region":"Московская область","regionId":"ru-mos"},{"name":"Жуковский","region":"Московская область","regionId":"ru-mos"},{"name":"Санкт-Петербург","region":"Санкт-Петербург","regionId":"ru-spe"},{"name":"Казань","region":"Республика Татарстан","regionId":"ru-respublika-tatarstan"},{"name":"Новосибирск","region":"Новосибирская область","regionId":"ru-novosibirskaya-oblast"},{"name":"Екатеринбург","region":"Свердловская область","regionId":"ru-sverdlovskaya-oblast"},{"name":"Нижний Новгород","region":"Нижегородская область","regionId":"ru-nizhegorodskaya-oblast"},{"name":"Самара","region":"Самарская область","regionId":"ru-samarskaya-oblast"},{"name":"Омск","region":"Омская область","regionId":"ru-omskaya-oblast"},{"name":"Челябинск","region":"Челябинская область","regionId":"ru-chelyabinskaya-oblast"},{"name":"Ростов-на-Дону","region":"Ростовская область","regionId":"ru-rostovskaya-oblast"},{"name":"Уфа","region":"Республика Башкортостан","regionId":"ru-respublika-bashkortostan"},{"name":"Красноярск","region":"Красноярский край","regionId":"ru-krasnoyarskiy-kray"},{"name":"Пермь","region":"Пермский край","regionId":"ru-permskiy-kray"},{"name":"Воронеж","region":"Воронежская область","regionId":"ru-voronezhskaya-oblast"},{"name":"Волгоград","region":"Волгоградская область","regionId":"ru-volgogradskaya-oblast"},{"name":"Краснодар","region":"Краснодарский край","regionId":"ru-krasnodarskiy-kray"},{"name":"Саратов","region":"Саратовская область","regionId":"ru-saratovskaya-oblast"},{"name":"Тюмень","region":"Тюменская область","regionId":"ru-tyumenskaya-oblast"},{"name":"Ижевск","region":"Удмуртская Республика","regionId":"ru-udmurtskaya-respublika"},{"name":"Барнаул","region":"Алтайский край","regionId":"ru-altayskiy-kray"},{"name":"Иркутск","region":"Иркутская область","regionId":"ru-irkutskaya-oblast"},{"name":"Хабаровск","region":"Хабаровский край","regionId":"ru-habarovskiy-kray"},{"name":"Владивосток","region":"Приморский край","regionId":"ru-primorskiy-kray"},{"name":"Ярославль","region":"Ярославская область","regionId":"ru-yaroslavskaya-oblast"},{"name":"Махачкала","region":"Республика Дагестан","regionId":"ru-respublika-dagestan"},{"name":"Томск","region":"Томская область","regionId":"ru-tomskaya-oblast"},{"name":"Оренбург","region":"Оренбургская область","regionId":"ru-orenburgskaya-oblast"},{"name":"Кемерово","region":"Кемеровская область — Кузбасс","regionId":"ru-kemerovskaya-oblast-kuzbass"},{"name":"Новокузнецк","region":"Кемеровская область — Кузбасс","regionId":"ru-kemerovskaya-oblast-kuzbass"},{"name":"Рязань","region":"Рязанская область","regionId":"ru-ryazanskaya-oblast"},{"name":"Астрахань","region":"Астраханская область","regionId":"ru-astrahanskaya-oblast"},{"name":"Пенза","region":"Пензенская область","regionId":"ru-penzenskaya-oblast"},{"name":"Липецк","region":"Липецкая область","regionId":"ru-lipetskaya-oblast"},{"name":"Киров","region":"Кировская область","regionId":"ru-kirovskaya-oblast"},{"name":"Чебоксары","region":"Чувашская Республика","regionId":"ru-chuvashskaya-respublika"},{"name":"Тула","region":"Тульская область","regionId":"ru-tulskaya-oblast"},{"name":"Калининград","region":"Калининградская область","regionId":"ru-kaliningradskaya-oblast"},{"name":"Курск","region":"Курская область","regionId":"ru-kurskaya-oblast"},{"name":"Ставрополь","region":"Ставропольский край","regionId":"ru-stavropolskiy-kray"},{"name":"Улан-Удэ","region":"Республика Бурятия","regionId":"ru-respublika-buryatiya"},{"name":"Тверь","region":"Тверская область","regionId":"ru-tverskaya-oblast"},{"name":"Магнитогорск","region":"Челябинская область","regionId":"ru-chelyabinskaya-oblast"},{"name":"Сочи","region":"Краснодарский край","regionId":"ru-krasnodarskiy-kray"},{"name":"Белгород","region":"Белгородская область","regionId":"ru-belgorodskaya-oblast"},{"name":"Архангельск","region":"Архангельская область","regionId":"ru-arhangelskaya-oblast"},{"name":"Владимир","region":"Владимирская область","regionId":"ru-vladimirskaya-oblast"},{"name":"Смоленск","region":"Смоленская область","regionId":"ru-smolenskaya-oblast"},{"name":"Калуга","region":"Калужская область","regionId":"ru-kaluzhskaya-oblast"},{"name":"Орёл","region":"Орловская область","regionId":"ru-orlovskaya-oblast"},{"name":"Вологда","region":"Вологодская область","regionId":"ru-vologodskaya-oblast"},{"name":"Череповец","region":"Вологодская область","regionId":"ru-vologodskaya-oblast"},{"name":"Мурманск","region":"Мурманская область","regionId":"ru-murmanskaya-oblast"},{"name":"Петрозаводск","region":"Республика Карелия","regionId":"ru-respublika-kareliya"},{"name":"Сыктывкар","region":"Республика Коми","regionId":"ru-respublika-komi"},{"name":"Йошкар-Ола","region":"Республика Марий Эл","regionId":"ru-respublika-mariy-el"},{"name":"Саранск","region":"Республика Мордовия","regionId":"ru-respublika-mordoviya"},{"name":"Якутск","region":"Республика Саха (Якутия)","regionId":"ru-respublika-saha-yakutiya"},{"name":"Владикавказ","region":"Республика Северная Осетия — Алания","regionId":"ru-respublika-severnaya-osetiya-alaniya"},{"name":"Грозный","region":"Чеченская Республика","regionId":"ru-chechenskaya-respublika"},{"name":"Нальчик","region":"Кабардино-Балкарская Республика","regionId":"ru-kabardino-balkarskaya-respublika"},{"name":"Элиста","region":"Республика Калмыкия","regionId":"ru-respublika-kalmykiya"},{"name":"Черкесск","region":"Карачаево-Черкесская Республика","regionId":"ru-karachaevo-cherkesskaya-respublika"},{"name":"Абакан","region":"Республика Хакасия","regionId":"ru-respublika-hakasiya"},{"name":"Кызыл","region":"Республика Тыва","regionId":"ru-respublika-tyva"},{"name":"Майкоп","region":"Республика Адыгея","regionId":"ru-respublika-adygeya"},{"name":"Горно-Алтайск","region":"Республика Алтай","regionId":"ru-respublika-altay"},{"name":"Благовещенск","region":"Амурская область","regionId":"ru-amurskaya-oblast"},{"name":"Чита","region":"Забайкальский край","regionId":"ru-zabaykalskiy-kray"},{"name":"Петропавловск-Камчатский","region":"Камчатский край","regionId":"ru-kamchatskiy-kray"},{"name":"Южно-Сахалинск","region":"Сахалинская область","regionId":"ru-sahalinskaya-oblast"},{"name":"Магадан","region":"Магаданская область","regionId":"ru-magadanskaya-oblast"},{"name":"Псков","region":"Псковская область","regionId":"ru-pskovskaya-oblast"},{"name":"Великий Новгород","region":"Новгородская область","regionId":"ru-novgorodskaya-oblast"},{"name":"Брянск","region":"Брянская область","regionId":"ru-bryanskaya-oblast"},{"name":"Кострома","region":"Костромская область","regionId":"ru-kostromskaya-oblast"},{"name":"Иваново","region":"Ивановская область","regionId":"ru-ivanovskaya-oblast"},{"name":"Тамбов","region":"Тамбовская область","regionId":"ru-tambovskaya-oblast"},{"name":"Ульяновск","region":"Ульяновская область","regionId":"ru-ulyanovskaya-oblast"},{"name":"Курган","region":"Курганская область","regionId":"ru-kurganskaya-oblast"}];
var marketArea={rawGeo:'Москва и МО',canonicalRegion:'Москва и МО',canonicalLocality:'',regionId:'ru-moscow-area',localityId:'',countryCode:'RU',confidence:'high',needsConfirmation:false,source:'market-area',scope:'market_area',launchZone:'moscow_mo_pilot'};
function zone(regionId){return ['ru-mow','ru-mos','ru-moscow-area'].indexOf(regionId)>=0?'moscow_mo_pilot':regionId?'russia':'unknown'}
function result(raw,region,regionId,locality,confidence,source,scope){
 return{rawGeo:clean(raw),canonicalRegion:region||'',canonicalLocality:locality||'',regionId:regionId||'',localityId:locality?((regionId||'ru')+'-'+slug(locality)):'',countryCode:'RU',confidence:confidence||'low',needsConfirmation:confidence!=='high',source:source||'raw',scope:scope||(locality?'locality':region?'region':'unknown'),launchZone:zone(regionId||'')}
}
var regionByNorm={},regionAliases={};
REGIONS.forEach(function(r){
 regionByNorm[norm(r.name)]=r;
 var simple=norm(r.name).replace(/^республика /,'').replace(/ республика$/,'').replace(/ область$/,'').replace(/ край$/,'').replace(/ автономная область$/,'').replace(/ автономный округ.*$/,'').trim();
 if(simple.length>3)regionAliases[simple]=r;
});
regionAliases['мо']=regionByNorm['московская область'];
regionAliases['московская обл']=regionByNorm['московская область'];
regionAliases['мск']=regionByNorm['москва'];
regionAliases['спб']=regionByNorm['санкт-петербург'];
regionAliases['питер']=regionByNorm['санкт-петербург'];
regionAliases['санкт петербург']=regionByNorm['санкт-петербург'];
var locByNorm={};
LOCALITIES.forEach(function(x){locByNorm[norm(x.name)] = x});
function marketAlias(n){return /^(москва\s*(?:и|\+|\/)\s*(?:мо|московская область)|москва и мо)$/.test(n)}
function regionMatch(v){var n=norm(v);return regionByNorm[n]||regionAliases[n]||null}
function localityMatch(v){return locByNorm[norm(v)]||null}
function classify(raw){
 var value=clean(raw),n=norm(value);
 if(!n)return result(raw,'','','','low','empty','unknown');
 if(marketAlias(n))return Object.assign({},marketArea,{rawGeo:value});
 var directRegion=regionMatch(value);
 if(directRegion){
   if(directRegion.id==='ru-mow'||directRegion.id==='ru-spe')return result(value,directRegion.name,directRegion.id,directRegion.name,'high','region-city','locality');
   return result(value,directRegion.name,directRegion.id,'','high','directory-region','region');
 }
 var directLoc=localityMatch(value);
 if(directLoc)return result(value,directLoc.region,directLoc.regionId,directLoc.name,'high','directory-locality','locality');
 var parts=value.split(',').map(clean).filter(Boolean);
 if(parts.length>1){
   var r=null,loc='';
   for(var i=0;i<parts.length;i++){var hit=regionMatch(parts[i]);if(hit){r=hit;break}}
   if(r){
     loc=parts.filter(function(p){return !regionMatch(p)}).join(', ').trim();
     if(!loc&&(r.id==='ru-mow'||r.id==='ru-spe'))loc=r.name;
     return result(value,r.name,r.id,loc,'high','explicit-region','locality');
   }
   for(var j=0;j<parts.length;j++){
     var l=localityMatch(parts[j]);
     if(l)return result(value,l.region,l.regionId,l.name,'high','directory-locality','locality');
   }
 }
 return result(value,'','',value,'low','unresolved-locality','locality');
}
function resolve(raw,contextGeo){
 var x=classify(raw);
 if(x.confidence==='high')return x;
 var c=contextGeo&&typeof contextGeo==='object'?contextGeo:null;
 if(c&&c.regionId&&c.scope!=='market_area'&&x.canonicalLocality){
   return result(raw,c.canonicalRegion,c.regionId,x.canonicalLocality,'medium','profile-region-context','locality');
 }
 return x;
}
function enrich(task,raw,contextGeo){
 var geo=resolve(raw!==undefined?raw:(task&&task.city),contextGeo);
 return Object.assign({},task||{},{city:geo.canonicalLocality||geo.canonicalRegion||geo.rawGeo||'Уточнить',geo:geo,region:geo.canonicalRegion,regionId:geo.regionId,locality:geo.canonicalLocality,localityId:geo.localityId,launchZone:geo.launchZone})
}
function optionFromRegion(r){var geo=(r.id==='ru-mow'||r.id==='ru-spe')?result(r.name,r.name,r.id,r.name,'high','directory','locality'):result(r.name,r.name,r.id,'','high','directory','region');return{label:r.name,geo:geo}}
function optionFromLocality(x){return{label:x.name+(x.region&&x.region!==x.name?', '+x.region:''),geo:result(x.name,x.region,x.regionId,x.name,'high','directory','locality')}}
function options(){
 var out=[{label:'Москва и МО',geo:Object.assign({},marketArea)}];
 REGIONS.forEach(function(r){out.push(optionFromRegion(r))});
 LOCALITIES.forEach(function(x){if(x.name!=='Москва'&&x.name!=='Санкт-Петербург')out.push(optionFromLocality(x))});
 return out;
}
function resolveOption(v){var n=norm(v),all=options();for(var i=0;i<all.length;i++)if(norm(all[i].label)===n||norm(all[i].geo.canonicalLocality)===n)return all[i].geo;return null}
function searchOptions(v,limit){
 var q=norm(v),all=options(),scored=[];
 all.forEach(function(o){var label=norm(o.label),loc=norm(o.geo&&o.geo.canonicalLocality),reg=norm(o.geo&&o.geo.canonicalRegion),score=q?(label===q||loc===q?0:(label.indexOf(q)===0||loc.indexOf(q)===0?1:(label.indexOf(q)>=0||reg.indexOf(q)>=0?2:99))):1;if(score<99)scored.push({o:o,score:score})});
 scored.sort(function(a,b){return a.score-b.score||a.o.label.localeCompare(b.o.label,'ru')});
 var out=scored.slice(0,limit||20).map(function(x){return x.o});
 if(q&&q.length>=2&&!out.some(function(o){return norm(o.label)===q||norm(o.geo.canonicalLocality)===q})){
   out.push({label:clean(v),free:true,hint:'Указать как населённый пункт',geo:result(v,'','',clean(v),'low','free-locality','locality')});
 }
 return out.slice(0,limit||20);
}
function display(geo,label,detailed){
 if(!geo)return clean(label)||'';
 if(geo.scope==='market_area'||geo.regionId==='ru-moscow-area')return 'Москва и МО';
 var loc=clean(geo.canonicalLocality),reg=clean(geo.canonicalRegion);
 if(detailed&&loc&&reg&&loc!==reg)return loc+', '+reg;
 return loc||reg||clean(label)||'';
}
function urlSlug(geo,label){
 if(geo&&geo.scope==='market_area')return 'moskva-i-mo';
 var base=(geo&&geo.canonicalLocality)||(geo&&geo.canonicalRegion)||clean(label);
 return slug(base);
}
function fromUrlSlug(value){
 var wanted=clean(value).toLowerCase();
 if(!wanted)return null;
 if(wanted==='moskva-i-mo')return Object.assign({},marketArea);
 var all=options();
 for(var i=0;i<all.length;i++){
   var g=all[i].geo||{};
   if(urlSlug(g,all[i].label)===wanted)return g;
 }
 return null;
}
g.sdGeoClassifier={version:'2.1',classify:classify,resolve:resolve,enrichTask:enrich,slug:slug,options:options,resolveOption:resolveOption,search:searchOptions,display:display,urlSlug:urlSlug,fromUrlSlug:fromUrlSlug,marketZone:function(geo){return geo&&geo.launchZone||zone(geo&&geo.regionId||'')}};
})(window);
