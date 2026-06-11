'use strict';
/* ============ ICONS ============ */
const ICON = {
  dashboard:'<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  funnel:'<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
  clients:'<circle cx="9" cy="8" r="3.2"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M16 5.2a3.2 3.2 0 0 1 0 6"/><path d="M17 14.5a5.5 5.5 0 0 1 3.5 5.5"/>',
  measure:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 8h18M8 3v18"/><path d="M5.5 14l2 2M10 14l2 2"/>',
  ruler:'<rect x="2" y="7" width="20" height="10" rx="1.5"/><path d="M6 7v3M10 7v4M14 7v3M18 7v4"/>',
  warehouse:'<path d="M3 9l9-5 9 5v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M3 13h18M8 20v-5h8v5"/>',
  production:'<path d="M4 20h16M6 20V9l5 3V9l5 3V9l3 2v9"/><circle cx="7" cy="5" r="1.4"/>',
  finance:'<path d="M3 3v18h18"/><path d="M7 14l3-3 3 2 5-6"/><path d="M18 7h.01"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2l-.4-2.5H10.8l-.4 2.5a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 6 12a7 7 0 0 0 .1 1.2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2l.4 2.5h2.4l.4-2.5a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5A7 7 0 0 0 19 12z"/>',
  bell:'<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  switch:'<path d="M16 3l4 4-4 4M20 7H8M8 21l-4-4 4-4M4 17h12"/>',
  pin:'<path d="M12 21s-7-6.3-7-11a7 7 0 0 1 14 0c0 4.7-7 11-7 11z"/><circle cx="12" cy="10" r="2.4"/>',
  phone:'<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  wa:'<path d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3z"/><path d="M8.5 8.8c.2-.5.4-.5.7-.5h.5c.2 0 .4 0 .6.5l.7 1.6c.1.2 0 .4-.1.6l-.5.6c-.2.2-.2.4-.1.6.3.6 1.4 1.8 2.5 2.2.2.1.4.1.6-.1l.6-.7c.2-.2.4-.2.6-.1l1.5.8c.2.1.3.3.3.5 0 .8-.6 1.5-1.4 1.6-.7 0-2.5.1-5-2.4S8.3 9.6 8.5 8.8z"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  x:'<path d="M18 6 6 18M6 6l12 12"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',
  calendar:'<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  doc:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  money:'<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9v.01M18 15v.01"/>',
  wallet:'<path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v2"/><path d="M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5"/><circle cx="16.5" cy="12.5" r="1.3"/>',
  trend:'<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
  alert:'<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  box:'<path d="M21 8 12 3 3 8l9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
  hammer:'<path d="M14 6l4 4-7 7-4-4z"/><path d="M14 6l2-2a2.8 2.8 0 0 1 4 4l-2 2"/><path d="M7 13l-4 4 4 4 4-4"/>',
  shield:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
  layers:'<path d="M12 2 2 7l10 5 10-5z"/><path d="M2 12l10 5 10-5M2 17l10 5 10-5"/>',
  star:'<path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z"/>',
  refresh:'<path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  send:'<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/>',
  link:'<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  lock:'<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  copy:'<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  flame:'<path d="M12 3s4 4 4 8a4 4 0 0 1-8 0c0-1 .5-2 1-2.5C9 11 12 9 12 3z"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon:'<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  trash:'<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/>',
};
function icon(name, cls){ return `<svg class="svg-i ${cls||''}" viewBox="0 0 24 24">${ICON[name]||''}</svg>`; }

/* ============ HELPERS ============ */
const fmtNum = new Intl.NumberFormat('ru-RU');
function money(n){ return fmtNum.format(Math.round(n||0)) + ' ₸'; }
function moneyK(n){ n=n||0; if(Math.abs(n)>=1e6) return (n/1e6).toFixed(n%1e6===0?0:1).replace('.',',')+' млн ₸'; if(Math.abs(n)>=1e3) return Math.round(n/1e3)+' тыс ₸'; return fmtNum.format(Math.round(n))+' ₸'; }
function initials(name){ return name.split(' ').filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join(''); }
function colorFor(s){ const p=['#2563eb','#7c3aed','#0891b2','#db2777','#d97706','#16a34a','#dc2626','#0d9488','#9333ea','#ca8a04']; let h=0; for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0; return p[h%p.length]; }
function daysAgo(n){ const d=new Date(SEED_NOW); d.setDate(d.getDate()-n); return d; }
function dateStr(d){ if(typeof d==='string') d=new Date(d); return d.toLocaleDateString('ru-RU',{day:'2-digit',month:'short'}); }
function dateFull(d){ if(typeof d==='string') d=new Date(d); return d.toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'}); }
function uid(p){ return (p||'id')+'_'+Math.random().toString(36).slice(2,8); }
/* экранирование для подстановки в value="" / разметку (формы настроек) */
function escA(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
const SEED_NOW = new Date('2026-05-29T11:00:00');

/* ============ STATIC CATALOG ============ */
const STAGES = [
  {id:'lead',       name:'Новый лид',   color:'#64748b'},
  {id:'measure',    name:'Замер',       color:'#0891b2'},
  {id:'calc',       name:'Расчёт / КП', color:'#7c3aed'},
  {id:'contract',   name:'Договор',     color:'#2563eb'},
  {id:'prepaid',    name:'Аванс',       color:'#d97706'},
  {id:'production',  name:'Производство',color:'#db2777'},
  {id:'install',    name:'Монтаж',      color:'#0d9488'},
  {id:'done',       name:'Выполнено',   color:'#16a34a'},
];
const stageById = id => STAGES.find(s=>s.id===id);
const stageIndex = id => STAGES.findIndex(s=>s.id===id);

const PROD_STAGES = [
  {id:'queue',     name:'Очередь'},
  {id:'cutting',   name:'Резка профиля'},
  {id:'glass',     name:'Стеклопакет'},
  {id:'assembly',  name:'Сборка'},
  {id:'ready',     name:'Готово к монтажу'},
  {id:'installing',name:'Монтаж'},
];

const GLASS = [
  {id:'g1', name:'Однокамерный 24мм',            rate:3500},
  {id:'g2', name:'Двухкамерный 32мм',            rate:5200},
  {id:'g3', name:'Энергосбер. мультифункц. 40мм',rate:7800},
];
const OPENINGS = [
  {id:'deaf', name:'Глухое',            rate:0},
  {id:'turn', name:'Поворотное',        rate:4000},
  {id:'tilt', name:'Поворотно-откидное',rate:7500},
];
const EXTRAS = [
  {id:'mosquito', name:'Москитная сетка', price:6500, per:'шт'},
  {id:'sill',     name:'Подоконник',      price:4500, per:'м'},
  {id:'ebb',      name:'Отлив',           price:3200, per:'м'},
  {id:'slopes',   name:'Откосы',          price:1500, per:'периметр'},
  {id:'mount',    name:'Монтаж',          price:8000, per:'шт'},
  {id:'demount',  name:'Демонтаж старого',price:3000, per:'шт'},
];
const extraById = id => EXTRAS.find(e=>e.id===id);

/* ============ SEED BUILDER ============ */
function buildSeed(){
  const company = { name:'Тёплый Контур', legal:'ТОО «Тёплый Контур»', city:'Костанай', phone:'+7 (7142) 55-08-08',
    workshop:'цех 8 человек · 3 сборщика · бригада монтажа', revenueYear:'≈ 1 млн $/год' };

  const users = [
    {id:'u_isk', name:'Исхак Сапаров',  role:'director',  title:'Директор',            primary:true},
    {id:'u_pm',  name:'Платон Цай',      role:'manager',   title:'Менеджер по продажам',primary:true},
    {id:'u_ps',  name:'Данияр Оспанов',  role:'surveyor',  title:'Замерщик',            primary:true},
    {id:'u_as',  name:'Бауыржан Омаров', role:'production', title:'Сборщик',            primary:false},
    {id:'u_wh',  name:'Марат Ким',       role:'warehouse', title:'Завсклад',            primary:false},
  ];

  const materials = [
    {id:'m1',  name:'Montblanc Grace',  type:'ПВХ',      series:'Эконом',  rate:7800,  stock:640, min:300, unit:'пог.м', supplier:'Профиль-Маркет'},
    {id:'m2',  name:'Rehau Blitz 60',   type:'ПВХ',      series:'Эконом',  rate:8500,  stock:210, min:300, unit:'пог.м', supplier:'Rehau KZ'},
    {id:'m3',  name:'KBE Эталон 58',    type:'ПВХ',      series:'Средняя', rate:11000, stock:480, min:250, unit:'пог.м', supplier:'profine KZ'},
    {id:'m4',  name:'Rehau Grazio 70',  type:'ПВХ',      series:'Средняя', rate:12000, stock:355, min:250, unit:'пог.м', supplier:'Rehau KZ'},
    {id:'m5',  name:'Veka Softline 70', type:'ПВХ',      series:'Премиум', rate:16500, stock:120, min:150, unit:'пог.м', supplier:'Veka Урал'},
    {id:'m6',  name:'Rehau Geneo 86',   type:'ПВХ',      series:'Премиум', rate:18500, stock:90,  min:120, unit:'пог.м', supplier:'Rehau KZ'},
    {id:'m7',  name:'Provedal P400',    type:'Алюминий', series:'Эконом',  rate:9500,  stock:300, min:200, unit:'пог.м', supplier:'Алютех-КЗ'},
    {id:'m8',  name:'Alutech W62',      type:'Алюминий', series:'Средняя', rate:16000, stock:175, min:150, unit:'пог.м', supplier:'Алютех-КЗ'},
    {id:'m9',  name:'Alutech ALT W72',  type:'Алюминий', series:'Премиум', rate:22000, stock:60,  min:100, unit:'пог.м', supplier:'Алютех-КЗ'},
    {id:'m10', name:'Schüco AWS 75',    type:'Алюминий', series:'Премиум', rate:28000, stock:42,  min:80,  unit:'пог.м', supplier:'Schüco Москва'},
  ];
  const components = [
    {id:'c1', name:'Стеклопакет однокам. 24мм', stock:85, min:40, unit:'м²'},
    {id:'c2', name:'Стеклопакет двухкам. 32мм',  stock:62, min:50, unit:'м²'},
    {id:'c3', name:'Стеклопакет энергосбер. 40мм',stock:28, min:40, unit:'м²'},
    {id:'c4', name:'Фурнитура MACO поворотная',  stock:120,min:60, unit:'компл'},
    {id:'c5', name:'Фурнитура MACO пов.-откидная',stock:34, min:50, unit:'компл'},
    {id:'c6', name:'Москитная сетка',            stock:95, min:40, unit:'шт'},
    {id:'c7', name:'Подоконник Danke (бел.)',    stock:210,min:80, unit:'пог.м'},
    {id:'c8', name:'Отлив оцинков. 150мм',       stock:18, min:60, unit:'пог.м'},
  ];

  const cnames = [
    ['Айгуль Нурланова','+7 705 318 22 41','Костанай, ул. Абая 102'],
    ['Сергей Войтенко','+7 701 442 16 09','Костанай, мкр. Юбилейный 14'],
    ['Гульмира Ахметова','+7 747 905 73 28','Костанай, ул. Тарана 58'],
    ['ТОО «СтройДом»','+7 7142 39 11 70','Костанай, пр. Аль-Фараби 119'],
    ['Дмитрий Лебедев','+7 708 221 88 14','Рудный, ул. Ленина 22'],
    ['Бекзат Сулейменов','+7 702 660 41 33','Костанай, ул. Гоголя 77'],
    ['Оксана Журавлёва','+7 705 119 30 52','Костанай, мкр. Наурыз 6'],
    ['Канат Жумабеков','+7 747 503 27 18','Лисаковск, ул. Мира 9'],
    ['ИП Морозова','+7 701 884 55 02','Костанай, ул. Баймагамбетова 195'],
    ['Алексей Петров','+7 708 770 14 63','Костанай, ул. Чехова 121'],
    ['Жанна Калиева','+7 705 222 90 47','Костанай, мкр. Береке 31'],
    ['ОО «Школа №7»','+7 7142 54 22 18','Костанай, ул. Маяковского 5'],
  ];
  const clients = cnames.map((c,i)=>({ id:'cl'+(i+1), name:c[0], phone:c[1], address:c[2],
    type: c[0].match(/ТОО|ИП|ОО|Школа/)?'Юр. лицо':'Физ. лицо' }));

  const sources=['Instagram','2GIS','Сайт','Рекомендация','Билборд','Звонок'];
  const managers=['u_pm','u_isk'];

  function constr(profileId, w, h, glassId, openId, sashes, extras){
    return {id:uid('cn'), profileId, w, h, glassId, openId, sashes, qty:1, extras:extras||[]};
  }
  // deals across stages
  let deals = [];
  function D(o){ deals.push(Object.assign({payments:[], items:[], kp:null, prodStage:null, source:sources[deals.length%sources.length]}, o)); }

  D({id:'d1',  clientId:'cl1', stage:'lead',     manager:'u_pm', sum:0,       createdAt:daysAgo(1).toISOString(),  stageSince:daysAgo(1).toISOString(),  note:'Окна на балкон, 2 шт', hot:true});
  D({id:'d2',  clientId:'cl2', stage:'lead',     manager:'u_pm', sum:0,       createdAt:daysAgo(2).toISOString(),  stageSince:daysAgo(2).toISOString(),  note:'Замена 3 окон, хрущёвка'});
  D({id:'d3',  clientId:'cl5', stage:'lead',     manager:'u_isk',sum:0,       createdAt:daysAgo(3).toISOString(),  stageSince:daysAgo(3).toISOString(),  note:'Частный дом, 8 окон + дверь', hot:true});
  D({id:'d4',  clientId:'cl3', stage:'measure',  manager:'u_pm', sum:0,       createdAt:daysAgo(5).toISOString(),  stageSince:daysAgo(1).toISOString(),  note:'Замер назначен на завтра, 10:00',
      items:[constr('m4',1300,1400,'g2','tilt',2,['mosquito','sill','slopes']), constr('m4',900,1400,'g2','turn',1,['sill'])]});
  D({id:'d5',  clientId:'cl6', stage:'measure',  manager:'u_pm', sum:0,       createdAt:daysAgo(4).toISOString(),  stageSince:daysAgo(2).toISOString(),  note:'Выехать на замер, лоджия 6м',
      items:[constr('m3',2400,1500,'g2','tilt',3,['sill','slopes','mount'])]});
  D({id:'d6',  clientId:'cl9', stage:'calc',     manager:'u_isk',sum:430000,  createdAt:daysAgo(8).toISOString(),  stageSince:daysAgo(2).toISOString(),  note:'Готовим КП, премиум серия',
      items:[constr('m6',1500,1500,'g3','tilt',2,['sill','slopes','mount','demount']), constr('m6',1500,1500,'g3','tilt',2,['sill','slopes','mount'])]});
  D({id:'d7',  clientId:'cl7', stage:'calc',     manager:'u_pm', sum:285000,  createdAt:daysAgo(7).toISOString(),  stageSince:daysAgo(1).toISOString(),  note:'КП отправлено, ждём ответ',
      items:[constr('m3',1400,1400,'g2','tilt',2,['mosquito','sill','slopes','mount'])]});
  D({id:'d8',  clientId:'cl10',stage:'contract', manager:'u_pm', sum:512000,  createdAt:daysAgo(11).toISOString(), stageSince:daysAgo(2).toISOString(),  note:'Согласование договора',
      items:[constr('m4',1600,1500,'g2','tilt',2,['sill','slopes','mount']), constr('m4',700,1400,'g2','turn',1,['sill','mount'])]});
  D({id:'d9',  clientId:'cl4', stage:'prepaid',  manager:'u_isk',sum:1850000, createdAt:daysAgo(16).toISOString(), stageSince:daysAgo(3).toISOString(),  note:'Объект ТОО, аванс 50%',
      items:[constr('m8',1800,2100,'g3','tilt',2,['mount','demount']), constr('m8',1800,2100,'g3','tilt',2,['mount','demount']), constr('m8',1200,2100,'g3','turn',1,['mount'])],
      payments:[{id:uid('p'),type:'Аванс',amount:925000,date:daysAgo(3).toISOString()}]});
  D({id:'d10', clientId:'cl11',stage:'prepaid',  manager:'u_pm', sum:368000,  createdAt:daysAgo(9).toISOString(),  stageSince:daysAgo(1).toISOString(),  note:'Аванс 30% получен',
      items:[constr('m3',1300,1400,'g2','tilt',2,['mosquito','sill','slopes','mount'])],
      payments:[{id:uid('p'),type:'Аванс',amount:110000,date:daysAgo(1).toISOString()}]});
  D({id:'d11', clientId:'cl8', stage:'production',manager:'u_isk',sum:740000,  createdAt:daysAgo(20).toISOString(), stageSince:daysAgo(5).toISOString(),  prodStage:'assembly', note:'В сборке, срок 3 дня',
      items:[constr('m5',1500,1500,'g3','tilt',2,['sill','slopes','mount']), constr('m5',1500,1500,'g3','tilt',2,['sill','slopes','mount'])],
      payments:[{id:uid('p'),type:'Аванс',amount:370000,date:daysAgo(5).toISOString()}]});
  D({id:'d12', clientId:'cl12',stage:'production',manager:'u_isk',sum:2380000, createdAt:daysAgo(24).toISOString(), stageSince:daysAgo(6).toISOString(),  prodStage:'glass', note:'Гос. объект, 24 окна',
      items:[constr('m3',1500,1800,'g2','tilt',2,['mount','demount'])],
      payments:[{id:uid('p'),type:'Аванс',amount:1428000,date:daysAgo(6).toISOString()}]});
  D({id:'d13', clientId:'cl1', stage:'install',  manager:'u_pm', sum:295000,  createdAt:daysAgo(26).toISOString(), stageSince:daysAgo(2).toISOString(),  prodStage:'installing', note:'Монтаж сегодня',
      items:[constr('m4',1400,1400,'g2','tilt',2,['sill','slopes','mount'])],
      payments:[{id:uid('p'),type:'Аванс',amount:150000,date:daysAgo(8).toISOString()}]});
  D({id:'d14', clientId:'cl5', stage:'done',     manager:'u_isk',sum:1240000, createdAt:daysAgo(40).toISOString(), stageSince:daysAgo(7).toISOString(),  prodStage:'installing', note:'Сдан, остаток оплаты',
      items:[constr('m9',1600,1700,'g3','tilt',2,['sill','slopes','mount','demount'])],
      payments:[{id:uid('p'),type:'Аванс',amount:620000,date:daysAgo(20).toISOString()},{id:uid('p'),type:'Доплата',amount:400000,date:daysAgo(5).toISOString()}]});
  D({id:'d15', clientId:'cl3', stage:'done',     manager:'u_pm', sum:486000,  createdAt:daysAgo(34).toISOString(), stageSince:daysAgo(10).toISOString(), prodStage:'installing', note:'Закрыт полностью',
      items:[constr('m4',1500,1500,'g2','tilt',2,['sill','slopes','mount'])],
      payments:[{id:uid('p'),type:'Аванс',amount:243000,date:daysAgo(18).toISOString()},{id:uid('p'),type:'Доплата',amount:243000,date:daysAgo(4).toISOString()}]});

  const payables = [
    {id:'pay1', supplier:'Rehau KZ',          forWhat:'Профиль Geneo/Grazio', amount:1250000, due:daysAgo(-6).toISOString(),  status:'ожидает'},
    {id:'pay2', supplier:'Алютех-КЗ',         forWhat:'Профиль W62/W72',      amount:680000,  due:daysAgo(-2).toISOString(),  status:'ожидает'},
    {id:'pay3', supplier:'Стеклопакет-Сервис',forWhat:'Стеклопакеты (партия)',amount:540000,  due:daysAgo(3).toISOString(),   status:'просрочено'},
    {id:'pay4', supplier:'MACO KZ',           forWhat:'Фурнитура',            amount:320000,  due:daysAgo(-12).toISOString(), status:'ожидает'},
    {id:'pay5', supplier:'Аренда цеха',       forWhat:'Аренда, май',          amount:450000,  due:daysAgo(-1).toISOString(),  status:'ожидает'},
  ];

  const activity = [
    {who:'u_pm', text:'Принял предоплату 110 000 ₸ по сделке «Жанна Калиева»', at:daysAgo(1).toISOString(), kind:'money'},
    {who:'u_ps', text:'Завершил замер по адресу ул. Тарана 58', at:daysAgo(1).toISOString(), kind:'measure'},
    {who:'u_isk',text:'Сделка ТОО «СтройДом» переведена в «Аванс»', at:daysAgo(3).toISOString(), kind:'funnel'},
    {who:'u_as', text:'Заказ «Канат Жумабеков» переведён в «Сборка»', at:daysAgo(2).toISOString(), kind:'prod'},
    {who:'u_pm', text:'Новый лид из Instagram — Айгуль Нурланова', at:daysAgo(1).toISOString(), kind:'lead'},
  ];

  const movements = [
    {id:uid('wm'), kind:'mat',  itemId:'m4', name:'Rehau Grazio 70',             unit:'пог.м', dir:'in',  type:'receipt',    qty:200, reason:'Поставка Rehau KZ',                 balanceAfter:355, who:'u_wh', at:daysAgo(6).toISOString()},
    {id:uid('wm'), kind:'comp', itemId:'c2', name:'Стеклопакет двухкам. 32мм',    unit:'м²',    dir:'in',  type:'receipt',    qty:40,  reason:'Поставка Стеклопакет-Сервис',       balanceAfter:62,  who:'u_wh', at:daysAgo(5).toISOString()},
    {id:uid('wm'), kind:'mat',  itemId:'m5', name:'Veka Softline 70',             unit:'пог.м', dir:'out', type:'production', qty:48,  reason:'В производство — Бекзат Сулейменов',balanceAfter:120, who:'u_as', dealId:'d11', at:daysAgo(5).toISOString()},
    {id:uid('wm'), kind:'comp', itemId:'c5', name:'Фурнитура MACO пов.-откидная', unit:'компл', dir:'out', type:'writeoff',   qty:2,   reason:'Брак при сборке',                   balanceAfter:34,  who:'u_as', at:daysAgo(3).toISOString()},
    {id:uid('wm'), kind:'comp', itemId:'c8', name:'Отлив оцинков. 150мм',         unit:'пог.м', dir:'out', type:'return',     qty:6,   reason:'Возврат поставщику — пересорт',     balanceAfter:18,  who:'u_wh', at:daysAgo(2).toISOString()},
  ];

  return { v:1, company, users, materials, components, clients, deals, payables, activity, movements };
}

/* ============ STATE / PERSISTENCE ============ */
const DB_KEY = 'okna_crm_db_v1';
let DB;
function loadDB(){
  try{ const raw=localStorage.getItem(DB_KEY); if(raw){ const d=JSON.parse(raw); if(d&&d.v===1){ if(!Array.isArray(d.movements)) d.movements=[]; return d; } } }catch(e){}
  const seed=buildSeed(); localStorage.setItem(DB_KEY, JSON.stringify(seed)); return seed;
}
function saveDB(){ try{ localStorage.setItem(DB_KEY, JSON.stringify(DB)); }catch(e){} }
function resetDB(){ localStorage.removeItem(DB_KEY); DB=loadDB(); }
DB = loadDB();

const THEME_KEY = 'okna_crm_theme';
function loadTheme(){ try{ return localStorage.getItem(THEME_KEY) || 'light'; }catch(e){ return 'light'; } }
function applyTheme(t){ document.documentElement.setAttribute('data-theme', t); }
const state = { user:null, module:null, measureDealId:null, financeTab:'recv', whTab:'profile', whMoveType:'all', whMovePeriod:'all', sideOpen:false, theme:loadTheme() };
applyTheme(state.theme);

/* ============ ДОСТУП ПО ССЫЛКЕ (демо-гейт) ============ */
/* Демка с фейковыми данными: подпись не криптостойкая, задача — мягко ограничить
   вход клиента по сроку, а не защищать секреты. */
const GATE_SECRET   = 'okna-pllato-2026';
const OWNER_UNLOCK  = 'pllato-owner-7c';      // ?owner=<этот ключ> разблокирует владельца навсегда
const OWNER_KEY     = 'okna_crm_owner';
const GRANT_KEY     = 'okna_crm_grant';
function _b64e(s){ return btoa(unescape(encodeURIComponent(s))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function _b64d(s){ s=s.replace(/-/g,'+').replace(/_/g,'/'); while(s.length%4)s+='='; return decodeURIComponent(escape(atob(s))); }
function _sig(p){ let h=2166136261>>>0; const str=GATE_SECRET+p+GATE_SECRET; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); } return (h>>>0).toString(36); }
function makeDemoToken(hours, label){ const exp=Date.now()+Math.round(hours*3600*1000); const p=_b64e(JSON.stringify({exp, label:label||'', iat:Date.now()})); return p+'.'+_sig(p); }
function parseDemoToken(tok){ if(!tok||tok.indexOf('.')<0) return null; const [p,s]=tok.split('.'); if(_sig(p)!==s) return null; try{ const o=JSON.parse(_b64d(p)); return o.exp ? o : null; }catch(e){ return null; } }
function demoLink(hours, label){ const t=makeDemoToken(hours,label); return location.origin + location.pathname + '?demo=' + t; }
function isOwner(){ try{ return localStorage.getItem(OWNER_KEY)==='1'; }catch(e){ return false; } }
function currentGrant(){ try{ return JSON.parse(localStorage.getItem(GRANT_KEY)||'null'); }catch(e){ return null; } }
function gateStatus(){
  if(isOwner()) return {mode:'owner'};
  const g=currentGrant();
  if(g && g.exp){ return Date.now()<g.exp ? {mode:'valid', exp:g.exp, label:g.label} : {mode:'expired', exp:g.exp, label:g.label}; }
  return {mode:'open'}; // публичный доступ: демо открыто всем, без ссылки-гейта
}
function initGate(){
  try{
    const params=new URLSearchParams(location.search); let changed=false;
    if(params.get('owner')===OWNER_UNLOCK){ localStorage.setItem(OWNER_KEY,'1'); params.delete('owner'); changed=true; }
    const demo=params.get('demo');
    if(demo){ const o=parseDemoToken(demo); if(o){ localStorage.setItem(GRANT_KEY, JSON.stringify(o)); } params.delete('demo'); changed=true; }
    if(changed){ const q=params.toString(); history.replaceState(null,'', location.pathname+(q?'?'+q:'')+location.hash); }
  }catch(e){}
}
initGate();

/* lookups */
const userById = id => DB.users.find(u=>u.id===id);
const clientById = id => DB.clients.find(c=>c.id===id);
const dealById = id => DB.deals.find(d=>d.id===id);
const matById = id => DB.materials.find(m=>m.id===id);
const compById = id => DB.components.find(c=>c.id===id);
const glassById = id => GLASS.find(g=>g.id===id);
const openById = id => OPENINGS.find(o=>o.id===id);

/* профиль конструкции в пог.м (периметр × кол-во) */
function constrPerimeter(c){ return 2*(c.w+c.h)/1000*(c.qty||1); }
/* сколько и чего спишется на данном этапе производства; мутирует склад, флаги в d.consumed */
const GLASS_COMP = {g1:'c1', g2:'c2', g3:'c3'};
const FIT_COMP   = {turn:'c4', tilt:'c5'};
function consumeForStage(d, stage){
  d.consumed = d.consumed || {};
  const used = []; const dec = (item, qty, unit) => { if(!item||qty<=0) return; item.stock=Math.max(0, Math.round((item.stock-qty)*10)/10); used.push(`${item.name} −${qty% 1?qty.toFixed(1):qty} ${unit||item.unit}`); };
  if(stage==='cutting' && !d.consumed.profile){
    (d.items||[]).forEach(c=>{ dec(matById(c.profileId), Math.round(constrPerimeter(c))); });
    d.consumed.profile = true;
  } else if(stage==='glass' && !d.consumed.glass){
    (d.items||[]).forEach(c=>{ dec(compById(GLASS_COMP[c.glassId]), Math.round(constrArea(c)*(c.qty||1)*10)/10); });
    d.consumed.glass = true;
  } else if(stage==='assembly' && !d.consumed.fittings){
    (d.items||[]).forEach(c=>{
      dec(compById(FIT_COMP[c.openId]), (c.sashes||1)*(c.qty||1), 'компл');
      (c.extras||[]).forEach(ex=>{
        if(ex==='mosquito') dec(compById('c6'), (c.qty||1), 'шт');
        if(ex==='sill')     dec(compById('c7'), Math.round(c.w/1000*(c.qty||1)*10)/10);
        if(ex==='ebb')      dec(compById('c8'), Math.round(c.w/1000*(c.qty||1)*10)/10);
      });
    });
    d.consumed.fittings = true;
  }
  return used;
}

/* ============ PRICING ============ */
function constrArea(c){ return (c.w*c.h)/1e6; }
/* длина опции в пог.м: «м» — вдоль низа (подоконник/отлив = ширина);
   «периметр» — откосы по трём сторонам проёма (2 высоты + верх, низ занят подоконником) */
function extraLength(c, e){
  if(e.per==='м')        return c.w/1000;
  if(e.per==='периметр') return (2*c.h + c.w)/1000;
  return 0;
}
function constrPrice(c){
  const m=matById(c.profileId); const g=glassById(c.glassId); const o=openById(c.openId);
  const area=constrArea(c);
  let p = (m?m.rate:0)*area + (g?g.rate:0)*area + (o?o.rate:0)*(c.sashes||1);
  (c.extras||[]).forEach(eid=>{ const e=extraById(eid); if(!e) return;
    const len=extraLength(c, e);
    p += len>0 ? e.price*len : e.price;   // длинномерные — по длине, прочее — за штуку
  });
  return Math.round(p*(c.qty||1));
}
function dealItemsSum(d){ return (d.items||[]).reduce((s,c)=>s+constrPrice(c),0); }
function dealPaid(d){ return (d.payments||[]).reduce((s,p)=>s+p.amount,0); }
function dealDebt(d){ const sum=d.sum||dealItemsSum(d); return Math.max(0, sum-dealPaid(d)); }

/* ============ PERMISSIONS ============ */
const MODULE_ROLES = {
  dashboard:['director','manager'],
  funnel:   ['director','manager'],
  clients:  ['director','manager'],
  measure:  ['director','manager','surveyor'],
  warehouse:['director','manager','warehouse','production'],
  production:['director','production','warehouse','surveyor'],
  finance:  ['director','manager'],
  settings: ['director'],
};
function canSee(mod){ return state.user && MODULE_ROLES[mod] && MODULE_ROLES[mod].includes(state.user.role); }
function seesMoney(){ return state.user && ['director','manager'].includes(state.user.role); }
function defaultModule(role){
  if(role==='surveyor') return 'measure';
  if(role==='production') return 'production';
  if(role==='warehouse') return 'warehouse';
  return 'dashboard';
}

/* ============ ДВИЖЕНИЯ СКЛАДА (приход/расход) ============ */
/* Типы операций: dir — направление (in/out), color — тег в журнале. */
const MOVE_TYPES = {
  receipt:    { label:'Приход',            dir:'in',  color:'green'  },
  production: { label:'В производство',    dir:'out', color:'violet' },
  writeoff:   { label:'Списание (брак)',   dir:'out', color:'red'    },
  return:     { label:'Возврат поставщику',dir:'out', color:'amber'  },
  adjust:     { label:'Корректировка',     dir:'out', color:'cyan'   },
};
function moveType(t){ return MOVE_TYPES[t] || { label:t||'—', dir:'out', color:'' }; }
/* типы расхода для выбора в модалке списания */
const WRITEOFF_TYPES = ['production','writeoff','return','adjust'];
