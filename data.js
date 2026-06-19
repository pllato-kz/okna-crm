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
  minus:'<path d="M5 12h14"/>',
  oglass:'<g transform="skewX(-11)" stroke="none"><rect x="4" y="4.5" width="7" height="15" rx="1.6" fill="currentColor" opacity=".5"/><rect x="12.5" y="4.5" width="7" height="15" rx="1.6" fill="currentColor"/></g>',
};
function icon(name, cls){ return `<svg class="svg-i ${cls||''}" viewBox="0 0 24 24">${ICON[name]||''}</svg>`; }

/* ============ HELPERS ============ */
const fmtNum = new Intl.NumberFormat('ru-RU');
function money(n){ return fmtNum.format(Math.round(n||0)) + ' сом'; }
function moneyK(n){ n=n||0; if(Math.abs(n)>=1e6) return (n/1e6).toFixed(n%1e6===0?0:1).replace('.',',')+' млн сом'; if(Math.abs(n)>=1e3) return Math.round(n/1e3)+' тыс сом'; return fmtNum.format(Math.round(n))+' сом'; }
/* выбор падежной формы по числу: f=[ед., 2-4, 5+] */
function rusPlural(n,f){ n=Math.abs(n)%100; const n1=n%10; if(n>10&&n<20) return f[2]; if(n1>1&&n1<5) return f[1]; if(n1===1) return f[0]; return f[2]; }
/* целое число прописью (для договоров и счетов) */
function numToWordsRu(num){
  num=Math.round(Math.abs(num)); if(num===0) return 'ноль';
  const ones=['','один','два','три','четыре','пять','шесть','семь','восемь','девять','десять','одиннадцать','двенадцать','тринадцать','четырнадцать','пятнадцать','шестнадцать','семнадцать','восемнадцать','девятнадцать'];
  const onesF=['','одна','две','три','четыре','пять','шесть','семь','восемь','девять','десять','одиннадцать','двенадцать','тринадцать','четырнадцать','пятнадцать','шестнадцать','семнадцать','восемнадцать','девятнадцать'];
  const tens=['','','двадцать','тридцать','сорок','пятьдесят','шестьдесят','семьдесят','восемьдесят','девяносто'];
  const hund=['','сто','двести','триста','четыреста','пятьсот','шестьсот','семьсот','восемьсот','девятьсот'];
  function triad(n,fem){ const r=[]; const h=Math.floor(n/100), t=Math.floor((n%100)/10), o=n%10;
    if(h) r.push(hund[h]);
    if(t>=2){ r.push(tens[t]); if(o) r.push((fem?onesF:ones)[o]); }
    else { const last=n%100; if(last) r.push((fem?onesF:ones)[last]); }
    return r.join(' '); }
  const res=[]; const mil=Math.floor(num/1e6)%1000, thou=Math.floor(num/1e3)%1000, rest=num%1000;
  if(mil){ res.push(triad(mil,false), rusPlural(mil,['миллион','миллиона','миллионов'])); }
  if(thou){ res.push(triad(thou,true), rusPlural(thou,['тысяча','тысячи','тысяч'])); }
  if(rest){ res.push(triad(rest,false)); }
  return res.join(' ').replace(/\s+/g,' ').trim();
}
/* сумма прописью в сомах, с заглавной буквы */
function sumWords(n){ n=Math.round(n||0); const w=numToWordsRu(n); return w.charAt(0).toUpperCase()+w.slice(1)+' '+rusPlural(n,['сом','сома','сомов']); }
function initials(name){ return name.split(' ').filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join(''); }
function colorFor(s){ const p=['#2563eb','#7c3aed','#0891b2','#db2777','#d97706','#16a34a','#dc2626','#0d9488','#9333ea','#ca8a04']; let h=0; for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0; return p[h%p.length]; }
function daysAgo(n){ const d=new Date(SEED_NOW); d.setDate(d.getDate()-n); return d; }
function dateStr(d){ if(typeof d==='string') d=new Date(d); return d.toLocaleDateString('ru-RU',{day:'2-digit',month:'short'}); }
function dateFull(d){ if(typeof d==='string') d=new Date(d); return d.toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'}); }
function chatTime(s){ if(!s) return ''; const d=new Date(s); return d.toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit'})+' '+d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}); }
function uid(p){ return (p||'id')+'_'+Math.random().toString(36).slice(2,8); }
/* экранирование для подстановки в value="" / разметку (формы настроек) */
function escA(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
// «Сейчас» демо привязано к РЕАЛЬНОЙ дате (на момент загрузки): сид-данные
// раскладываются относительно неё через daysAgo(), и при показе всё выглядит
// актуальным. Берём сегодня в 11:00 — для чистых границ суток в бэйджах.
const SEED_NOW = (()=>{ const d=new Date(); d.setHours(11,0,0,0); return d; })();
// Реальный момент для меток времени при СОЗДАНИИ записей (оплаты, события,
// сделки, договоры). В демо ≈ сегодня; в боевом режиме — точное время вызова.
function now(){ return new Date(); }
// «Сейчас» для расчёта просрочки сроков: в демо (localStorage) — SEED_NOW, чтобы
// сид-данные выглядели свежими; в боевом API-режиме — реальное время.
function nowRef(){ try{ return (typeof apiOn==='function' && apiOn()) ? new Date() : SEED_NOW; }catch(e){ return SEED_NOW; } }

/* ============ STATIC CATALOG ============ */
// Стадии воронки. Редактируемые (добавить/удалить/изменить/цвет), хранятся
// в localStorage; в API-режиме переопределяются справочником deal_stages.
const DEFAULT_STAGES = [
  {id:'lead',       name:'Новый лид',   color:'#64748b'},
  {id:'measure',    name:'Замер',       color:'#0891b2'},
  {id:'calc',       name:'Расчёт / КП', color:'#7c3aed'},
  {id:'contract',   name:'Договор',     color:'#2563eb'},
  {id:'prepaid',    name:'Аванс',       color:'#d97706'},
  {id:'production',  name:'Производство',color:'#db2777'},
  {id:'install',    name:'Монтаж',      color:'#0d9488'},
  {id:'done',       name:'Выполнено',   color:'#16a34a'},
];
// Стадии, на id которых завязаны разделы (Замер, Производство) и расчёты —
// их можно переименовать и перекрасить, но не удалять.
const SYSTEM_STAGE_IDS = ['measure','production','install','done'];
const STAGES_KEY = 'okna_crm_stages';
function loadStages(){ try{ const raw=localStorage.getItem(STAGES_KEY); if(raw){ const a=JSON.parse(raw); if(Array.isArray(a)&&a.length) return a; } }catch(e){} return DEFAULT_STAGES.map(s=>({...s})); }
function saveStages(){ try{ localStorage.setItem(STAGES_KEY, JSON.stringify(STAGES)); }catch(e){} }
let STAGES = loadStages();
const stageById = id => STAGES.find(s=>s.id===id);
const stageIndex = id => STAGES.findIndex(s=>s.id===id);

// Этапы цеха (производство). Редактируемые (добавить/удалить/изменить/цвет),
// хранятся в localStorage; в API-режиме переопределяются справочником prod_stages.
const DEFAULT_PROD_STAGES = [
  {id:'queue',     name:'Очередь',          color:'#64748b'},
  {id:'cutting',   name:'Резка профиля',    color:'#0891b2'},
  {id:'glass',     name:'Стеклопакет',      color:'#7c3aed'},
  {id:'assembly',  name:'Сборка',           color:'#d97706'},
  {id:'ready',     name:'Готово к монтажу', color:'#0d9488'},
  {id:'installing',name:'Монтаж',           color:'#db2777'},
];
// Этапы, на id которых завязаны списание материалов и переход на монтаж — не удалять.
const SYSTEM_PROD_IDS = ['queue','cutting','glass','assembly','installing'];
const PROD_STAGES_KEY = 'okna_crm_prod_stages';
function loadProdStages(){ try{ const raw=localStorage.getItem(PROD_STAGES_KEY); if(raw){ const a=JSON.parse(raw); if(Array.isArray(a)&&a.length) return a; } }catch(e){} return DEFAULT_PROD_STAGES.map(s=>({...s})); }
function saveProdStages(){ try{ localStorage.setItem(PROD_STAGES_KEY, JSON.stringify(PROD_STAGES)); }catch(e){} }
let PROD_STAGES = loadProdStages();
const prodStageById = id => PROD_STAGES.find(s=>s.id===id);

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
/* источники лидов (для выбора в сделке) */
const SOURCES = ['Instagram','2GIS','Сайт','Рекомендация','Билборд','Звонок','WhatsApp'];

/* Шаблон договора по умолчанию. Плейсхолдеры подставляются при генерации;
   **жирный** — двойными звёздочками, абзацы — пустой строкой. Директор может
   переопределить этот текст в Настройках — тогда хранится в company.contractTpl. */
const DEFAULT_CONTRACT_TPL =
`**{company}**, именуемое в дальнейшем «Исполнитель», в лице директора {director}, действующего на основании Устава, с одной стороны, и **{client}**, именуемый в дальнейшем «Заказчик», с другой стороны, заключили настоящий договор о нижеследующем.

**1. Предмет договора.** Исполнитель обязуется изготовить и смонтировать светопрозрачные конструкции по адресу: {address} в соответствии со спецификацией (Приложение №1), а Заказчик — принять и оплатить работы.

**2. Цена и порядок оплаты.** Общая стоимость работ — **{total}** ({totalWords}){vat}. Аванс {prepayPct}% ({prepay}) — в течение 3 дней с даты подписания; остаток {rest} — после монтажа.

**3. Сроки.** Готовность изделий — {ready}. Монтаж — {install}.

**4. Гарантия.** Гарантийный срок на изделия и монтаж — 5 лет с даты подписания акта приёма-передачи.`;

/* Закупочная цена профиля за пог.м (отдельно от продажной rate за м²).
   Глобально — чтобы использовать и в сиде, и при миграции старых данных/API. */
const PROFILE_COST = {m1:1200,m2:1300,m3:1700,m4:1900,m5:2600,m6:3100,m7:1500,m8:2500,m9:3500,m10:4400};
// закупочная цена за пог.м с запасным значением (если cost ещё не задан — старые данные/API)
function matCost(m){ if(!m) return 0; return (m.cost!=null && m.cost>0) ? m.cost : (PROFILE_COST[m.id] || Math.round((m.rate||0)/15)); }
// добить недостающие поля профиля (хлыст/закуп/обрезки) — для старого localStorage и API
function migrateMaterials(db){ try{ if(db.offcutMin==null) db.offcutMin=0.3; if(db.cutMargin==null) db.cutMargin=0.05; (db.materials||[]).forEach(m=>{ if(!m.barLen) m.barLen=6; if(m.cost==null) m.cost=matCost(m); delete m.offcut; if(m.bars==null || !Array.isArray(m.offcuts)) normalizeProfile(m); recalcStock(m); }); }catch(e){} return db; }

/* ============ SEED BUILDER ============ */
function buildSeed(){
  const company = { name:'Ocean Glass', legal:'ОсОО «Ocean Glass»', city:'Ош', phone:'+996 995 031 003',
    workshop:'Ноокатский тракт 6-км · завод закалки стекла, окна, фасады, перегородки', revenueYear:'≈ 1 млн $/год',
    // реквизиты для счетов и договоров
    address:'г. Ош, Ноокатский тракт, 6 км', inn:'02508199501234', okpo:'29381745',
    bank:'ОАО «Айыл Банк», г. Ош', account:'1280010000123456', bik:'128001',
    director:'Сапаров Исхак Маратович', directorShort:'Сапаров И. М.', vatRate:12, stamp:true };

  const users = [
    {id:'u_isk', name:'Исхак Сапаров',  role:'director',  title:'Директор',            primary:true},
    {id:'u_pm',  name:'Платон Цай',      role:'manager',   title:'Менеджер по продажам',primary:true},
    {id:'u_ps',  name:'Данияр Оспанов',  role:'surveyor',  title:'Замерщик',            primary:true},
    {id:'u_as',  name:'Бауыржан Омаров', role:'production', title:'Сборщик',            primary:false},
    {id:'u_wh',  name:'Марат Ким',       role:'warehouse', title:'Завсклад',            primary:false},
  ];

  const materials = [
    {id:'m1',  name:'Montblanc Grace',  type:'ПВХ',      series:'Эконом',  rate:7800,  stock:640, min:300, unit:'пог.м', supplier:'Профиль-Маркет'},
    {id:'m2',  name:'Rehau Blitz 60',   type:'ПВХ',      series:'Эконом',  rate:8500,  stock:210, min:300, unit:'пог.м', supplier:'Rehau'},
    {id:'m3',  name:'KBE Эталон 58',    type:'ПВХ',      series:'Средняя', rate:11000, stock:480, min:250, unit:'пог.м', supplier:'profine'},
    {id:'m4',  name:'Rehau Grazio 70',  type:'ПВХ',      series:'Средняя', rate:12000, stock:355, min:250, unit:'пог.м', supplier:'Rehau'},
    {id:'m5',  name:'Veka Softline 70', type:'ПВХ',      series:'Премиум', rate:16500, stock:120, min:150, unit:'пог.м', supplier:'Veka'},
    {id:'m6',  name:'Rehau Geneo 86',   type:'ПВХ',      series:'Премиум', rate:18500, stock:90,  min:120, unit:'пог.м', supplier:'Rehau'},
    {id:'m7',  name:'Provedal P400',    type:'Алюминий', series:'Эконом',  rate:9500,  stock:300, min:200, unit:'пог.м', supplier:'Алютех'},
    {id:'m8',  name:'Alutech W62',      type:'Алюминий', series:'Средняя', rate:16000, stock:175, min:150, unit:'пог.м', supplier:'Алютех'},
    {id:'m9',  name:'Alutech ALT W72',  type:'Алюминий', series:'Премиум', rate:22000, stock:60,  min:100, unit:'пог.м', supplier:'Алютех'},
    {id:'m10', name:'Schüco AWS 75',    type:'Алюминий', series:'Премиум', rate:28000, stock:42,  min:80,  unit:'пог.м', supplier:'Schüco'},
  ];
  // Профиль приходит хлыстами по 6 м: barLen — длина хлыста, cost — закупка за пог.м
  // (отдельно от продажной rate за м²). Обрезок выводится из stock (stock % barLen).
  materials.forEach(m=>{ m.barLen=6; m.cost=PROFILE_COST[m.id]||Math.round(m.rate/6); normalizeProfile(m); recalcStock(m); });
  // демо-пачки обрезков (список разных длин) для наглядности раскроя
  const _m4=materials.find(m=>m.id==='m4'); if(_m4){ _m4.bars=58; _m4.offcuts=[4,3.2,2.8]; recalcStock(_m4); }   // 58 хлыст. + 3 обрезка = 358 пог.м
  const _m5=materials.find(m=>m.id==='m5'); if(_m5){ _m5.bars=19; _m5.offcuts=[4.5,2.5,1.5]; recalcStock(_m5); } // 19 хлыст. + 3 обрезка = 122.5 пог.м
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
    ['Айгуль Нурланова','+996 700 318 224','Ош, ул. Курманжан Датки 102'],
    ['Сергей Войтенко','+996 555 442 160','Ош, мкр. Анар 14'],
    ['Гульмира Ахметова','+996 770 905 732','Ош, ул. Масалиева 58'],
    ['ОсОО «СтройДом»','+996 3222 39 11 70','Ош, пр. Ленина 119'],
    ['Дмитрий Лебедев','+996 708 221 881','Кара-Суу, ул. Ленина 22'],
    ['Бекзат Сулейменов','+996 702 660 413','Ош, ул. Гоголя 77'],
    ['Оксана Журавлёва','+996 705 119 305','Ош, мкр. Черёмушки 6'],
    ['Канат Жумабеков','+996 770 503 271','Джалал-Абад, ул. Мира 9'],
    ['ИП Морозова','+996 701 884 550','Ош, ул. Навои 195'],
    ['Алексей Петров','+996 708 770 146','Ош, ул. Чехова 121'],
    ['Жанна Калиева','+996 705 222 904','Ош, мкр. Тулейкен 31'],
    ['ОО «Школа №7»','+996 3222 54 22 18','Ош, ул. Маяковского 5'],
  ];
  const clients = cnames.map((c,i)=>({ id:'cl'+(i+1), name:c[0], phone:c[1], address:c[2],
    type: c[0].match(/ОсОО|ИП|ОО|Школа/)?'Юр. лицо':'Физ. лицо' }));

  const sources=['Instagram','2GIS','Сайт','Рекомендация','Билборд','Звонок'];
  const managers=['u_pm','u_isk'];

  function constr(profileId, w, h, glassId, openId, sashes, extras, qty){
    return {id:uid('cn'), profileId, w, h, glassId, openId, sashes, qty:qty||1, extras:extras||[]};
  }
  // deals across stages
  let deals = [];
  function D(o){ deals.push(Object.assign({payments:[], items:[], kp:null, prodStage:null, source:sources[deals.length%sources.length]}, o)); }

  D({id:'d1',  clientId:'cl1', stage:'lead',     manager:'u_pm', sum:0,       createdAt:daysAgo(1).toISOString(),  stageSince:daysAgo(1).toISOString(),  note:'Окна на балкон, 2 шт', hot:true});
  D({id:'d2',  clientId:'cl2', stage:'lead',     manager:'u_pm', sum:0,       createdAt:daysAgo(2).toISOString(),  stageSince:daysAgo(2).toISOString(),  note:'Замена 3 окон, хрущёвка'});
  D({id:'d3',  clientId:'cl5', stage:'lead',     manager:'u_isk',sum:0,       createdAt:daysAgo(3).toISOString(),  stageSince:daysAgo(3).toISOString(),  note:'Частный дом, 8 окон + дверь', hot:true});
  D({id:'d4',  clientId:'cl3', stage:'measure',  manager:'u_pm', sum:94526,   createdAt:daysAgo(5).toISOString(),  stageSince:daysAgo(1).toISOString(),  note:'Замер назначен на завтра, 10:00',
      items:[constr('m4',1300,1400,'g2','tilt',2,['mosquito','sill','slopes']), constr('m4',900,1400,'g2','turn',1,['sill'])]});
  D({id:'d5',  clientId:'cl6', stage:'measure',  manager:'u_pm', sum:107720,  createdAt:daysAgo(4).toISOString(),  stageSince:daysAgo(2).toISOString(),  note:'Выехать на замер, лоджия 6м',
      items:[constr('m3',2400,1500,'g2','tilt',3,['sill','slopes','mount'])]});
  D({id:'d6',  clientId:'cl9', stage:'calc',     manager:'u_isk',sum:388700,  createdAt:daysAgo(8).toISOString(),  stageSince:daysAgo(2).toISOString(),  note:'Готовим КП, премиум серия',
      items:[constr('m6',1500,1500,'g3','tilt',2,['sill','slopes','mount','demount'],2), constr('m6',1500,1500,'g3','tilt',2,['sill','slopes','mount'],2)]});
  D({id:'d7',  clientId:'cl7', stage:'calc',     manager:'u_pm', sum:295408,  createdAt:daysAgo(7).toISOString(),  stageSince:daysAgo(1).toISOString(),  note:'КП отправлено, ждём ответ',
      items:[constr('m3',1400,1400,'g2','tilt',2,['mosquito','sill','slopes','mount'],4)]});
  D({id:'d8',  clientId:'cl10',stage:'contract', manager:'u_pm', sum:455912,  createdAt:daysAgo(11).toISOString(), stageSince:daysAgo(2).toISOString(),  contractNo:'Д-2026-006', contractDate:daysAgo(1).toISOString().slice(0,10), note:'Согласование договора',
      items:[constr('m4',1600,1500,'g2','tilt',2,['sill','slopes','mount'],5), constr('m4',700,1400,'g2','turn',1,['sill','mount'],2)]});
  D({id:'d9',  clientId:'cl4', stage:'prepaid',  manager:'u_isk',sum:1215616, createdAt:daysAgo(16).toISOString(), stageSince:daysAgo(3).toISOString(),  note:'Объект ОсОО, аванс 50%',
      items:[constr('m8',1800,2100,'g3','tilt',2,['mount','demount'],8), constr('m8',1200,2100,'g3','turn',1,['mount'],4)],
      payments:[{id:uid('p'),type:'Аванс',amount:607808,date:daysAgo(3).toISOString()}]});
  D({id:'d10', clientId:'cl11',stage:'prepaid',  manager:'u_pm', sum:354920,  createdAt:daysAgo(9).toISOString(),  stageSince:daysAgo(1).toISOString(),  note:'Аванс 30% получен',
      items:[constr('m3',1300,1400,'g2','tilt',2,['mosquito','sill','slopes','mount'],5)],
      payments:[{id:uid('p'),type:'Аванс',amount:110000,date:daysAgo(1).toISOString()}]});
  D({id:'d11', clientId:'cl8', stage:'production',manager:'u_isk',sum:729400, createdAt:daysAgo(20).toISOString(), stageSince:daysAgo(5).toISOString(),  prodStage:'assembly', readyDate:daysAgo(1).toISOString().slice(0,10), installDate:daysAgo(-2).toISOString().slice(0,10), contractNo:'Д-2026-005', contractDate:daysAgo(18).toISOString().slice(0,10), note:'В сборке, срок 3 дня',
      items:[constr('m5',1500,1500,'g3','tilt',2,['sill','slopes','mount'],8)],
      payments:[{id:uid('p'),type:'Аванс',amount:364700,date:daysAgo(5).toISOString()}]});
  D({id:'d12', clientId:'cl12',stage:'production',manager:'u_isk',sum:2068608, createdAt:daysAgo(24).toISOString(), stageSince:daysAgo(6).toISOString(),  prodStage:'glass', readyDate:daysAgo(-4).toISOString().slice(0,10), installDate:daysAgo(-7).toISOString().slice(0,10), contractNo:'Д-2026-004', contractDate:daysAgo(22).toISOString().slice(0,10), note:'Гос. объект, 24 окна',
      items:[constr('m4',1600,1900,'g3','tilt',2,['mount','demount'],24)],
      payments:[{id:uid('p'),type:'Аванс',amount:1200000,date:daysAgo(6).toISOString()}]});
  D({id:'d13', clientId:'cl1', stage:'install',  manager:'u_pm', sum:277248,  createdAt:daysAgo(26).toISOString(), stageSince:daysAgo(2).toISOString(),  prodStage:'installing', readyDate:daysAgo(2).toISOString().slice(0,10), installDate:daysAgo(0).toISOString().slice(0,10), contractNo:'Д-2026-003', contractDate:daysAgo(24).toISOString().slice(0,10), note:'Монтаж сегодня',
      items:[constr('m4',1400,1400,'g2','tilt',2,['sill','slopes','mount'],4)],
      payments:[{id:uid('p'),type:'Аванс',amount:138624,date:daysAgo(8).toISOString()}]});
  D({id:'d14', clientId:'cl5', stage:'done',     manager:'u_isk',sum:1339316,createdAt:daysAgo(40).toISOString(), stageSince:daysAgo(7).toISOString(),  prodStage:'installing', readyDate:daysAgo(8).toISOString().slice(0,10), installDate:daysAgo(5).toISOString().slice(0,10), contractNo:'Д-2026-001', contractDate:daysAgo(38).toISOString().slice(0,10), note:'Сдан, остаток оплаты',
      items:[constr('m9',1600,1700,'g3','tilt',2,['sill','slopes','mount','demount'],11)],
      payments:[{id:uid('p'),type:'Аванс',amount:620000,date:daysAgo(20).toISOString()},{id:uid('p'),type:'Доплата',amount:400000,date:daysAgo(5).toISOString()}]});
  D({id:'d15', clientId:'cl3', stage:'done',     manager:'u_pm', sum:451200,  createdAt:daysAgo(34).toISOString(), stageSince:daysAgo(10).toISOString(), prodStage:'installing', readyDate:daysAgo(12).toISOString().slice(0,10), installDate:daysAgo(8).toISOString().slice(0,10), contractNo:'Д-2026-002', contractDate:daysAgo(32).toISOString().slice(0,10), note:'Закрыт полностью',
      items:[constr('m4',1500,1500,'g2','tilt',2,['sill','slopes','mount'],6)],
      payments:[{id:uid('p'),type:'Аванс',amount:225600,date:daysAgo(18).toISOString()},{id:uid('p'),type:'Доплата',amount:225600,date:daysAgo(4).toISOString()}]});

  const payables = [
    {id:'pay1', supplier:'Rehau',          forWhat:'Профиль Geneo/Grazio', amount:1250000, due:daysAgo(-6).toISOString(),  status:'ожидает'},
    {id:'pay2', supplier:'Алютех',         forWhat:'Профиль W62/W72',      amount:680000,  due:daysAgo(-2).toISOString(),  status:'ожидает'},
    {id:'pay3', supplier:'Стеклопакет-Сервис',forWhat:'Стеклопакеты (партия)',amount:540000,  due:daysAgo(3).toISOString(),   status:'просрочено'},
    {id:'pay4', supplier:'MACO',           forWhat:'Фурнитура',            amount:320000,  due:daysAgo(-12).toISOString(), status:'ожидает'},
    {id:'pay5', supplier:'Аренда цеха',       forWhat:'Аренда, май',          amount:450000,  due:daysAgo(-1).toISOString(),  status:'ожидает'},
  ];

  const activity = [
    {who:'u_pm', text:'Принял предоплату 110 000 сом по сделке «Жанна Калиева»', at:daysAgo(1).toISOString(), kind:'money'},
    {who:'u_ps', text:'Завершил замер по адресу ул. Тарана 58', at:daysAgo(1).toISOString(), kind:'measure'},
    {who:'u_isk',text:'Сделка ОсОО «СтройДом» переведена в «Аванс»', at:daysAgo(3).toISOString(), kind:'funnel'},
    {who:'u_as', text:'Заказ «Канат Жумабеков» переведён в «Сборка»', at:daysAgo(2).toISOString(), kind:'prod'},
    {who:'u_pm', text:'Новый лид из Instagram — Айгуль Нурланова', at:daysAgo(1).toISOString(), kind:'lead'},
  ];

  const movements = [
    {id:uid('wm'), kind:'mat',  itemId:'m4', name:'Rehau Grazio 70',             unit:'пог.м', dir:'in',  type:'receipt',    qty:200, reason:'Поставка Rehau',                 balanceAfter:355, who:'u_wh', at:daysAgo(40).toISOString()},
    {id:uid('wm'), kind:'comp', itemId:'c2', name:'Стеклопакет двухкам. 32мм',    unit:'м²',    dir:'in',  type:'receipt',    qty:40,  reason:'Поставка Стеклопакет-Сервис',       balanceAfter:62,  who:'u_wh', at:daysAgo(18).toISOString()},
    {id:uid('wm'), kind:'mat',  itemId:'m5', name:'Veka Softline 70',             unit:'пог.м', dir:'out', type:'production', qty:48,  reason:'В производство — Бекзат Сулейменов',balanceAfter:120, who:'u_as', dealId:'d11', at:daysAgo(6).toISOString()},
    {id:uid('wm'), kind:'comp', itemId:'c5', name:'Фурнитура MACO пов.-откидная', unit:'компл', dir:'out', type:'writeoff',   qty:2,   reason:'Брак при сборке',                   balanceAfter:34,  who:'u_as', at:daysAgo(3).toISOString()},
    {id:uid('wm'), kind:'comp', itemId:'c8', name:'Отлив оцинков. 150мм',         unit:'пог.м', dir:'out', type:'return',     qty:6,   reason:'Возврат поставщику — пересорт',     balanceAfter:18,  who:'u_wh', at:daysAgo(1).toISOString()},
  ];

  const waMessages = [
    {id:'wamsg_d1', clientId:'cl1', dir:'in',  text:'Здравствуйте! Сколько будет стоить остеклить балкон 3 метра?', status:null,        at:'2026-05-29T09:30:00.000Z'},
    {id:'wamsg_d2', clientId:'cl1', dir:'out', text:'Айгуль, здравствуйте! Это Ocean Glass. Ориентировочно от 180 000 сом, точнее посчитаем на замере. Когда удобно?', status:'read',     at:'2026-05-29T09:40:00.000Z'},
    {id:'wamsg_d3', clientId:'cl1', dir:'in',  text:'Давайте завтра после обеда', status:null,                                          at:'2026-05-29T09:50:00.000Z'},
    {id:'wamsg_d4', clientId:'cl1', dir:'out', text:'Отлично, записал замерщика на завтра 14:00. Пришлю КП сразу после замера.', status:'delivered', at:'2026-05-29T09:55:00.000Z'},
    {id:'wamsg_e1', clientId:'cl4', dir:'in',  text:'Добрый день! По объекту — когда планируете монтаж?', status:null,      at:'2026-05-28T11:10:00.000Z'},
    {id:'wamsg_e2', clientId:'cl4', dir:'out', text:'Здравствуйте! Аванс получили, профиль уже в цеху. Монтаж ориентировочно через 10 дней — подтвердим точную дату.', status:'read', at:'2026-05-28T11:20:00.000Z'},
    {id:'wamsg_e3', clientId:'cl4', dir:'in',  text:'Отлично, ждём!', status:null, at:'2026-05-28T11:25:00.000Z'},
  ];

  const tasks = [
    {id:'t_seed1', dealId:'d1', title:'Перезвонить по остеклению балкона', due:daysAgo(1).toISOString(),  assignee:'u_pm',  done:false},
    {id:'t_seed2', dealId:'d4', title:'Выехать на замер, 10:00',           due:SEED_NOW.toISOString(),     assignee:'u_ps',  done:false},
    {id:'t_seed3', dealId:'d6', title:'Отправить КП клиенту',              due:daysAgo(-2).toISOString(),  assignee:'u_isk', done:false},
    {id:'t_seed4', dealId:'d8', title:'Согласовать договор',               due:daysAgo(-1).toISOString(),  assignee:'u_pm',  done:false},
    {id:'t_seed5', dealId:'d2', title:'Уточнить размеры проёмов',          due:daysAgo(2).toISOString(),   assignee:'u_pm',  done:true},
  ];

  return { v:1, seedAnchor: SEED_NOW.toISOString(), offcutMin:0.3, cutMargin:0.05, company, users, materials, components, clients, deals, payables, activity, movements, waMessages, tasks };
}

/* ============ STATE / PERSISTENCE ============ */
const DB_KEY = 'okna_crm_db_v1';
let DB;
// Демо-данные «сползают» относительно сегодняшней даты: при загрузке сдвигаем все
// даты на дельту между сохранённым якорем и сегодня — чтобы при показе в любой день
// сделки/оплаты/просрочки выглядели свежими, не сбрасывая правки пользователя.
function reanchorSeed(db){
  try{
    if(!db) return db;
    const DAY=86400000;
    const target=new Date(); target.setHours(11,0,0,0);
    // нет якоря → это старый сид (был жёстко привязан к 2026-05-29): мигрируем от него
    const anchor = db.seedAnchor ? new Date(db.seedAnchor) : new Date('2026-05-29T11:00:00');
    if(isNaN(anchor.getTime())){ db.seedAnchor=target.toISOString(); return db; }
    const drift=Math.round((target.getTime()-anchor.getTime())/DAY);
    if(drift===0) return db;
    const shiftISO=s=>{ if(!s) return s; const d=new Date(s); return isNaN(d.getTime())?s:new Date(d.getTime()+drift*DAY).toISOString(); };
    const shiftDay=s=>{ if(!s) return s; const d=new Date(s+'T11:00:00'); return isNaN(d.getTime())?s:new Date(d.getTime()+drift*DAY).toISOString().slice(0,10); };
    (db.deals||[]).forEach(dl=>{
      dl.createdAt=shiftISO(dl.createdAt); dl.stageSince=shiftISO(dl.stageSince);
      dl.readyDate=shiftDay(dl.readyDate); dl.installDate=shiftDay(dl.installDate); dl.contractDate=shiftDay(dl.contractDate);
      (dl.payments||[]).forEach(p=>{ p.date=shiftISO(p.date); });
    });
    (db.payables||[]).forEach(p=>{ p.due=shiftISO(p.due); });
    (db.activity||[]).forEach(a=>{ a.at=shiftISO(a.at); });
    (db.movements||[]).forEach(m=>{ m.at=shiftISO(m.at); });
    (db.tasks||[]).forEach(t=>{ t.due=shiftISO(t.due); });
    (db.waMessages||[]).forEach(m=>{ if(m.at) m.at=shiftISO(m.at); });
    db.seedAnchor=target.toISOString();
  }catch(e){}
  return db;
}
function loadDB(){
  try{ const raw=localStorage.getItem(DB_KEY); if(raw){ const d=JSON.parse(raw); if(d&&d.v===1){ if(!Array.isArray(d.movements)) d.movements=[]; if(!Array.isArray(d.waMessages)) d.waMessages=[]; if(!Array.isArray(d.tasks)) d.tasks=[]; if(!Array.isArray(d.trash)) d.trash=[]; reanchorSeed(d); migrateMaterials(d); localStorage.setItem(DB_KEY, JSON.stringify(d)); return d; } } }catch(e){}
  const seed=buildSeed(); localStorage.setItem(DB_KEY, JSON.stringify(seed)); return seed;
}
function saveDB(){ try{ localStorage.setItem(DB_KEY, JSON.stringify(DB)); }catch(e){} }
function resetDB(){ localStorage.removeItem(DB_KEY); DB=loadDB(); }
DB = loadDB();

/* ============ КОРЗИНА (мягкое удаление) ============ */
// Метаданные типов: подпись и куда возвращать при восстановлении.
const TRASH_META = {
  client:    {label:'Клиент',      icon:'clients'},
  deal:      {label:'Сделка',      icon:'funnel'},
  material:  {label:'Профиль',     icon:'box'},
  component: {label:'Фурнитура',   icon:'box'},
  glass:     {label:'Стеклопакет', icon:'money'},
  opening:   {label:'Открывание',  icon:'money'},
  extra:     {label:'Опция',       icon:'money'},
  payable:   {label:'Долг поставщику', icon:'wallet'},
};
// Варианты срока хранения в корзине (дней; 0 — бессрочно).
const RETENTION_OPTS = [ [7,'7 дней'], [30,'30 дней'], [90,'90 дней'], [0,'Бессрочно'] ];
const TRASH_DEFAULT_DAYS = 30;
// Сколько осталось до автоудаления (мс); null — бессрочно.
function trashMsLeft(rec){
  if(!rec || !rec.retentionDays) return null;
  return new Date(rec.deletedAt).getTime() + rec.retentionDays*86400000 - Date.now();
}

const THEME_KEY = 'okna_crm_theme';
function loadTheme(){ try{ return localStorage.getItem(THEME_KEY) || 'light'; }catch(e){ return 'light'; } }
function applyTheme(t){ document.documentElement.setAttribute('data-theme', t); }
const state = { user:null, module:null, measureDealId:null, financeTab:'recv', financePeriod:'all', financeFrom:null, financeTo:null, whTab:'profile', whMoveType:'all', whMovePeriod:'all', whMoveFrom:null, whMoveTo:null, whSearch:'', whLow:false, funnelMgr:'all', funnelStage:'all', funnelSrc:'all', clientType:'all', clientDebt:'all', clientSearch:'', stageEdit:false, prodEdit:false, sideOpen:false, theme:loadTheme() };
/* настройки WhatsApp (Green API); заполняется при входе в API-режиме, токен наружу не приходит */
let waConfig = { configured:false, enabled:false, idInstance:'' };
let igConfig = { configured:false, enabled:false, username:'' };
applyTheme(state.theme);

/* ============ ПРОЧИТАННЫЕ УВЕДОМЛЕНИЯ ============ */
// id прочитанных уведомлений (badge считает только непрочитанные). localStorage.
const NOTIF_READ_KEY = 'okna_crm_notif_read';
function loadNotifRead(){ try{ const raw=localStorage.getItem(NOTIF_READ_KEY); if(raw){ const a=JSON.parse(raw); if(Array.isArray(a)) return new Set(a); } }catch(e){} return new Set(); }
let notifRead = loadNotifRead();
function saveNotifRead(){ try{ localStorage.setItem(NOTIF_READ_KEY, JSON.stringify([...notifRead])); }catch(e){} }

/* ============ БЫСТРЫЕ СООБЩЕНИЯ WHATSAPP (шаблоны по этапам) ============ */
// Шаблоны хранятся в localStorage (переживают перезагрузку в любом режиме).
// Плейсхолдеры: {client} {company} {phone} {address} {stage} {manager} {total} {prepay} {debt}
const WA_TPL_KEY = 'okna_crm_wa_templates';
const WA_TPL_VARS = ['{client}','{company}','{phone}','{address}','{stage}','{manager}','{total}','{prepay}','{debt}'];
function defaultWaTemplates(){ return [
  {id:'wt_hello',    stage:'any',       label:'Приветствие',           text:'Здравствуйте, {client}! Это {company}. Спасибо за обращение — готовы помочь с расчётом и замером по вашим окнам.'},
  {id:'wt_lead',     stage:'lead',      label:'Новый лид',             text:'{client}, здравствуйте! Это {company}. Подскажите удобное время, чтобы обсудить ваши окна и записать на бесплатный замер?'},
  {id:'wt_meas',     stage:'measure',   label:'Запись на замер',       text:'{client}, здравствуйте! Это {company}. Готовы приехать на замер. В какой день и время вам удобно?'},
  {id:'wt_meas2',    stage:'measure',   label:'Замерщик выехал',       text:'{client}, наш замерщик выехал к вам по адресу {address}. Будет в течение часа.'},
  {id:'wt_kp',       stage:'calc',      label:'КП готово',             text:'{client}, подготовили коммерческое предложение по вашим окнам на сумму {total}. Для запуска заказа предоплата — {prepay}. С радостью ответим на вопросы.'},
  {id:'wt_contract', stage:'contract',  label:'Договор',               text:'{client}, договор готов. Отправляем реквизиты и детали. Подскажите, всё ли удобно?'},
  {id:'wt_prepaid',  stage:'prepaid',   label:'Аванс получен',         text:'{client}, спасибо! Аванс получен, запускаем ваш заказ в производство. Сообщим о готовности.'},
  {id:'wt_prod',     stage:'production',label:'В производстве',        text:'{client}, ваши окна в производстве. Держим вас в курсе и сообщим, как только всё будет готово к монтажу.'},
  {id:'wt_install',  stage:'install',   label:'Согласовать монтаж',    text:'{client}, изделия готовы! Согласуем дату монтажа — когда вам удобно принять бригаду?'},
  {id:'wt_done',     stage:'done',      label:'Завершено',             text:'{client}, спасибо, что выбрали {company}! Работы завершены. Будем благодарны за отзыв и рекомендации 🙂'},
  {id:'wt_debt',     stage:'any',       label:'Напоминание об оплате', text:'{client}, напоминаем про остаток оплаты по заказу — {debt}. Подскажите, когда планируете внести?'},
]; }
function loadWaTemplates(){
  try{ const raw=localStorage.getItem(WA_TPL_KEY); if(raw){ const a=JSON.parse(raw); if(Array.isArray(a)) return a; } }catch(e){}
  const def=defaultWaTemplates(); try{ localStorage.setItem(WA_TPL_KEY, JSON.stringify(def)); }catch(e){} return def;
}
function saveWaTemplates(){ try{ localStorage.setItem(WA_TPL_KEY, JSON.stringify(WA_TEMPLATES)); }catch(e){} }
let WA_TEMPLATES = loadWaTemplates();
// данные для подстановки плейсхолдеров
function waTplData(cl, d){
  const co=(DB.company&&DB.company.name)||''; let total='',prepay='',debt='';
  if(d){ const k=(typeof computeMeasure==='function')?computeMeasure(d):{total:d.sum||0,prepay:0};
    total=money(k.total); prepay=money(k.prepay); debt=money(Math.max(0,(d.sum||k.total)-dealPaid(d))); }
  return { '{client}':cl?cl.name:'', '{company}':co, '{phone}':cl?cl.phone:'', '{address}':cl?cl.address:'',
    '{stage}':d?stageById(d.stage).name:'', '{manager}':d?((userById(d.manager)||{}).name||''):'',
    '{total}':total, '{prepay}':prepay, '{debt}':debt };
}
function renderWaTpl(text, cl, d){ const map=waTplData(cl,d);
  return String(text||'').replace(/\{client\}|\{company\}|\{phone\}|\{address\}|\{stage\}|\{manager\}|\{total\}|\{prepay\}|\{debt\}/g, m=>map[m]!=null?map[m]:m); }
// подходящие шаблоны для сделки: этап сделки + универсальные
function waTemplatesFor(d){
  const stage = d ? d.stage : 'lead';
  const stageTpls = WA_TEMPLATES.filter(t=>t.stage===stage);
  const anyTpls   = WA_TEMPLATES.filter(t=>t.stage==='any');
  return stageTpls.concat(anyTpls);
}

/* Доступ контролирует вход через /api/login (боевой режим). Демо-гейт по ссылке
   (?demo=/?owner=) и связанный код удалены при переходе на боевую версию. */

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
/* Реалистичный расход профиля (пог.м): рама по периметру проёма + вертикальные импосты
   между створками + створочные рамки открывающихся створок (глухие остекляются в раму). */
function profileLen(c){
  const n=Math.max(1, Math.round(c.sashes||1));
  const W=c.w||0, H=c.h||0; const qty=c.qty||1;
  const frame=2*(W+H);            // внешняя рама
  const imposts=(n-1)*H;          // (n−1) вертикальных импостов высотой H
  let sashes=0;                   // рамки только у активных открывающихся створок
  ensureSashList(c).forEach(s=>{ if(s.active && (s.open==='turn'||s.open==='tilt')) sashes+=2*(W/n + H); });
  return Math.round((frame+imposts+sashes)/1000*qty*10)/10; // пог.м, до 0.1
}
/* ============ РЕДАКТИРУЕМЫЕ КАТАЛОГИ И ПРАЙС (Настройки, директор) ============ */
/* Метаданные для UI: что и как редактируется. Цена влияет на расчёт КП напрямую. */
const CATALOGS_EDIT = {
  glass:   { title:'Стеклопакеты', api:'glass_types', prefix:'g',  priceKey:'rate',  unit:'сом/м²',      suffix:'/м²',      arr:()=>GLASS,    usedBy:id=>DB.deals.some(d=>(d.items||[]).some(c=>c.glassId===id)) },
  opening: { title:'Открывания',   api:'openings',    prefix:'op', priceKey:'rate',  unit:'сом/створку', suffix:'/створку', arr:()=>OPENINGS, usedBy:id=>DB.deals.some(d=>(d.items||[]).some(c=>c.openId===id)) },
  extra:   { title:'Доп-опции',    api:'extras',      prefix:'ex', priceKey:'price', unit:'сом', suffix:'', hasPer:true, arr:()=>EXTRAS, usedBy:id=>DB.deals.some(d=>(d.items||[]).some(c=>(c.extras||[]).includes(id))) },
};

/* сколько и чего спишется на данном этапе производства; мутирует склад, флаги в d.consumed */
const GLASS_COMP = {g1:'c1', g2:'c2', g3:'c3'};
const FIT_COMP   = {turn:'c4', tilt:'c5'};
// потребность в фурнитуре — по каждой активной открывающейся створке (глухие не считаем),
// по её типу. Возвращает {compId: кол-во комплектов}. Учитывает по-створочную настройку.
function fittingsNeed(c){
  const q=c.qty||1; const out={};
  ensureSashList(c).forEach(s=>{ if(s.active && (s.open==='turn'||s.open==='tilt')){ const cid=FIT_COMP[s.open]; if(cid) out[cid]=(out[cid]||0)+q; } });
  return out;
}
// минимальная полезная длина обрезка (м): короче — в лом. Редактируется на складе.
function offcutMin(){ return (typeof DB!=='undefined' && DB && DB.offcutMin!=null) ? DB.offcutMin : 0.3; }
// припуск на деталь (м): рез + угловой запил (ус). Обрезок подходит только если
// он ≥ деталь+припуск; этот припуск уходит в потери (опилки/обрезь). Настраивается.
function cutMargin(){ return (typeof DB!=='undefined' && DB && DB.cutMargin!=null) ? DB.cutMargin : 0.05; }
// пересчитать stock (пог.м) из пачки: целые хлысты + список обрезков
function recalcStock(m){ const barLen=m.barLen||6; m.stock=Math.round(((m.bars||0)*barLen + (m.offcuts||[]).reduce((a,b)=>a+(b||0),0))*10)/10; return m.stock; }
// разложить старый суммарный stock на хлысты + один обрезок (миграция/создание)
function normalizeProfile(m){ const barLen=m.barLen||6; const bars=Math.max(0,Math.floor((m.stock||0)/barLen)); const rem=Math.round(((m.stock||0)-bars*barLen)*10)/10; m.bars=bars; m.offcuts=rem>0?[rem]:[]; return m; }
// разбивка остатка профиля: целые хлысты (по barLen) + список обрезков (пог.м)
function barBreakdown(m){
  const barLen=m.barLen||6;
  const bars=(m.bars!=null)?m.bars:Math.max(0, Math.floor((m.stock||0)/barLen));
  const offcuts=Array.isArray(m.offcuts)?m.offcuts.slice():[];
  const offcutTotal=Math.round(offcuts.reduce((a,b)=>a+(b||0),0)*10)/10;
  return {barLen, bars, offcuts, offcutTotal, total:m.stock||0};
}
// список деталей раскроя одной конструкции (длины в метрах, развёрнуто по qty):
// рама (2 ширины + 2 высоты) + (n−1) импостов + рамки активных открывающихся створок
function profileCutList(c){
  const n=Math.max(1, Math.round(c.sashes||1));
  const W=(c.w||0)/1000, H=(c.h||0)/1000, qty=c.qty||1;
  const per=[W,W,H,H];
  for(let i=0;i<n-1;i++) per.push(H);
  ensureSashList(c).forEach(s=>{ if(s.active && (s.open==='turn'||s.open==='tilt')) per.push(W/n,W/n,H,H); });
  const out=[]; for(let q=0;q<qty;q++) per.forEach(l=>out.push(Math.round(l*1000)/1000));
  return out;
}
// раскрой деталей из пачки профиля m: best-fit по обрезкам, иначе вскрываем хлыст.
// мутирует m.bars/m.offcuts, возвращает сводку. Длинные детали режем первыми.
// useOffcuts=false — резать только из целых хлыстов (резчик не берёт обрезки).
// На каждую деталь добавляется припуск cutMargin (рез/ус) — уходит в потери.
function cutPieces(m, pieces, useOffcuts){
  if(useOffcuts===undefined) useOffcuts=true;
  // материалы из API приходят без пачки (bars/offcuts) — выводим её из остатка,
  // иначе recalcStock обнулит склад (bars=0). Демо-слепок уже имеет пачку.
  if(m.bars==null || !Array.isArray(m.offcuts)) normalizeProfile(m);
  const barLen=m.barLen||6, minOff=offcutMin(), mg=cutMargin();
  let offcuts=(m.offcuts||[]).slice(), bars=m.bars||0;
  let fromOffcut=0, openedBars=0, scrap=0, totalCut=0, kerf=0;
  pieces.slice().sort((a,b)=>b-a).forEach(piece=>{
    if(piece<=0) return; totalCut+=piece; kerf+=mg;
    const need=Math.round((piece+mg)*1000)/1000;   // деталь + припуск на рез/ус
    // best-fit: самый короткий обрезок, в который деталь влезает с припуском
    let best=-1, bestLen=Infinity;
    if(useOffcuts) for(let i=0;i<offcuts.length;i++){ if(offcuts[i]>=need-1e-9 && offcuts[i]<bestLen){ best=i; bestLen=offcuts[i]; } }
    if(best>=0){
      const rem=Math.round((offcuts[best]-need)*1000)/1000;
      offcuts.splice(best,1); fromOffcut+=piece;
      if(rem>=minOff) offcuts.push(rem); else if(rem>0) scrap+=rem;
    } else {
      bars--; openedBars++;
      const rem=Math.round((barLen-need)*1000)/1000;
      if(rem>=minOff) offcuts.push(rem); else if(rem>0) scrap+=rem;
    }
  });
  m.bars=Math.max(0,bars); m.offcuts=offcuts.map(x=>Math.round(x*10)/10).filter(x=>x>0); recalcStock(m);
  return {fromOffcut:Math.round(fromOffcut*10)/10, openedBars, scrap:Math.round(scrap*10)/10, totalCut:Math.round(totalCut*10)/10, kerf:Math.round(kerf*10)/10, offcutsLeft:m.offcuts.length};
}
// детали раскроя по каждому профилю сделки: {profileId: [длины, м]}
function cutsByProfile(d){ const out={}; (d.items||[]).forEach(c=>{ const id=c.profileId; (out[id]=out[id]||[]).push(...profileCutList(c)); }); return out; }
// «сухой» расчёт плана раскроя профиля без изменения склада (для подтверждения)
function planCut(m, pieces, useOffcuts){
  // клон с остатком; пачку выведет cutPieces, если её нет (API-материалы)
  const clone={ barLen:m.barLen||6, bars:m.bars, offcuts:Array.isArray(m.offcuts)?m.offcuts.slice():undefined, stock:m.stock };
  return cutPieces(clone, pieces, useOffcuts);
}
// списать qty пог.м профиля вручную (приоритет: мелкие обрезки → хлысты)
function drawMeters(m, qty){
  if(m.bars==null || !Array.isArray(m.offcuts)) normalizeProfile(m);
  const barLen=m.barLen||6, minOff=offcutMin();
  let need=Math.round(qty*10)/10;
  let offcuts=(m.offcuts||[]).slice().sort((a,b)=>a-b); const kept=[];
  while(need>1e-9 && offcuts.length){ const o=offcuts.shift();
    if(o<=need+1e-9){ need=Math.round((need-o)*10)/10; } else { kept.push(Math.round((o-need)*10)/10); need=0; } }
  offcuts=offcuts.concat(kept);
  let bars=m.bars||0;
  while(need>=barLen-1e-9 && bars>0){ bars--; need=Math.round((need-barLen)*10)/10; }
  if(need>1e-9 && bars>0){ bars--; const rem=Math.round((barLen-need)*10)/10; if(rem>=minOff) offcuts.push(rem); else if(rem>0){} need=0; }
  m.bars=Math.max(0,bars); m.offcuts=offcuts.map(x=>Math.round(x*10)/10).filter(x=>x>0); recalcStock(m);
}
function consumeForStage(d, stage, opts){
  d.consumed = d.consumed || {};
  const used = []; const dec = (item, qty, unit) => { if(!item||qty<=0) return; item.stock=Math.max(0, Math.round((item.stock-qty)*10)/10); used.push(`${item.name} −${qty% 1?qty.toFixed(1):qty} ${unit||item.unit}`); };
  if(stage==='cutting' && !d.consumed.profile){
    // раскрой по деталям: для каждого профиля собираем список кусков (рама+импосты+
    // створки), режем best-fit из обрезков (если не отключено), иначе вскрываем хлыст.
    // На деталь — припуск (рез/ус); остатки ≥ порога → в обрезки.
    const f=v=>v%1?Math.round(v*10)/10:v;
    const cutsByProf=cutsByProfile(d);
    Object.keys(cutsByProf).forEach(id=>{ const m=matById(id); if(!m) return;
      const useOff = !(opts && opts.cut && opts.cut[id]===false);
      const r=cutPieces(m, cutsByProf[id], useOff); if(r.totalCut<=0) return;
      const parts=[]; if(r.fromOffcut>0) parts.push(`из обрезков ${f(r.fromOffcut)} м`); if(r.openedBars>0) parts.push(`${r.openedBars} хлыст. (${f(r.openedBars*(m.barLen||6))} м)`);
      used.push(`${m.name}: раскрой ${f(r.totalCut)} м${r.kerf>0?` (+припуск ${f(r.kerf)} м)`:''} — ${parts.join(' + ')||'остатки'}${r.scrap>0?`, лом ${f(r.scrap)} м`:''} · обрезков на складе: ${r.offcutsLeft}`);
    });
    d.consumed.profile = true;
  } else if(stage==='glass' && !d.consumed.glass){
    (d.items||[]).forEach(c=>{ dec(compById(GLASS_COMP[c.glassId]), Math.round(constrArea(c)*(c.qty||1)*10)/10); });
    d.consumed.glass = true;
  } else if(stage==='assembly' && !d.consumed.fittings){
    (d.items||[]).forEach(c=>{
      const fit=fittingsNeed(c); Object.keys(fit).forEach(cid=>dec(compById(cid), fit[cid], 'компл'));
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
/* Нехватка материалов для завершения производства заказа (учитывая уже списанное).
   Возвращает [{name, need, have, lack, unit}] по позициям, которых не хватает на складе. */
function materialShortage(d){
  const items=d.items||[]; const cons=d.consumed||{}; const need={};
  const add=(id,q)=>{ if(!id||q<=0) return; need[id]=(need[id]||0)+q; };
  if(!cons.profile) items.forEach(c=>{ const pcs=profileCutList(c); add(c.profileId, Math.round((pcs.reduce((a,l)=>a+l,0)+pcs.length*cutMargin())*10)/10); });
  if(!cons.glass)   items.forEach(c=>add(GLASS_COMP[c.glassId], Math.round(constrArea(c)*(c.qty||1)*10)/10));
  if(!cons.fittings) items.forEach(c=>{
    const fit=fittingsNeed(c); Object.keys(fit).forEach(cid=>add(cid, fit[cid]));
    (c.extras||[]).forEach(ex=>{
      if(ex==='mosquito') add('c6', c.qty||1);
      if(ex==='sill')     add('c7', Math.round(c.w/1000*(c.qty||1)*10)/10);
      if(ex==='ebb')      add('c8', Math.round(c.w/1000*(c.qty||1)*10)/10);
    });
  });
  const short=[];
  Object.keys(need).forEach(id=>{ const it=matById(id)||compById(id); if(!it) return;
    if((it.stock||0) < need[id]) short.push({name:it.name, need:need[id], have:it.stock||0, lack:Math.round((need[id]-(it.stock||0))*10)/10, unit:it.unit}); });
  return short;
}

/* ============ PRICING ============ */
function constrArea(c){ return (c.w*c.h)/1e6; }
/* ---- Покреативные створки ----
   Каждая створка настраивается отдельно: {open: 'deaf'|'turn'|'tilt',
   dir: 'left'|'right' (петли), active: bool}. c.sashes — их количество.
   sashSel[cid] — индекс выбранной створки в UI (не персистится). */
const sashSel = {};
function ensureSashList(c){
  const n=Math.max(1, Math.min(6, Math.round(c.sashes||1)));
  if(!Array.isArray(c.sashList)) c.sashList=[];
  const half=Math.ceil(n/2);
  while(c.sashList.length<n){ const i=c.sashList.length; c.sashList.push({open:c.openId||'deaf', dir:i<half?'left':'right', active:(c.openId&&c.openId!=='deaf')||i===0}); }
  if(c.sashList.length>n) c.sashList.length=n;
  c.sashList.forEach(s=>{ if(s.open!=='turn'&&s.open!=='tilt'&&s.open!=='deaf') s.open='deaf'; if(s.dir!=='left'&&s.dir!=='right') s.dir='left'; if(typeof s.active!=='boolean') s.active=true; });
  // легаси-поле openId держим осмысленным (первая активная створка) — для старых ссылок
  const firstOpen=c.sashList.find(s=>s.active&&s.open!=='deaf'); c.openId=firstOpen?firstOpen.open:(c.sashList[0]?c.sashList[0].open:'deaf');
  return c.sashList;
}
function sashOpenRate(s){ if(!s||!s.active) return 0; const o=openById(s.open); return o?o.rate:0; }
/* Человекочитаемое описание открывания для КП/счёта/договора/карточки. */
function constrOpenLabel(c){
  const list=ensureSashList(c);
  const counts={};
  list.forEach(s=>{ const k=s.active?(openById(s.open)?.name||'—'):'отключена'; counts[k]=(counts[k]||0)+1; });
  const keys=Object.keys(counts);
  if(keys.length===1) return keys[0];
  return keys.map(k=>`${counts[k]}×${k.toLowerCase()}`).join(', ');
}
/* длина опции в пог.м: «м» — вдоль низа (подоконник/отлив = ширина);
   «периметр» — откосы по трём сторонам проёма (2 высоты + верх, низ занят подоконником) */
function extraLength(c, e){
  if(e.per==='м')        return c.w/1000;
  if(e.per==='периметр') return (2*c.h + c.w)/1000;
  return 0;
}
// расчётная цена за 1 шт (без количества и без ручной правки)
function constrUnitBase(c){
  const m=matById(c.profileId); const g=glassById(c.glassId);
  const area=constrArea(c);
  let p = (m?m.rate:0)*area + (g?g.rate:0)*area + ensureSashList(c).reduce((a,s)=>a+sashOpenRate(s),0);
  (c.extras||[]).forEach(eid=>{ const e=extraById(eid); if(!e) return;
    const len=extraLength(c, e);
    p += len>0 ? e.price*len : e.price;   // длинномерные — по длине, прочее — за штуку
  });
  return Math.round(p);
}
// цена за 1 шт с учётом ручной правки менеджером (priceOverride)
function constrUnitPrice(c){
  const o=c.priceOverride;
  return (o!=null && o!=='' && !isNaN(o)) ? Math.max(0,Math.round(Number(o))) : constrUnitBase(c);
}
// итоговая цена позиции (за всё количество)
function constrPrice(c){ return constrUnitPrice(c) * (c.qty||1); }
function dealItemsSum(d){ return (d.items||[]).reduce((s,c)=>s+constrPrice(c),0); }
function dealPaid(d){ return (d.payments||[]).reduce((s,p)=>s+p.amount,0); }
function dealDebt(d){ const sum=d.sum||dealItemsSum(d); return Math.max(0, sum-dealPaid(d)); }
/* следующий номер договора: Д-<год>-NNN, сквозной по уже выданным */
function nextContractNo(){
  const year=SEED_NOW.getFullYear();
  const used=(DB.deals||[]).map(d=>d.contractNo).filter(Boolean);
  let max=0; used.forEach(no=>{ const m=/-(\d+)$/.exec(no); if(m) max=Math.max(max,+m[1]); });
  return 'Д-'+year+'-'+String(max+1).padStart(3,'0');
}

/* ============ PERMISSIONS ============ */
// Роли — единый источник. Директор может добавлять/удалять роли (sys:true —
// базовые, удалять/переименовывать нельзя) и менять им права в матрице ниже.
const DEFAULT_ROLES = [
  {id:'director',  name:'Директор',     sys:true},
  {id:'manager',   name:'Менеджер',     sys:true},
  {id:'surveyor',  name:'Замерщик',     sys:true},
  {id:'production',name:'Производство', sys:true},
  {id:'warehouse', name:'Склад',        sys:true},
];
let ROLES = DEFAULT_ROLES.map(r=>({...r}));
const roleById  = id => ROLES.find(r=>r.id===id);
const roleName  = id => { const r=roleById(id); return r?r.name:id; };

const MODULE_ROLES = {
  dashboard:['director','manager'],
  funnel:   ['director','manager'],
  clients:  ['director','manager'],
  measure:  ['director','manager','surveyor'],
  warehouse:['director','manager','warehouse','production'],
  production:['director','production','warehouse','surveyor'],
  finance:  ['director','manager'],
  trash:    ['director','manager'],
  wa:       ['director','manager','surveyor'],
  catalog:  ['director'],
  settings: ['director'],
};
function canSee(mod){ return state.user && MODULE_ROLES[mod] && MODULE_ROLES[mod].includes(state.user.role); }
// деньги видит директор всегда + любая роль с доступом к финансам
function seesMoney(){ if(!state.user) return false; if(state.user.role==='director') return true;
  return !!(MODULE_ROLES['finance'] && MODULE_ROLES['finance'].includes(state.user.role)); }
// может ли роль писать в WhatsApp (настраивается в матрице прав)
function canWa(){ if(!state.user) return false; if(state.user.role==='director') return true;
  return !!(MODULE_ROLES['wa'] && MODULE_ROLES['wa'].includes(state.user.role)); }
function defaultModule(role){
  if(role==='surveyor') return 'measure';
  if(role==='production') return 'production';
  if(role==='warehouse') return 'warehouse';
  if(role==='director'||role==='manager') return 'dashboard';
  // кастомная роль — первый доступный ей модуль
  const order=['dashboard','funnel','clients','measure','warehouse','production','finance'];
  return order.find(m=>(MODULE_ROLES[m]||[]).includes(role)) || 'dashboard';
}
// гидрация ролей/прав из локальной БД (демо) — переживает перезагрузку
function hydratePerms(){
  try{
    if(DB && Array.isArray(DB.roles) && DB.roles.length) ROLES = DB.roles.map(r=>({...r}));
    if(DB && DB.moduleRoles && typeof DB.moduleRoles==='object'){
      const def={}; Object.keys(MODULE_ROLES).forEach(k=>def[k]=MODULE_ROLES[k].slice());
      Object.keys(MODULE_ROLES).forEach(k=>delete MODULE_ROLES[k]);
      Object.keys(DB.moduleRoles).forEach(k=>{ MODULE_ROLES[k]=(DB.moduleRoles[k]||[]).slice(); });
      // добить модули, появившиеся в коде позже сохранённой матрицы (напр. «Корзина»)
      Object.keys(def).forEach(k=>{ if(!(k in MODULE_ROLES)) MODULE_ROLES[k]=def[k]; });
    }
  }catch(e){}
}
function persistPerms(){
  try{
    DB.roles = ROLES.map(r=>({...r}));
    DB.moduleRoles = {};
    Object.keys(MODULE_ROLES).forEach(k=>{ DB.moduleRoles[k]=MODULE_ROLES[k].slice(); });
    saveDB();
  }catch(e){}
}
hydratePerms();

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
