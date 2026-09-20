(function(){
'use strict';

var TESSERACT_CDN='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
var workerPromise=null;

function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function round1(v){return Math.round(Number(v)*10)/10}
function near(a,b,tol){return Math.abs(Number(a)-Number(b))<=tol}
function clean(v){return String(v==null?'':v).trim()}
function dataImages(attachments){
  return (attachments||[]).filter(function(x){
    return x&&x.data&&/^image\//i.test(x.type||'');
  });
}
function loadScript(){
  if(window.Tesseract)return Promise.resolve(window.Tesseract);
  return new Promise(function(resolve,reject){
    var existing=document.querySelector('script[data-sd-tesseract]');
    if(existing){
      existing.addEventListener('load',function(){resolve(window.Tesseract)});
      existing.addEventListener('error',reject);return;
    }
    var s=document.createElement('script');
    s.src=TESSERACT_CDN;s.async=true;s.dataset.sdTesseract='1';
    s.onload=function(){window.Tesseract?resolve(window.Tesseract):reject(new Error('TESSERACT_NOT_AVAILABLE'))};
    s.onerror=function(){reject(new Error('TESSERACT_LOAD_FAILED'))};
    document.head.appendChild(s);
  });
}

async function getWorker(logger){
  if(workerPromise)return workerPromise;
  workerPromise=(async function(){
    var T=await loadScript();
    var w=await T.createWorker(['rus','eng'],1,{logger:logger||function(){}});
    try{await w.setParameters({tessedit_pageseg_mode:T.PSM&&T.PSM.SPARSE_TEXT?T.PSM.SPARSE_TEXT:'11'})}catch(e){}
    return w;
  })();
  return workerPromise;
}

function parseTsv(tsv,transform,pass){
  var rows=String(tsv||'').split(/\r?\n/),out=[];
  rows.slice(1).forEach(function(line){
    if(!line.trim())return;
    var p=line.split('\t');if(p.length<12||p[0]!=='5')return;
    var left=Number(p[6]),top=Number(p[7]),width=Number(p[8]),height=Number(p[9]),conf=Number(p[10]);
    var word=p.slice(11).join('\t').trim();if(!word)return;
    var point=transform?transform(left+width/2,top+height/2):{x:left+width/2,y:top+height/2};
    out.push({text:word,confidence:isFinite(conf)?conf:0,x:point.x,y:point.y,pass:pass||'original'});
  });
  return out;
}

function loadImage(src){
  return new Promise(function(resolve,reject){
    var img=new Image();img.onload=function(){resolve(img)};img.onerror=reject;img.src=src;
  });
}
async function rotatedData(src,dir){
  var img=await loadImage(src),c=document.createElement('canvas'),x=c.getContext('2d');
  c.width=img.naturalHeight;c.height=img.naturalWidth;
  x.translate(c.width/2,c.height/2);x.rotate(dir*Math.PI/2);
  x.drawImage(img,-img.naturalWidth/2,-img.naturalHeight/2);
  return{data:c.toDataURL('image/jpeg',.94),width:img.naturalWidth,height:img.naturalHeight,rotWidth:c.width,rotHeight:c.height};
}

function mapRotated(meta,dir){
  return function(x,y){
    if(dir===1)return{x:y,y:meta.height-x};
    return{x:meta.width-y,y:x};
  };
}
function dimensionTokens(tokens,fullText,width,height){
  var unit=/\bсм\b/i.test(fullText)?'cm':/\bмм\b/i.test(fullText)?'mm':'cm';
  var out=[];
  tokens.forEach(function(t){
    var hits=clean(t.text).replace(/,/g,'.').match(/\d{1,4}(?:\.\d{1,2})?/g)||[];
    hits.forEach(function(raw){
      var v=Number(raw);if(!isFinite(v))return;
      var txt=clean(t.text).toLowerCase();
      if(/мм/.test(txt)||unit==='mm')v=v/10;
      else if(/(^|\D)м($|\D)/.test(txt)&&!/см|мм/.test(txt)&&v<20)v=v*100;
      if(v<5||v>1500)return;
      out.push({value:round1(v),confidence:clamp(Number(t.confidence||0)/100,0,1),x:Number(t.x||0),y:Number(t.y||0),xn:width?Number(t.x||0)/width:.5,yn:height?Number(t.y||0)/height:.5,text:t.text,pass:t.pass});
    });
  });
  return out;
}
function canonicalDimensions(items){
  var by={};
  items.forEach(function(x){
    var k=String(round1(x.value));
    if(!by[k])by[k]={value:x.value,confidence:0,points:[]};
    by[k].confidence=Math.max(by[k].confidence,x.confidence||0);
    by[k].points.push(x);
  });
  return Object.keys(by).map(function(k){
    var x=by[k],best=x.points.slice().sort(function(a,b){
      var ao=a.pass==='original'?1:0,bo=b.pass==='original'?1:0;
      return bo-ao||(b.confidence||0)-(a.confidence||0);
    })[0];
    return{value:x.value,confidence:x.confidence,xn:best.xn,yn:best.yn,points:x.points};
  });
}

function equations(values){
  var out=[],n=values.length;
  for(var ti=0;ti<n;ti++){
    var total=values[ti];if(total.value<30)continue;
    for(var i=0;i<n;i++)for(var j=i+1;j<n;j++)for(var k=j+1;k<n;k++){
      if(i===ti||j===ti||k===ti)continue;
      var parts=[values[i],values[j],values[k]];
      if(parts.some(function(x){return x.value>=total.value}))continue;
      var sum=parts.reduce(function(a,x){return a+x.value},0);
      var tol=Math.max(1.2,total.value*.008);
      if(near(sum,total.value,tol)){
        out.push({total:total,parts:parts,sum:round1(sum),error:Math.abs(sum-total.value)});
      }
    }
  }
  return out.sort(function(a,b){return a.error-b.error||b.total.value-a.total.value});
}
function positionScore(eq,axis){
  var p=eq.total;
  if(axis==='horizontal')return (1-clamp(p.yn,0,1))*1.4+(1-Math.abs(.5-clamp(p.xn,0,1)))*.5;
  return (1-clamp(p.xn,0,1))*1.4+(1-Math.abs(.5-clamp(p.yn,0,1)))*.5;
}
function chooseEquations(eqs){
  if(eqs.length<2)return null;
  var horizontal=eqs.slice().sort(function(a,b){return positionScore(b,'horizontal')-positionScore(a,'horizontal')})[0];
  var remaining=eqs.filter(function(e){return e!==horizontal&&e.total.value!==horizontal.total.value});
  if(!remaining.length)return null;
  var vertical=remaining.slice().sort(function(a,b){return positionScore(b,'vertical')-positionScore(a,'vertical')})[0];
  if(positionScore(vertical,'vertical')<positionScore(horizontal,'vertical')&&vertical.total.value>horizontal.total.value){
    var tmp=horizontal;horizontal=vertical;vertical=tmp;
  }
  return{horizontal:horizontal,vertical:vertical};
}
function partByLargest(eq){return eq.parts.slice().sort(function(a,b){return b.value-a.value})[0]}
function otherParts(eq,opening){return eq.parts.filter(function(x){return x!==opening})}

function offsetOrder(parts,axis){
  return parts.slice().sort(function(a,b){
    return axis==='horizontal'?(a.xn-b.xn):(a.yn-b.yn);
  });
}
function bestBy(items,score){var best=null,bestScore=-1e9;items.forEach(function(x){var sc=score(x);if(sc>bestScore){bestScore=sc;best=x}});return best}
function layoutGeometry(dims){
 if(!dims||dims.length<5)return null;
 var totalWCandidates=dims.filter(function(x){return x.value>=100&&x.yn<.32});
 var totalHCandidates=dims.filter(function(x){return x.value>=100&&(x.xn<.28||x.xn>.78)&&x.yn>.15&&x.yn<.90});
 if(!totalWCandidates.length||!totalHCandidates.length)return null;
 var totalW=bestBy(totalWCandidates,function(x){return (x.xn>.2&&x.xn<.8?2:0)-Math.abs(x.xn-.5)+x.value/1000});
 var totalH=bestBy(totalHCandidates.filter(function(x){return x!==totalW}),function(x){return (1-Math.abs(x.yn-.5))*2+x.value/1000});
 if(!totalW||!totalH)return null;
 var openingW=bestBy(dims.filter(function(x){return x!==totalW&&x!==totalH&&x.value<totalW.value}),function(x){return (x.yn>.55?2:0)+(x.xn>.25&&x.xn<.75?1.5:0)+x.value/Math.max(totalW.value,1)});
 var openingH=bestBy(dims.filter(function(x){return x!==totalW&&x!==totalH&&x!==openingW&&x.value<totalH.value}),function(x){return (x.xn>.50&&x.xn<.75?2:0)+(x.yn>.25&&x.yn<.75?1.5:0)+x.value/Math.max(totalH.value,1)});
 if(!openingW||!openingH)return null;
 var rest=dims.filter(function(x){return x!==totalW&&x!==totalH&&x!==openingW&&x!==openingH&&x.value<Math.max(totalW.value,totalH.value)});
 var hOffsets=rest.filter(function(x){return x.yn>.32&&x.yn<.68});
 var vOffsets=rest.filter(function(x){return x.xn>.35&&x.xn<.68});
 var left=null,right=null,top=null,bottom=null;
 hOffsets.forEach(function(x){if(x.xn<.5){if(left==null||x.xn<left.xn)left=x}else if(right==null||x.xn>right.xn)right=x});
 vOffsets.forEach(function(x){if(x.yn<.5){if(top==null||x.yn<top.yn)top=x}else if(bottom==null||x.yn>bottom.yn)bottom=x});
 var wallW=round1(totalW.value),wallH=round1(totalH.value),openW=round1(openingW.value),openH=round1(openingH.value);
 var l=left?round1(left.value):null,r=right?round1(right.value):null,t=top?round1(top.value):null,b=bottom?round1(bottom.value):null;
 if(l==null&&r!=null){var dl=wallW-openW-r;if(dl>0)l=round1(dl)}
 if(r==null&&l!=null){var dr=wallW-openW-l;if(dr>0)r=round1(dr)}
 if(t==null&&b!=null){var dt=wallH-openH-b;if(dt>0)t=round1(dt)}
 if(b==null&&t!=null){var db=wallH-openH-t;if(db>0)b=round1(db)}
 if(l==null||r==null||t==null||b==null)return null;
 var he=Math.abs(l+openW+r-wallW),ve=Math.abs(t+openH+b-wallH);
 if(he>Math.max(2,wallW*.012)||ve>Math.max(2,wallH*.012))return null;
 var avg=[totalW,totalH,openingW,openingH].reduce(function(a,x){return a+(x.confidence||0)},0)/4;
 return{wallWidthCm:wallW,wallHeightCm:wallH,openingWidthCm:openW,openingHeightCm:openH,offsetsCm:{left:l,right:r,top:t,bottom:b},validation:{horizontal:{status:'confirmed',declaredCm:wallW,calculatedCm:round1(l+openW+r),errorCm:round1(he)},vertical:{status:'confirmed',declaredCm:wallH,calculatedCm:round1(t+openH+b),errorCm:round1(ve)}},confidenceScore:round1(clamp(.9+avg*.08,0,1)*100)/100};
}
function geometryFromTokens(tokens,fullText,width,height){
  var dims=canonicalDimensions(dimensionTokens(tokens,fullText,width,height));
  var pair=chooseEquations(equations(dims));if(!pair)return layoutGeometry(dims);
  var h=pair.horizontal,v=pair.vertical,ow=partByLargest(h),oh=partByLargest(v);
  var hs=offsetOrder(otherParts(h,ow),'horizontal'),vs=offsetOrder(otherParts(v,oh),'vertical');
  if(hs.length!==2||vs.length!==2)return null;
  var wallWidth=round1(h.total.value),wallHeight=round1(v.total.value);
  var openingWidth=round1(ow.value),openingHeight=round1(oh.value);
  var left=round1(hs[0].value),right=round1(hs[1].value),top=round1(vs[0].value),bottom=round1(vs[1].value);
  var horizontalError=Math.abs(left+openingWidth+right-wallWidth);
  var verticalError=Math.abs(top+openingHeight+bottom-wallHeight);
  var confirmed=horizontalError<=Math.max(1.2,wallWidth*.008)&&verticalError<=Math.max(1.2,wallHeight*.008);
  var confidence=confirmed?.94:.72;
  var average=[h.total,v.total,ow,oh].reduce(function(a,x){return a+(x.confidence||0)},0)/4;
  confidence=clamp(confidence*.8+average*.2,0,1);
  return{wallWidthCm:wallWidth,wallHeightCm:wallHeight,openingWidthCm:openingWidth,openingHeightCm:openingHeight,
    offsetsCm:{left:left,right:right,top:top,bottom:bottom},
    validation:{horizontal:{status:horizontalError<=1.5?'confirmed':'conflict',declaredCm:wallWidth,calculatedCm:round1(left+openingWidth+right),errorCm:round1(horizontalError)},
      vertical:{status:verticalError<=1.5?'confirmed':'conflict',declaredCm:wallHeight,calculatedCm:round1(top+openingHeight+bottom),errorCm:round1(verticalError)}},
    confidenceScore:round1(confidence*100)/100};
}

function resultFromGeometry(g,text,attachmentIndex){
  if(!g)return null;
  var confidence=g.confidenceScore>=.85?'high':g.confidenceScore>=.6?'medium':'low';
  var wallArea=g.wallWidthCm*g.wallHeightCm/10000;
  var openingArea=g.openingWidthCm*g.openingHeightCm/10000;
  var workZone=/зон\w*\s+для\s+утепл|утепл/i.test(text)&&/окн/i.test(text)?'windowWall':'unknown';
  return{
    type:/черт|схем|размер|см/i.test(text)?'dimensioned_drawing':'dimensioned_photo',
    object:'balcony',status:'recognized',confidence:confidence,confidenceScore:g.confidenceScore,attachmentIndex:attachmentIndex,
    geometry:{surfaces:{windowWall:{known:true,widthCm:g.wallWidthCm,heightCm:g.wallHeightCm,status:'known'}},
      openings:[{type:'window',surface:'windowWall',widthCm:g.openingWidthCm,heightCm:g.openingHeightCm,offsetsCm:g.offsetsCm}],
      unknownSurfaces:['leftWall','rightWall','floor','ceiling'],workZones:workZone==='windowWall'?['windowWall']:[]},
    geometryValidation:g.validation,
    calculated:{windowWallGrossAreaM2:round1(wallArea*100)/100,windowAreaM2:round1(openingArea*100)/100,windowWallNetAreaM2:round1((wallArea-openingArea)*100)/100},
    provenance:{source:'attachment',status:g.validation.horizontal.status==='confirmed'&&g.validation.vertical.status==='confirmed'?'confirmed_by_geometry':'observed'},
    recognizedText:clean(text).slice(0,1800)
  };
}
function fallbackResult(text,index,error){
  return{type:/черт|схем|размер/i.test(text)?'dimensioned_drawing':'photo',object:'unknown',status:error?'unavailable':'insufficient',
    confidence:'low',confidenceScore:0,attachmentIndex:index,geometry:null,geometryValidation:null,calculated:null,error:error?String(error.message||error):''};
}

async function recognizePass(worker,src,transform,pass){
  var ret=await worker.recognize(src,{}, {text:true,tsv:true});
  return{text:ret.data&&ret.data.text||'',tokens:parseTsv(ret.data&&ret.data.tsv||'',transform,pass)};
}
async function analyzeImage(item,index,logger){
  var img=await loadImage(item.data),worker=await getWorker(logger);
  var original=await recognizePass(worker,item.data,null,'original');
  var allTokens=original.tokens.slice(),allText=original.text||'';
  var g=geometryFromTokens(allTokens,allText,img.naturalWidth,img.naturalHeight);
  if(!g){
    for(var di=0;di<2&&!g;di++){
      var dir=di===0?1:-1,rot=await rotatedData(item.data,dir);
      var pass=await recognizePass(worker,rot.data,mapRotated(rot,dir),dir===1?'cw':'ccw');
      allTokens=allTokens.concat(pass.tokens);allText+='\n'+pass.text;
      g=geometryFromTokens(allTokens,allText,img.naturalWidth,img.naturalHeight);
    }
  }
  return resultFromGeometry(g,allText,index)||fallbackResult(allText,index,null);
}
function combine(results){
  var usable=(results||[]).filter(function(x){return x&&x.geometry});
  if(!usable.length)return{status:'insufficient',confidence:'low',confidenceScore:0,geometry:null,analyses:results||[]};
  usable.sort(function(a,b){return(b.confidenceScore||0)-(a.confidenceScore||0)});
  var best=usable[0];
  return{status:'recognized',confidence:best.confidence,confidenceScore:best.confidenceScore,type:best.type,object:best.object,
    geometry:best.geometry,geometryValidation:best.geometryValidation,calculated:best.calculated,provenance:best.provenance,
    recognizedText:best.recognizedText,analyses:results||[]};
}

async function analyzeAttachments(attachments,options){
  var images=dataImages(attachments).slice(0,3);
  if(!images.length)return{status:'none',confidence:'low',confidenceScore:0,geometry:null,analyses:[]};
  var results=[],logger=options&&options.logger;
  for(var i=0;i<images.length;i++){
    try{
      var r=await analyzeImage(images[i],i,logger);
      results.push(r);images[i].analysis=r;
    }catch(e){
      var f=fallbackResult('',i,e);results.push(f);images[i].analysis=f;
    }
  }
  return combine(results);
}

function fixtureAnalyze(input){
  input=input||{};
  var tokens=(input.tokens||[]).map(function(x){return Object.assign({confidence:95,pass:'original'},x)});
  var g=geometryFromTokens(tokens,input.text||'',Number(input.width||1000),Number(input.height||800));
  return resultFromGeometry(g,input.text||'',0)||fallbackResult(input.text||'',0,null);
}
async function terminate(){
  if(!workerPromise)return;
  try{var w=await workerPromise;await w.terminate()}catch(e){}
  workerPromise=null;
}
window.sdAttachmentAnalyzer={analyzeAttachments:analyzeAttachments,analyzeTokens:fixtureAnalyze,terminate:terminate,version:'1.0'};
})();
