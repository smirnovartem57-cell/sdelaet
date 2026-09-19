(function(){
'use strict';

function esc(v){
  return String(v==null?'':v).replace(/[&<>"']/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}
function num(v){var n=Number(v);return isFinite(n)?n:null}
function fmt(v){if(v==null)return 'не указано';return String(Math.round(v*10)/10).replace('.',',')+' см'}
function pairCm(v){
  var s=String(v||'').toLowerCase().replace(/,/g,'.');
  var m=s.match(/(\d+(?:\.\d+)?)\s*[×xх]\s*(\d+(?:\.\d+)?)\s*(мм|см|м)?/);
  if(!m)return null;
  var a=Number(m[1]),b=Number(m[2]),u=m[3]||((a<=10&&b<=10)?'м':'см');
  if(u==='мм'){a/=10;b/=10}else if(u==='м'){a*=100;b*=100}
  return[a,b];
}
function clone(v){try{return JSON.parse(JSON.stringify(v))}catch(e){return null}}
function model(task){
  task=task||{};
  var g=clone(task.geometry)||{},surfaces=g.surfaces||{},wall=surfaces.windowWall||null;
  var opening=(g.openings||[]).find(function(x){return x&&x.type==='window'})||(g.openings||[])[0]||null;
  if(!wall){
    var wp=pairCm(task.wallSize);if(wp)wall={known:true,widthCm:wp[0],heightCm:wp[1],status:'known'};
  }
  if(!opening){
    var op=pairCm(task.openingSize);if(op)opening={type:'window',surface:'windowWall',widthCm:op[0],heightCm:op[1],offsetsCm:{}};
  }
  var ww=wall&&num(wall.widthCm),wh=wall&&num(wall.heightCm),ow=opening&&num(opening.widthCm),oh=opening&&num(opening.heightCm);
  var off=opening&&opening.offsetsCm||{};
  var left=num(off.left),right=num(off.right),top=num(off.top),bottom=num(off.bottom);
  if(ww&&ow&&left==null&&right==null){left=(ww-ow)/2;right=left}
  if(wh&&oh&&top==null&&bottom==null){top=(wh-oh)/2;bottom=top}
  var exact=!!(ww&&wh&&ow&&oh&&left!=null&&right!=null&&top!=null&&bottom!=null);
  var gross=ww&&wh?ww*wh/10000:null,openArea=ow&&oh?ow*oh/10000:null;
  var net=gross!=null&&openArea!=null?gross-openArea:null;
  return{
    wall:wall,opening:opening,ww:ww,wh:wh,ow:ow,oh:oh,left:left,right:right,top:top,bottom:bottom,exact:exact,
    gross:gross,openingArea:openArea,net:net,
    workZones:g.workZones||task.workZones||[],
    unknown:g.unknownSurfaces||['leftWall','rightWall','floor','ceiling'],
    validation:task.geometryValidation||null
  };
}
function line(x1,y1,x2,y2,cls){
  return '<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" class="'+(cls||'dim')+'"/>';
}
function text(x,y,value,cls,anchor){
  return '<text x="'+x+'" y="'+y+'" class="'+(cls||'label')+'" text-anchor="'+(anchor||'middle')+'">'+esc(value)+'</text>';
}
function render(svg,task){
  if(!svg)return;
  var m=model(task),work=m.workZones.indexOf('windowWall')>=0;
  svg.setAttribute('viewBox','0 0 900 560');
  var back={x:125,y:115,w:240,h:250},win={x:205,y:165,w:100,h:150};
  if(m.ww&&m.wh&&m.ow&&m.oh){
    var l=m.left==null?(m.ww-m.ow)/2:m.left,t=m.top==null?(m.wh-m.oh)/2:m.top;
    win.x=back.x+back.w*l/m.ww;win.y=back.y+back.h*t/m.wh;
    win.w=back.w*m.ow/m.ww;win.h=back.h*m.oh/m.wh;
  }
  var s='<defs><marker id="sdArr" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto-start-reverse"><path d="M0,0 L7,3.5 L0,7 z" fill="#5967d8"/></marker></defs>';
  s+='<style>.shell{fill:#fff;stroke:#dbe3f4;stroke-width:1.5}.known{fill:#eef5ff;stroke:#6879c7;stroke-width:2}.work{fill:#dff6ec;stroke:#16a36a;stroke-width:2}.unknown{fill:#fafbfe;stroke:#aeb8cf;stroke-width:1.7;stroke-dasharray:7 6}.opening{fill:#fff;stroke:#356de1;stroke-width:2.5}.glass{fill:#e7f2ff}.dim{stroke:#5967d8;stroke-width:1.35;marker-start:url(#sdArr);marker-end:url(#sdArr)}.guide{stroke:#aab7db;stroke-width:1}.title{font:800 15px Montserrat,Roboto,sans-serif;fill:#273154}.sub{font:700 11px Montserrat,Roboto,sans-serif;fill:#617093}.label{font:700 11px Montserrat,Roboto,sans-serif;fill:#435175}.small{font:600 9.5px Roboto,sans-serif;fill:#72809e}.good{font:800 10px Montserrat,Roboto,sans-serif;fill:#12885b}.warn{font:800 10px Montserrat,Roboto,sans-serif;fill:#9b6a13}.chip{fill:#fff;stroke:#dbe3f4}.area{font:800 11px Montserrat,Roboto,sans-serif;fill:#4453bf}</style>';
  s+='<rect x="1" y="1" width="898" height="558" rx="20" class="shell"/>';
  s+=text(28,34,'Балкон / лоджия — общая схема','title','start');
  s+=text(495,34,'Деталь известной стороны','title','start');
  s+='<g id="overview">';
  s+='<polygon points="65,75 125,115 365,115 430,75" class="unknown"/>';
  s+='<polygon points="65,75 125,115 125,365 65,405" class="unknown"/>';
  s+='<polygon points="365,115 430,75 430,405 365,365" class="unknown"/>';
  s+='<polygon points="65,405 125,365 365,365 430,405" class="unknown"/>';
  s+='<rect x="'+back.x+'" y="'+back.y+'" width="'+back.w+'" height="'+back.h+'" class="'+(work?'work':'known')+'"/>';
  s+='<rect x="'+win.x.toFixed(1)+'" y="'+win.y.toFixed(1)+'" width="'+win.w.toFixed(1)+'" height="'+win.h.toFixed(1)+'" class="opening"/>';
  s+='<rect x="'+(win.x+3).toFixed(1)+'" y="'+(win.y+3).toFixed(1)+'" width="'+Math.max(0,win.w-6).toFixed(1)+'" height="'+Math.max(0,win.h-6).toFixed(1)+'" class="glass"/>';
  s+=text(245,382,m.ww&&m.wh?fmt(m.ww)+' × '+fmt(m.wh):'размер стороны не указан','sub');
  if(work)s+=text(245,104,'Зона утепления','good');
  s+=text(93,226,'левая стена','small');s+=text(93,240,'размер не указан','small');
  s+=text(398,226,'правая стена','small');s+=text(398,240,'размер не указан','small');
  s+=text(245,94,'потолок: размер не указан','small');
  s+=text(245,423,'пол: размер не указан','small');
  s+='</g>';
  s+='<rect x="485" y="58" width="385" height="420" rx="14" fill="#fbfcff" stroke="#e0e6f4"/>';
  if(m.ww&&m.wh){
    var maxW=285,maxH=265,sc=Math.min(maxW/m.ww,maxH/m.wh),dw=m.ww*sc,dh=m.wh*sc,dx=535+(maxW-dw)/2,dy=115+(maxH-dh)/2;
    var dl=m.left==null?(m.ww-(m.ow||0))/2:m.left,dt=m.top==null?(m.wh-(m.oh||0))/2:m.top;
    var ox=dx+dl*sc,oy=dy+dt*sc,ow=(m.ow||0)*sc,oh=(m.oh||0)*sc;
    s+='<rect x="'+dx.toFixed(1)+'" y="'+dy.toFixed(1)+'" width="'+dw.toFixed(1)+'" height="'+dh.toFixed(1)+'" class="'+(work?'work':'known')+'"/>';
    if(m.ow&&m.oh)s+='<rect x="'+ox.toFixed(1)+'" y="'+oy.toFixed(1)+'" width="'+ow.toFixed(1)+'" height="'+oh.toFixed(1)+'" class="opening"/>';
    s+=line(dx,dy-24,dx+dw,dy-24);s+=text(dx+dw/2,dy-31,fmt(m.ww),'sub');
    s+=line(dx-24,dy,dx-24,dy+dh);s+=text(dx-31,dy+dh/2,fmt(m.wh),'sub','end');
    if(m.ow&&m.oh){
      var insetX=Math.min(20,Math.max(13,ow*.10)),insetY=Math.min(20,Math.max(13,oh*.08));
      var openingWidthY=oy+oh-insetY,openingHeightX=ox+ow-insetX;
      s+=line(ox+10,openingWidthY,ox+ow-10,openingWidthY);s+=text(ox+ow/2,openingWidthY-7,fmt(m.ow),'sub');
      s+=line(openingHeightX,oy+10,openingHeightX,oy+oh-10);s+=text(openingHeightX-7,oy+oh/2,fmt(m.oh),'sub','end');
      if(m.left!=null)s+=text(dx+(ox-dx)/2,oy+oh/2,fmt(m.left),'small');
      if(m.right!=null)s+=text(ox+ow+(dx+dw-ox-ow)/2,oy+oh/2,fmt(m.right),'small');
      if(m.top!=null)s+=text(ox+ow/2,dy+(oy-dy)/2,fmt(m.top),'small');
      if(m.bottom!=null)s+=text(ox+ow/2,oy+oh+(dy+dh-oy-oh)/2,fmt(m.bottom),'small');
    }
    var valid=m.validation&&m.validation.horizontal&&m.validation.vertical&&m.validation.horizontal.status==='confirmed'&&m.validation.vertical.status==='confirmed';
    s+=text(677,414,valid?'✓ Размеры согласуются':'Проверьте размеры',valid?'good':'warn');
    if(m.net!=null)s+=text(677,438,'Стена без окна ≈ '+(Math.round(m.net*100)/100).toFixed(2).replace('.',',')+' м²','area');
    s+=text(677,457,'Расчёт по размерам схемы','small');
  }else{
    s+=text(677,245,'Размеры этой стороны пока не указаны','sub');
    s+=text(677,268,'Точный чертёж появится после данных','small');
  }
  s+='<rect x="28" y="458" width="420" height="70" rx="12" fill="#f8faff" stroke="#dfe5f3"/>';
  s+=text(45,480,'Что ещё неизвестно','sub','start');
  s+=text(45,500,'Боковые стены · пол · потолок — размеры не указаны','small','start');
  s+=text(45,517,'Неизвестная геометрия не подставляется автоматически','small','start');
  svg.innerHTML=s;
}
window.sdBalconyScheme={render:render,model:model,pairCm:pairCm,version:'1.1'};
})();
