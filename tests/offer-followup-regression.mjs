import fs from 'node:fs';
import vm from 'node:vm';
const src=fs.readFileSync(new URL('../assets/offer-followup.js',import.meta.url),'utf8');
const ctx={window:{}};vm.createContext(ctx);vm.runInContext(src,ctx);const build=ctx.window.sdOfferFollowup.build;
function ok(name,cond){if(!cond)throw new Error('FAIL '+name);console.log('PASS',name)}
const winter={goal:'Кабинет / использование зимой'};
let r=build(winter,{totalPrice:37000,materialsIncluded:true,leadTime:'4 дня',warranty:'2 года',worksIncluded:['утепление пола','утепление потолка','утепление стен / парапета','герметизация / примыкания','проверка остекления'],exclusions:['Электрика отдельно'],priceType:'fixed'});
ok('F01 complete offer needs no follow-up',r.needed===false);
r=build(winter,{totalPrice:37000,materialsIncluded:true,leadTime:'4 дня',worksIncluded:[],exclusions:[],priceType:'fixed'});
ok('F02 asks warranty',r.items.some(x=>/гарант/i.test(x)));
ok('F02 asks winter contour',r.items.some(x=>/пол/i.test(x))&&r.items.some(x=>/потол/i.test(x))&&r.items.some(x=>/остеклен/i.test(x)));
ok('F02 max six questions',r.items.length<=6);
r=build(winter,{totalPrice:25000,materialsIncluded:null,leadTime:'',warranty:'',worksIncluded:[],exclusions:[],priceType:'from'});
ok('F03 from-price asks fixed price',r.items.some(x=>/фиксированн/i.test(x)));
ok('F03 no duplicates',new Set(r.items).size===r.items.length);
r=build({goal:'Сделать теплее'},{totalPrice:31000,materialsIncluded:false,leadTime:'3 дня',warranty:'1 год',worksIncluded:['утепление стены'],exclusions:['Материалы не входят'],priceType:'fixed'});
ok('F04 simple scenario does not force full winter contour',!r.items.some(x=>/потол/i.test(x)||/остеклен/i.test(x)));
console.log('Offer follow-up regression: all tests passed');