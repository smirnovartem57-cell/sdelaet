import {normalizeFnsProfile} from '../src/fns-profile.mjs';
function ok(v,m){if(!v)throw new Error(m)}

const ul=normalizeFnsProfile({
  inn:'7700000000',
  searchRow:{
    inn:'7700000000',ogrn:'1234567890123',namec:'ООО "ТЕСТ"',namep:'ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ "ТЕСТ"',
    dtreg:'03.06.2011',pr_liq:'0',sulst_ex:'10',sulst_name_ex:'Действующая организация',okved2main:'43.32',okved2mainname:'Работы столярные'
  },
  kind:'ul',
  detail:{
    vyp:{
      'ИНН':'7700000000','ОГРН':'1234567890123','НаимЮЛСокр':'ООО "ТЕСТ"','НаимЮЛПолн':'ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ "ТЕСТ"',
      'ДатаРег':'2011-06-03','СумКап':'10000','НаимВидКап':'УСТАВНЫЙ КАПИТАЛ','КодОКВЭД':'43.32','НаимОКВЭД':'Работы столярные',
      sulst_ex:10,sulst_name_ex:'Действующая организация',rsmpcategory:2,rsmpdate:'01.08.2016 00:00:00','ДатаВып':'2026-08-12'
    },
    sschr:[{yearcode:2024,sschr:20},{yearcode:2025,sschr:33}],
    form1:[{yearcode:2024,revenue:10000000,expense:9000000,empty:0},{yearcode:2025,revenue:12000000,expense:10500000,empty:0}],
    arrear:[
      {yearcode:2026,periodcode:8,empty:1},
      {yearcode:2026,periodcode:7,totalsum:15000,empty:0}
    ]
  }
});
ok(ul.entityType==='legal_entity','UL entity type');
ok(ul.active===true&&ul.statusLabel==='Действующая организация','UL active status');
ok(ul.registeredAt==='2011-06-03','UL exact registration date');
ok(ul.legalForm==='ООО','UL legal form');
ok(ul.capital?.amount===10000,'UL charter capital');
ok(ul.employees?.count===33&&ul.employees?.year===2025,'UL latest employees');
ok(ul.finance?.income===12000000&&ul.finance?.expense===10500000&&ul.finance?.profit===1500000&&ul.finance?.year===2025,'UL latest finance');
ok(ul.msp?.label==='Малое предприятие','UL SME category');
ok(ul.debt===null,'latest explicitly empty debt period must not reuse historical debt');

const ulDebt=normalizeFnsProfile({
  inn:'7700000001',
  searchRow:{inn:'7700000001',ogrn:'1234567890124',namec:'ООО "ДОЛГ"',dtreg:'01.01.2020',pr_liq:'0',sulst_ex:'10'},
  kind:'ul',
  detail:{
    vyp:{'ИНН':'7700000001','ОГРН':'1234567890124','НаимЮЛСокр':'ООО "ДОЛГ"','ДатаРег':'2020-01-01',sulst_ex:10},
    arrear:[
      {yearcode:2026,periodcode:8,kbkname:'Налог',totalsum:1200,empty:0},
      {yearcode:2026,periodcode:8,kbkname:'Пени',totalsum:300,empty:0}
    ]
  }
});
ok(ulDebt.debt?.amount===1500&&ulDebt.debt?.year===2026&&ulDebt.debt?.period===8,'current positive debt aggregate');

const ip=normalizeFnsProfile({
  inn:'621200001637',
  searchRow:{inn:'621200001637',ogrn:'325620000011313',namec:'ХРУЛЕВ АЛЕКСЕЙ АЛЕКСЕЕВИЧ',dtogrn:'04.03.2025',predo:'1',pr_sipst:'0',okved2main:'43.32',okved2mainname:'Работы столярные и плотничные'},
  kind:'ip',
  detail:{vyp:{'ИНН':'621200001637','ОГРН':'325620000011313','ДатаРег':'2025-03-04',rsmpcategory:1,rsmpdate:'10.04.2025 00:00:00'}}
});
ok(ip.entityType==='individual_entrepreneur','IP entity type');
ok(ip.registeredAt==='2025-03-04'&&ip.active===true,'IP registration/status');
ok(ip.capital===null&&ip.employees===null&&ip.finance===null,'IP inapplicable company metrics stay absent');
ok(ip.msp?.label==='Микропредприятие','IP SME category');
console.log('FNS PROFILE REGRESSION: PASS');
