(function(){
'use strict';
var servicesWrap=document.getElementById('sdServicesWrap');
var servicesToggle=document.getElementById('sdServicesToggle');
var servicesGrid=document.getElementById('sdServicesGrid');
var regionWrap=document.getElementById('sdRegionWrap');
var regionBtn=document.getElementById('sdRegionBtn');
var regionLabel=document.getElementById('sdRegionLabel');
var regionSearch=document.getElementById('sdRegionSearch');
var regionList=document.getElementById('sdRegionList');
var hoverTimer=0;
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]})}
function renderServices(){
  if(!servicesGrid)return;
  var data=window.sdNavigationTaxonomy||{},groups=Array.isArray(data.groups)?data.groups:[];
  servicesGrid.innerHTML='';
  groups.forEach(function(group){
    var section=document.createElement('section');section.className='sd-service-group';section.dataset.group=group.id||'';
    var items=Array.isArray(group.items)?group.items:[];
    section.innerHTML='<button class="sd-service-group-title" type="button" aria-expanded="false"><span>'+esc(group.title)+'</span><svg class="sd-group-chevron" viewBox="0 0 12 8" aria-hidden="true"><path d="M1 1.5 6 6.5 11 1.5"/></svg></button><div class="sd-service-group-links">'+items.map(function(item){return '<a class="sd-service-link" href="'+esc(item.url)+'" data-category-id="'+esc(item.categoryId)+'">'+esc(item.title)+'</a>'}).join('')+'</div>';
    servicesGrid.appendChild(section);
  });
  servicesGrid.addEventListener('click',function(e){
    var btn=e.target.closest('.sd-service-group-title');
    if(btn&&window.matchMedia('(max-width:760px)').matches){
      var group=btn.closest('.sd-service-group'),next=!group.classList.contains('open');
      group.classList.toggle('open',next);btn.setAttribute('aria-expanded',next?'true':'false');return;
    }
    if(e.target.closest('.sd-service-link'))closeMenus();
  });
}
function closeWrap(w,b){if(!w)return;w.classList.remove('open');if(b)b.setAttribute('aria-expanded','false')}
function closeMenus(){closeWrap(servicesWrap,servicesToggle);closeWrap(regionWrap,regionBtn)}
function setServices(open){if(!servicesWrap)return;if(open)closeWrap(regionWrap,regionBtn);servicesWrap.classList.toggle('open',!!open);servicesToggle.setAttribute('aria-expanded',open?'true':'false')}
function toggle(w,b){var next=!w.classList.contains('open');closeMenus();w.classList.toggle('open',next);b.setAttribute('aria-expanded',next?'true':'false')}
if(servicesWrap){
  servicesWrap.addEventListener('mouseenter',function(){if(!window.matchMedia('(min-width:761px)').matches)return;clearTimeout(hoverTimer);setServices(true)});
  servicesWrap.addEventListener('mouseleave',function(){if(!window.matchMedia('(min-width:761px)').matches)return;clearTimeout(hoverTimer);hoverTimer=setTimeout(function(){setServices(false)},120)});
}
servicesToggle&&servicesToggle.addEventListener('click',function(e){e.stopPropagation();clearTimeout(hoverTimer);toggle(servicesWrap,servicesToggle)});

function display(geo,label,detailed){
  return window.sdGeoClassifier&&sdGeoClassifier.display?sdGeoClassifier.display(geo,label,detailed):((geo&&geo.canonicalLocality)||(geo&&geo.canonicalRegion)||label||'Москва и МО');
}
function regionSlug(geo,label){
  return window.sdGeoClassifier&&sdGeoClassifier.urlSlug?sdGeoClassifier.urlSlug(geo,label):'';
}
function updateUrlAndLinks(geo,label){
  var slug=regionSlug(geo,label);if(!slug)return;
  var seoSlug=document.body&&document.body.dataset?String(document.body.dataset.seoRegion||''):'';
  if(seoSlug!==slug){
    var url=new URL(location.href);url.searchParams.set('region',slug);
    history.replaceState(history.state,'',url.pathname+url.search+url.hash);
  }
  document.querySelectorAll('a[href]').forEach(function(a){
    var href=a.getAttribute('href')||'';
    if(!href||href.charAt(0)==='#'||href.indexOf('mailto:')===0||href.indexOf('tel:')===0)return;
    try{
      var u=new URL(href,location.origin);
      if(u.origin!==location.origin)return;
      if(seoSlug===slug&&/^\/uslugi\/[^/]+\/$/.test(u.pathname)){
        u.pathname=u.pathname+slug+'/';u.searchParams.delete('region');
      }else if(/^\/uslugi\/[^/]+\/$/.test(u.pathname)||u.pathname==='/create-task.html'){
        u.searchParams.set('region',slug);
      }
      a.setAttribute('href',u.pathname+u.search+u.hash);
    }catch(e){}
  });
}
function readStored(){
  try{
    var slug=new URLSearchParams(location.search).get('region')||'';
    if(slug&&window.sdGeoClassifier&&sdGeoClassifier.fromUrlSlug){
      var g=sdGeoClassifier.fromUrlSlug(slug);if(g)return{label:display(g,'',false),geo:g,manual:true,updatedAt:Date.now()};
    }
  }catch(e){}
  try{var v2=JSON.parse(localStorage.getItem('sdelaet.region.v2')||'null');if(v2&&v2.label)return v2}catch(e){}
  try{var v1=JSON.parse(localStorage.getItem('sdelaet.region.v1')||'null');if(v1&&v1.label){var g2=v1.geo&&v1.geo.canonicalRegion!==undefined?v1.geo:(window.sdGeoClassifier?sdGeoClassifier.classify(v1.label):null);return{label:v1.label,geo:g2,manual:v1.manual===true,updatedAt:v1.updatedAt||0}}}catch(e){}
  return null;
}
function saveRegion(geo,label,manual,syncAccount){
  var value={label:display(geo,label,false),geo:geo||null,manual:manual===true,updatedAt:Date.now()};
  try{localStorage.setItem('sdelaet.region.v2',JSON.stringify(value));localStorage.setItem('sdelaet.region.v1',JSON.stringify(value));var p=JSON.parse(localStorage.getItem('sdelaet.profile.v1')||'{}');p.region=value.label;localStorage.setItem('sdelaet.profile.v1',JSON.stringify(p))}catch(e){}
  if(regionLabel)regionLabel.textContent=value.label;
  updateUrlAndLinks(value.geo,value.label);
  if(syncAccount&&value.geo){
    var detailed=display(value.geo,value.label,true);
    fetch('https://api.onsdelaet.ru/v1/account/profile',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({region:detailed,geo:value.geo})}).catch(function(){});
  }
  return value;
}
function renderRegions(query){
  if(!regionList)return;
  var opts=window.sdGeoClassifier&&sdGeoClassifier.search?sdGeoClassifier.search(query||'',35):[];
  if(!query&&window.sdGeoClassifier){
    var featured=['Москва и МО','Москва','Московская область','Санкт-Петербург'].map(function(name){return{label:name,geo:sdGeoClassifier.classify(name)}});
    var keys={};featured.forEach(function(x){keys[(x.geo.regionId||'')+'|'+(x.geo.localityId||'')]=1});
    opts=featured.concat(opts.filter(function(x){var k=(x.geo&&x.geo.regionId||'')+'|'+(x.geo&&x.geo.localityId||'');return !keys[k]}));
  }
  regionList.innerHTML='';
  if(!opts.length){regionList.innerHTML='<div class="sd-region-empty">Ничего не найдено — можно указать город в задаче вручную.</div>';return}
  opts.forEach(function(o){
    var b=document.createElement('button');b.type='button';b.className='sd-region-option';b.textContent=display(o.geo,o.label,true)+(o.hint?' · '+o.hint:'');
    b.onclick=function(){saveRegion(o.geo,o.label,true,true);closeWrap(regionWrap,regionBtn)};
    regionList.appendChild(b);
  });
}
regionSearch&&regionSearch.addEventListener('input',function(){renderRegions(regionSearch.value)});
regionBtn&&regionBtn.addEventListener('click',function(e){
  e.stopPropagation();var next=!regionWrap.classList.contains('open');closeMenus();regionWrap.classList.toggle('open',next);regionBtn.setAttribute('aria-expanded',next?'true':'false');
  if(next){renderRegions(regionSearch?regionSearch.value:'');if(regionSearch)setTimeout(function(){regionSearch.focus()},20)}
});
(function initRegion(){
  var seoSlug=document.body&&document.body.dataset?String(document.body.dataset.seoRegion||''):'';
  if(seoSlug&&window.sdGeoClassifier&&sdGeoClassifier.fromUrlSlug){
    var seoGeo=sdGeoClassifier.fromUrlSlug(seoSlug);
    if(seoGeo){saveRegion(seoGeo,display(seoGeo,'',false),true,false);return}
  }
  var saved=readStored();
  if(saved&&saved.label){saveRegion(saved.geo,saved.label,saved.manual,false);if(saved.manual)return}
  var fallback=function(){if(window.sdGeoClassifier)saveRegion(sdGeoClassifier.classify('Москва и МО'),'Москва и МО',false,false)};
  var timer=setTimeout(fallback,2800);
  fetch('https://ipwho.is/?fields=success,country_code,city,region',{mode:'cors'}).then(function(r){return r.ok?r.json():null}).then(function(g){
    clearTimeout(timer);if(!g||g.success===false||g.country_code!=='RU')return fallback();
    var raw=[String(g.city||''),String(g.region||'')].filter(Boolean).join(', '),geo=window.sdGeoClassifier?sdGeoClassifier.resolve(raw):null;
    if(!geo||(!geo.regionId&&!geo.canonicalLocality))return fallback();
    saveRegion(geo,display(geo,raw,false),false,false);
  }).catch(function(){clearTimeout(timer);fallback()});
})();
document.addEventListener('click',function(e){if(!e.target.closest('.sd-services-wrap')&&!e.target.closest('.sd-region-wrap'))closeMenus()});
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeMenus()});
window.addEventListener('scroll',closeMenus,{passive:true});
renderServices();
var current=readStored();if(current)updateUrlAndLinks(current.geo,current.label);
})();