import fs from 'node:fs';
import vm from 'node:vm';
const context={window:{},console};vm.createContext(context);
vm.runInContext(fs.readFileSync('assets/balcony-scheme.js','utf8'),context,{filename:'assets/balcony-scheme.js'});
const w=context.window;function ok(v,m){if(!v)throw new Error(m)}
const task={categoryId:'balcony-insulation',wallSize:'314 × 287 см',openingSize:'180 × 220 см',workZones:['windowWall'],geometryValidation:{horizontal:{status:'confirmed'},vertical:{status:'confirmed'}},geometry:{surfaces:{windowWall:{known:true,widthCm:314,heightCm:287,status:'known'}},openings:[{type:'window',surface:'windowWall',widthCm:180,heightCm:220,offsetsCm:{left:58,right:76,top:26.5,bottom:40.5}}],unknownSurfaces:['leftWall','rightWall','floor','ceiling'],workZones:['windowWall']}};
const m=w.sdBalconyScheme.model(task);
ok(m.exact===true,'known wall and opening must form exact model');
ok(m.left===58&&m.right===76&&m.top===26.5&&m.bottom===40.5,'opening offsets must stay exact');
ok(Math.abs(m.net-5.0518)<.0001,'net wall area must be derived correctly');
ok(m.unknown.includes('leftWall')&&m.unknown.includes('floor'),'unknown surfaces must remain unknown');
const fallback=w.sdBalconyScheme.model({wallSize:'314 × 287 см',openingSize:'180 × 220 см'});
ok(fallback.ww===314&&fallback.wh===287,'legacy wall size must normalize to cm');
ok(fallback.ow===180&&fallback.oh===220,'legacy opening size must normalize to cm');
const svg={attrs:{},innerHTML:'',setAttribute(k,v){this.attrs[k]=v}};
w.sdBalconyScheme.render(svg,task);
function labelPos(value){const re=new RegExp('<text x=\"([^\"]+)\" y=\"([^\"]+)\"[^>]*>'+value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'<\/text>');const m=svg.innerHTML.match(re);return m?{x:Number(m[1]),y:Number(m[2])}:null}
const openings=[...svg.innerHTML.matchAll(/<rect x=\"([^\"]+)\" y=\"([^\"]+)\" width=\"([^\"]+)\" height=\"([^\"]+)\" class=\"opening\"\/>/g)].map(m=>({x:Number(m[1]),y:Number(m[2]),w:Number(m[3]),h:Number(m[4])}));
const detail=openings.at(-1),p220=labelPos('220 см'),p76=labelPos('76 см'),p180=labelPos('180 см'),p405=labelPos('40,5 см');
ok(detail&&p220&&p76&&p180&&p405,'dimension labels must render');
ok(p220.x<detail.x+detail.w&&p76.x>detail.x+detail.w,'opening height and right offset must use separate horizontal lanes');
ok(p180.y<detail.y+detail.h&&p405.y>detail.y+detail.h,'opening width and bottom offset must use separate vertical lanes');
console.log('BALCONY SCHEME REGRESSION: PASS');
