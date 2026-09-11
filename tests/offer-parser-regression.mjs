import fs from 'node:fs';import vm from 'node:vm';
const src=fs.readFileSync(new URL('../assets/offer-parser.js',import.meta.url),'utf8');const ctx={window:{}};vm.createContext(ctx);vm.runInContext(src,ctx);const p=ctx.window.sdOfferParser;
const tests=[
['fixed full','Сделаем за 37 000 ₽. Материалы включены. Утепление пола, потолка, стен и парапета, герметизация примыканий. Срок 4 дня. Гарантия 2 года.',o=>o.totalPrice===37000&&o.materialsIncluded===true&&/4/.test(o.leadTime||'')&&/2/.test(o.warranty||'')&&o.worksIncluded.length>=4],
['from price','Стоимость от 25 000 ₽, точнее после замера. Материалы отдельно.',o=>o.totalPrice===25000&&o.priceType==='from'&&o.materialsIncluded===false],
['materials excluded','Работы 31 000 руб. Без материалов. Срок 3 дня.',o=>o.totalPrice===31000&&o.materialsIncluded===false&&/3/.test(o.leadTime||'')],
['extras','Итого 42 000 ₽. Материалы включены. Демонтаж отдельно оплачивается. Возможны дополнительные работы после вскрытия.',o=>o.totalPrice===42000&&o.extraCosts.length>=1],
['measurement','Цена 48 000 ₽ под ключ. Бесплатный замер. Гарантия 1 год.',o=>o.totalPrice===48000&&o.materialsIncluded===true&&o.measurement==='Бесплатный замер'&&/1/.test(o.warranty||'')]
];
let fail=0;for(const [name,text,check] of tests){const out=p.parse(text);const ok=check(out);console.log((ok?'PASS':'FAIL')+' '+name,JSON.stringify(out));if(!ok)fail++}if(fail)process.exit(1);console.log('Offer parser regression: '+tests.length+'/'+tests.length+' PASS');