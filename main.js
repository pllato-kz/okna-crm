'use strict';
/* ============ ACTIONS ============ */
function login(id){ state.user=userById(id); state.module=defaultModule(state.user.role); state.measureDealId=null; render(); }
function logout(){ try{ if(window.API){ API.logout(); API.enabled=false; } }catch(e){} state.user=null; render(); }

/* ====== ВХОД ЧЕРЕЗ API (Слой 4) ====== */
/* Заменяет данные демо серверными (bootstrap), оставляя справочники-константы. */
async function bootFromApi(){
  const mapped = await API.loadBootstrap();
  DB = mapped.DB;            // данные с сервера в формате фронта
  applyServerCatalogs(mapped.catalogs); // справочники и права с сервера → живые глобали
  API.enabled = true;        // включаем запись на сервер
  try { waConfig = await API.wa.getConfig(); } catch(e){ waConfig = { configured:false, enabled:false, idInstance:'' }; }
  return mapped;
}
/* Заменяет содержимое глобальных справочников-констант данными с сервера
   (мутируем на месте — это const-объекты/массивы). Так правки прав/каталогов
   в БД отражаются на фронте и переживают перезагрузку. Пустые наборы игнорим. */
function applyServerCatalogs(cat){
  if(!cat) return;
  const fillArr = (arr, src) => { if(Array.isArray(src) && src.length){ arr.length=0; src.forEach(x=>arr.push(x)); } };
  fillArr(STAGES, cat.STAGES); fillArr(PROD_STAGES, cat.PROD_STAGES);
  fillArr(GLASS, cat.GLASS); fillArr(OPENINGS, cat.OPENINGS); fillArr(EXTRAS, cat.EXTRAS);
  if(cat.MODULE_ROLES && Object.keys(cat.MODULE_ROLES).length){
    Object.keys(MODULE_ROLES).forEach(k=>{ delete MODULE_ROLES[k]; });
    Object.keys(cat.MODULE_ROLES).forEach(k=>{ MODULE_ROLES[k]=cat.MODULE_ROLES[k].slice(); });
  }
}
/* persist: запускает запись на сервер только в API-режиме; ошибку показывает тостом */
function apiOn(){ return !!(window.API && API.enabled); }
function persist(p){ if (p && p.catch) p.catch(e => toast('Не сохранено на сервере: ' + (e && e.message || ''), 'warn')); }
function snapshotStock(){ const m = {}; for (const x of DB.materials) m['m:' + x.id] = x.stock; for (const x of DB.components) m['c:' + x.id] = x.stock; return m; }
function persistStockDiff(before){
  for (const x of DB.materials)  if (before['m:' + x.id] !== x.stock) persist(API.persist.saveMaterial(x));
  for (const x of DB.components) if (before['c:' + x.id] !== x.stock) persist(API.persist.saveComponent(x));
}
/* Запись движения склада (приход/расход). Вызывать ПОСЛЕ изменения item.stock —
   balanceAfter берётся из текущего остатка. Пишет в журнал и (в API-режиме) на сервер. */
function recordMovement(o){
  DB.movements = DB.movements || [];
  const rec = {
    id: uid('wm'), kind: o.kind, itemId: o.item.id, name: o.item.name, unit: o.item.unit,
    dir: o.dir, type: o.type, qty: o.qty, reason: o.reason || '',
    balanceAfter: o.item.stock, dealId: o.dealId || null,
    who: (state.user && state.user.id) || null, at: SEED_NOW.toISOString(),
  };
  DB.movements.unshift(rec);
  if (apiOn()) persist(API.persist.createMovement(rec));
  return rec;
}
async function apiLoginSubmit(){
  const emEl=document.getElementById('api-email'), pwEl=document.getElementById('api-pass');
  const email=(emEl&&emEl.value||'').trim(), password=(pwEl&&pwEl.value||'');
  if(!email||!password){ toast('Введите email и пароль','warn'); return; }
  try{
    const r=await API.login(email,password);
    await bootFromApi();
    const u=r.user||{};
    state.user={ id:u.id, name:u.name, role:u.role_id, title:u.title, email:u.email };
    state.module=defaultModule(state.user.role); state.measureDealId=null;
    render(); toast('Вход выполнен: '+(u.name||email));
  }catch(e){
    toast(e&&e.status===401?'Неверный логин или пароль':('Ошибка входа: '+(e&&e.message||'')), 'warn');
  }
}
function nav(mod){ state.module=mod; state.sideOpen=false; render(); }

function setDealStage(d, stage){
  d.stage=stage; d.stageSince=SEED_NOW.toISOString();
  if(['production','install'].includes(stage) && !d.prodStage) d.prodStage='queue';
  if(stage!=='lead' && !d.sum && (d.items||[]).length) d.sum=computeMeasure(d).total;
  saveDB(); if(apiOn()) persist(API.persist.saveDeal(d));
}
function moveStage(id, stage){
  const d=dealById(id); if(!d) return;
  setDealStage(d, stage); closeModal(); render();
  toast(`Сделка перемещена в «${stageById(stage).name}»`);
}
/* смена стадии из совмещённого вида (чат сделки) — обновляем модалку, не закрывая чат */
function waMoveStage(id, stage){
  const d=dealById(id); if(!d) return;
  if(d.stage===stage) return;
  setDealStage(d, stage); waDealChatModal(id);
  toast(`Стадия: «${stageById(stage).name}»`);
}
function moveProd(id, stage){ const d=dealById(id); if(!d) return; d.prodStage=stage;
  if(stage==='installing' && d.stage==='production') d.stage='install';
  const before = snapshotStock();   // всегда — для журнала движений
  const used=consumeForStage(d, stage);
  if(used.length){
    const cl=clientById(d.clientId);
    DB.activity.unshift({who:state.user.id,text:`Списано со склада (${PROD_STAGES.find(s=>s.id===stage).name}) — ${cl.name}`,at:SEED_NOW.toISOString(),kind:'wh'});
    // движения по уменьшившимся позициям — в журнал прихода/расхода
    for(const m of DB.materials){ const b=before['m:'+m.id]; if(b!=null && m.stock<b) recordMovement({kind:'mat', item:m, dir:'out', type:'production', qty:Math.round((b-m.stock)*10)/10, reason:`В производство — ${cl.name}`, dealId:d.id}); }
    for(const c of DB.components){ const b=before['c:'+c.id]; if(b!=null && c.stock<b) recordMovement({kind:'comp', item:c, dir:'out', type:'production', qty:Math.round((b-c.stock)*10)/10, reason:`В производство — ${cl.name}`, dealId:d.id}); }
  }
  saveDB();
  if(apiOn()){ persist(API.persist.saveDeal(d)); persistStockDiff(before); if(used.length) persist(API.persist.createActivity(DB.activity[0])); }
  closeModal(); render();
  if(used.length){ toast(`Этап «${PROD_STAGES.find(s=>s.id===stage).name}» · списано: ${used.join(', ')}`); }
  else { toast(`Этап: ${PROD_STAGES.find(s=>s.id===stage).name}`); }
  const low=[...DB.materials,...DB.components].filter(x=>x.stock<x.min).map(x=>x.name);
  if(low.length) toast(`⚠ Ниже минимума: ${low.slice(0,3).join(', ')}${low.length>3?` и ещё ${low.length-3}`:''} — нужен дозаказ`); }

function applyPrepay(id){
  const d=dealById(id); if(!d) return; const k=computeMeasure(d);
  d.sum=k.total;
  let addedPay=null;
  if(dealPaid(d)===0){ d.payments=d.payments||[]; addedPay={id:uid('p'),type:'Аванс',amount:k.prepay,date:SEED_NOW.toISOString()}; d.payments.push(addedPay); }
  d.stage='prepaid'; d.stageSince=SEED_NOW.toISOString(); d.prodStage='queue';
  DB.activity.unshift({who:state.user.id,text:`Принял предоплату ${money(k.prepay)} — ${clientById(d.clientId).name}`,at:SEED_NOW.toISOString(),kind:'money'});
  state.measureDealId=null;
  saveDB();
  if(apiOn()){ persist(API.persist.saveDeal(d)); if(addedPay) persist(API.persist.createPayment(d.id, addedPay)); persist(API.persist.createActivity(DB.activity[0])); }
  closeModal(); render();
  toast(`Аванс ${money(k.prepay)} принят · заказ в очереди производства`);
}
function addPaymentModal(id){
  const d=dealById(id); const debt=dealDebt(d); const cl=clientById(d.clientId);
  openModal(`<div class="modal-h">${icon('money')}<div><h3>Принять оплату</h3><div class="mh-sub">${cl.name} · остаток ${money(debt)}</div></div><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b"><div class="fld full"><label>Сумма оплаты, ₸</label><input id="pay-amt" type="number" value="${debt}" style="background:var(--bg2);border:1px solid var(--line);border-radius:9px;padding:11px;color:var(--txt);font-size:16px;font-weight:700"></div>
    <div class="muted2" style="font-size:12px;margin-top:8px">Платёж зачислится по сделке и обновит дебиторку.</div></div>
    <div class="modal-f"><button class="btn" data-act="close-modal">Отмена</button><button class="btn green" data-act="confirm-payment" data-id="${id}">${icon('check','sm')} Зачислить</button></div>`);
}
function confirmPayment(id){
  const d=dealById(id); const amt=parseFloat(document.getElementById('pay-amt').value)||0; if(amt<=0){closeModal();return;}
  d.payments=d.payments||[]; const addedPay={id:uid('p'),type:'Доплата',amount:amt,date:SEED_NOW.toISOString()}; d.payments.push(addedPay);
  const wasDone = d.stage==='done';
  if(dealDebt(d)<=0 && d.stage==='install') d.stage='done';
  saveDB();
  if(apiOn()){ persist(API.persist.createPayment(d.id, addedPay)); if(!wasDone && d.stage==='done') persist(API.persist.saveDeal(d)); }
  closeModal(); render(); toast(`Оплата ${money(amt)} зачислена`);
}
function newDealModal(){
  const opts=DB.clients.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  const inp='background:var(--bg2);border:1px solid var(--line);border-radius:9px;padding:10px;color:var(--txt)';
  openModal(`<div class="modal-h">${icon('funnel')}<h3>Новая сделка</h3><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b">
      <div class="fld full" style="margin-bottom:12px"><label>Клиент</label>
        <select id="nd-client" style="${inp}"><option value="__new">➕ Новый клиент</option>${opts}</select></div>
      <div id="nd-newblock" class="constr-body" style="padding:0;margin-bottom:12px">
        <div class="fld full"><label>Имя / организация</label><input id="nd-name" placeholder="Напр. Айгерим" style="${inp}"></div>
        <div class="fld"><label>Телефон</label><input id="nd-phone" placeholder="+7" style="${inp}"></div>
        <div class="fld"><label>Адрес</label><input id="nd-addr" placeholder="${escA(DB.company.city||'')}" style="${inp}"></div>
      </div>
      <div class="fld full"><label>Комментарий</label><input id="nd-note" placeholder="Что нужно клиенту" style="${inp}"></div></div>
    <div class="modal-f"><button class="btn" data-act="close-modal">Отмена</button><button class="btn primary" data-act="create-deal">${icon('plus','sm')} Создать лид</button></div>`);
  const sel=document.getElementById('nd-client');
  const toggle=()=>{ const nb=document.getElementById('nd-newblock'); if(nb) nb.style.display = sel.value==='__new'?'' : 'none'; };
  if(sel){ sel.addEventListener('change', toggle); toggle(); const nm=document.getElementById('nd-name'); if(nm) nm.focus(); }
}
function createDeal(){
  const sel=document.getElementById('nd-client'); let cid=sel?sel.value:'';
  if(cid==='__new'){
    const v=i=>{const el=document.getElementById(i);return el?el.value.trim():'';};
    const name=v('nd-name'); if(!name){ toast('Укажите имя клиента','warn'); return; }
    const nc={id:uid('cl'),name,phone:v('nd-phone')||'—',address:v('nd-addr')||DB.company.city,type:name.match(/ТОО|ИП|ОО|Школа/)?'Юр. лицо':'Физ. лицо'};
    DB.clients.unshift(nc); if(apiOn()) persist(API.persist.createClient(nc)); cid=nc.id;
  }
  if(!cid){ toast('Выберите клиента','warn'); return; }
  const note=(document.getElementById('nd-note').value||'').trim()||'Новая заявка';
  const nd={id:uid('d'),clientId:cid,stage:'lead',manager:state.user.id,sum:0,createdAt:SEED_NOW.toISOString(),stageSince:SEED_NOW.toISOString(),note,source:'Звонок',payments:[],items:[],kp:null,prodStage:null};
  DB.deals.unshift(nd);
  saveDB(); if(apiOn()) persist(API.persist.createDeal(nd)); closeModal(); renderModule(); toast('Лид создан');
}
function editDealModal(id){
  const d=dealById(id); if(!d) return;
  const mgrs=DB.users.filter(u=>['director','manager'].includes(u.role)||u.id===d.manager);
  const mgrOpts=mgrs.map(u=>`<option value="${u.id}"${u.id===d.manager?' selected':''}>${u.name} · ${roleRu(u.role)}</option>`).join('');
  const srcOpts=SOURCES.map(s=>`<option${s===d.source?' selected':''}>${s}</option>`).join('');
  const money$=seesMoney();
  const moneyFields=money$?`
      <div class="fld"><label>Сумма заказа, ₸</label><input id="ed-sum" type="number" min="0" value="${d.sum||dealItemsSum(d)}"></div>
      <div class="fld"><label>Оплачено, ₸</label><input id="ed-paid" type="number" min="0" value="${dealPaid(d)}"></div>`:'';
  openModal(`<div class="modal-h">${icon('funnel')}<h3>Изменить сделку</h3><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b"><div class="constr-body" style="padding:0">
      <div class="fld"><label>Ответственный</label><select id="ed-mgr">${mgrOpts}</select></div>
      <div class="fld"><label>Источник</label><select id="ed-src">${srcOpts}</select></div>
      ${moneyFields}
      <div class="fld full"><label style="display:flex;align-items:center;gap:9px;text-transform:none;color:var(--txt);font-size:13px"><input type="checkbox" id="ed-hot" ${d.hot?'checked':''} style="width:auto"> Горящий лид</label></div>
      <div class="fld full"><label>Примечание</label><input id="ed-note" value="${escA(d.note||'')}"></div>
    </div>${money$?'<div class="muted2" style="font-size:11px;margin-top:10px;line-height:1.5;padding:0 2px">«Оплачено» сверяется с оплатами: разница добавится отдельной записью платежа.</div>':''}</div>
    <div class="modal-f"><button class="btn" data-act="close-modal">Отмена</button><button class="btn primary" data-act="save-deal-edit" data-id="${id}">${icon('check','sm')} Сохранить</button></div>`);
}
function saveDealEdit(id){
  const d=dealById(id); if(!d) return;
  const mgr=(document.getElementById('ed-mgr')||{}).value; if(mgr) d.manager=mgr;
  const src=(document.getElementById('ed-src')||{}).value; if(src) d.source=src;
  d.hot=!!((document.getElementById('ed-hot')||{}).checked);
  d.note=((document.getElementById('ed-note')||{}).value||'').trim();
  let addedPay=null;
  const sumEl=document.getElementById('ed-sum');
  if(sumEl){ d.sum=Math.max(0,Math.round(parseFloat(sumEl.value)||0)); }
  const paidEl=document.getElementById('ed-paid');
  if(paidEl){
    const newPaid=Math.max(0,Math.round(parseFloat(paidEl.value)||0));
    const delta=newPaid-dealPaid(d);
    if(delta!==0){ addedPay={id:uid('p'), type:'Доплата', amount:delta, date:SEED_NOW.toISOString()}; d.payments=d.payments||[]; d.payments.push(addedPay); }
  }
  saveDB();
  if(apiOn()){ persist(API.persist.saveDeal(d)); if(addedPay) persist(API.persist.createPayment(d.id, addedPay)); }
  closeModal(); render(); toast('Сделка обновлена');
}
/* ====== ИМПОРТ КЛИЕНТОВ ИЗ CSV ====== */
let __impRows=[];
function parseCSV(text){
  text=String(text).replace(/^﻿/,'');
  const firstLine=text.split(/\r?\n/)[0]||'';
  const delim=firstLine.split(';').length>firstLine.split(',').length?';':',';
  const rows=[]; let row=[], cur='', q=false;
  for(let i=0;i<text.length;i++){ const ch=text[i];
    if(q){ if(ch==='"'){ if(text[i+1]==='"'){cur+='"';i++;} else q=false; } else cur+=ch; }
    else if(ch==='"') q=true;
    else if(ch===delim){ row.push(cur); cur=''; }
    else if(ch==='\n'){ row.push(cur); rows.push(row); row=[]; cur=''; }
    else if(ch==='\r'){}
    else cur+=ch;
  }
  if(cur!==''||row.length){ row.push(cur); rows.push(row); }
  return rows.filter(r=>r.some(c=>String(c).trim()!==''));
}
function mapClientRows(rows){
  if(!rows.length) return [];
  const head=rows[0].map(h=>String(h).toLowerCase().trim());
  const find=(...keys)=>head.findIndex(h=>keys.some(k=>h.includes(k)));
  const iName=find('имя','наимен','клиент','организ','назв'), iPhone=find('телефон','тел','phone'), iAddr=find('адрес','address'), iType=find('тип','type');
  let dataRows, idx;
  if(iName>=0||iPhone>=0){ dataRows=rows.slice(1); idx={name:iName>=0?iName:0, phone:iPhone, addr:iAddr, type:iType}; }
  else { dataRows=rows; idx={name:0, phone:1, addr:2, type:3}; }
  return dataRows.map(r=>{
    const g=i=>(i>=0&&i<r.length)?String(r[i]).trim():'';
    const name=g(idx.name); if(!name) return null;
    const typeRaw=g(idx.type).toLowerCase();
    const type = /физ/.test(typeRaw) ? 'Физ. лицо'
      : (/юр|тоо|ип|оо/.test(typeRaw) || /ТОО|ИП|ОО|Школа/.test(name)) ? 'Юр. лицо' : 'Физ. лицо';
    return { name, phone:g(idx.phone)||'—', address:g(idx.addr)||DB.company.city, type };
  }).filter(Boolean);
}
function importClientsModal(){
  __impRows=[];
  openModal(`<div class="modal-h">${icon('clients')}<h3>Импорт клиентов</h3><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b">
      <div class="muted2" style="font-size:12px;line-height:1.5;margin-bottom:12px">Загрузите CSV. Колонки определяются по заголовкам: <b>Имя</b>, <b>Телефон</b>, <b>Адрес</b>, <b>Тип</b> (либо в таком порядке без заголовков). Формат — как в кнопке «Экспорт». Дубли по телефону пропускаются.</div>
      <input type="file" id="imp-file" accept=".csv,text/csv,text/plain" style="margin-bottom:12px;width:100%">
      <div id="imp-preview" class="muted2" style="font-size:12px">Файл не выбран</div>
    </div>
    <div class="modal-f"><button class="btn" data-act="close-modal">Отмена</button><button class="btn primary" id="imp-run" data-act="import-clients-run" disabled>${icon('check','sm')} Импортировать</button></div>`);
  const f=document.getElementById('imp-file');
  if(f) f.addEventListener('change', e=>{
    const file=e.target.files&&e.target.files[0]; if(!file) return;
    const rd=new FileReader();
    rd.onload=()=>{ try{ __impRows=mapClientRows(parseCSV(String(rd.result))); }catch(err){ __impRows=[]; } renderImpPreview(); };
    rd.onerror=()=>{ __impRows=[]; renderImpPreview(); };
    rd.readAsText(file,'utf-8');
  });
}
function renderImpPreview(){
  const box=document.getElementById('imp-preview'); const btn=document.getElementById('imp-run'); if(!box) return;
  if(!__impRows.length){ box.innerHTML='Не найдено строк для импорта — проверьте файл.'; if(btn) btn.disabled=true; return; }
  const rows=__impRows.slice(0,5).map(c=>`<tr><td>${escA(c.name)}</td><td>${escA(c.phone)}</td><td class="muted">${escA(c.address)}</td><td>${escA(c.type)}</td></tr>`).join('');
  box.innerHTML=`<div style="margin-bottom:8px">Найдено записей: <b>${__impRows.length}</b>${__impRows.length>5?' (показаны первые 5)':''}</div>
    <div class="tbl-scroll"><table class="tbl"><thead><tr><th>Имя</th><th>Телефон</th><th>Адрес</th><th>Тип</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  if(btn) btn.disabled=false;
}
function importClientsRun(){
  if(!__impRows.length) return;
  let added=0, skipped=0;
  const norm=p=>String(p||'').replace(/\D/g,'');
  __impRows.forEach(c=>{
    const np=norm(c.phone);
    const dupe = np && DB.clients.some(x=>norm(x.phone)===np);
    if(dupe){ skipped++; return; }
    const nc={id:uid('cl'), name:c.name, phone:c.phone, address:c.address, type:c.type};
    DB.clients.push(nc); added++;
    if(apiOn()) persist(API.persist.createClient(nc));
  });
  saveDB(); closeModal(); renderModule();
  toast(`Импортировано: ${added}${skipped?` · пропущено дублей: ${skipped}`:''}`);
}

/* ====== ЗАДАЧИ / НАПОМИНАНИЯ ПО СДЕЛКАМ ====== */
function tasksForDeal(id){ return (DB.tasks||[]).filter(t=>t.dealId===id).sort((a,b)=>(a.done-b.done)||String(a.due||'').localeCompare(String(b.due||''))); }
function taskDayDiff(due){ if(!due) return 0; const d=new Date(due); const a=new Date(d.getFullYear(),d.getMonth(),d.getDate()); const n=new Date(SEED_NOW.getFullYear(),SEED_NOW.getMonth(),SEED_NOW.getDate()); return Math.round((a-n)/864e5); }
function taskClass(t){ if(t.done) return {k:'done',txt:'выполнено',color:'#4ade80'}; const dd=taskDayDiff(t.due); if(dd<0) return {k:'overdue',txt:'просрочено',color:'#f87171'}; if(dd===0) return {k:'today',txt:'сегодня',color:'#fbbf24'}; if(dd===1) return {k:'soon',txt:'завтра',color:'#93c5fd'}; return {k:'upcoming',txt:'через '+dd+' дн.',color:'var(--muted)'}; }
function taskRefresh(dealId){ if(dealId && document.getElementById('deal-tasks')) openDeal(dealId); else renderModule(); }
function addTaskModal(dealId){
  const d=dealById(dealId);
  const users=DB.users.filter(u=>['director','manager','surveyor','production'].includes(u.role));
  const opts=users.map(u=>`<option value="${u.id}"${u.id===(d&&d.manager)?' selected':''}>${u.name}</option>`).join('');
  openModal(`<div class="modal-h">${icon('clock')}<h3>Новая задача</h3><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b"><div class="constr-body" style="padding:0">
      <div class="fld full"><label>Что сделать</label><input id="tk-title" placeholder="напр. Перезвонить клиенту"></div>
      <div class="fld"><label>Срок</label><input id="tk-due" type="date" value="${SEED_NOW.toISOString().slice(0,10)}"></div>
      <div class="fld"><label>Ответственный</label><select id="tk-assignee">${opts}</select></div>
    </div></div>
    <div class="modal-f"><button class="btn" data-act="close-modal">Отмена</button><button class="btn primary" data-act="create-task" data-id="${dealId}">${icon('check','sm')} Добавить</button></div>`);
}
function createTask(dealId){
  const v=i=>{const el=document.getElementById(i);return el?el.value.trim():'';};
  const title=v('tk-title'); if(!title){ toast('Опишите задачу','warn'); return; }
  const dueRaw=v('tk-due'); const due=dueRaw?new Date(dueRaw).toISOString():SEED_NOW.toISOString();
  const assignee=v('tk-assignee')||(dealById(dealId)||{}).manager||(state.user&&state.user.id);
  const nt={id:uid('t'),dealId,title,due,assignee,done:false};
  DB.tasks=DB.tasks||[]; DB.tasks.push(nt);
  saveDB(); if(apiOn()) persist(API.persist.createTask(nt));
  closeModal(); if(dealId) openDeal(dealId); else renderModule(); toast('Задача добавлена');
}
function toggleTask(id){
  const t=(DB.tasks||[]).find(x=>x.id===id); if(!t) return; t.done=!t.done;
  saveDB(); if(apiOn()) persist(API.persist.saveTask(t)); taskRefresh(t.dealId);
}
function delTask(id){
  const t=(DB.tasks||[]).find(x=>x.id===id); const dealId=t&&t.dealId;
  DB.tasks=(DB.tasks||[]).filter(x=>x.id!==id);
  saveDB(); if(apiOn()) persist(API.persist.deleteTask(id)); taskRefresh(dealId);
}
function newClientModal(){
  openModal(`<div class="modal-h">${icon('clients')}<h3>Новый клиент</h3><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b">
      <div class="fld full" style="margin-bottom:12px"><label>Имя / организация</label><input id="nc-name" style="background:var(--bg2);border:1px solid var(--line);border-radius:9px;padding:10px;color:var(--txt)"></div>
      <div class="fld full" style="margin-bottom:12px"><label>Телефон</label><input id="nc-phone" placeholder="+7" style="background:var(--bg2);border:1px solid var(--line);border-radius:9px;padding:10px;color:var(--txt)"></div>
      <div class="fld full"><label>Адрес</label><input id="nc-addr" style="background:var(--bg2);border:1px solid var(--line);border-radius:9px;padding:10px;color:var(--txt)"></div>
    </div>
    <div class="modal-f"><button class="btn" data-act="close-modal">Отмена</button><button class="btn primary" data-act="create-client">${icon('plus','sm')} Добавить</button></div>`);
}
function createClient(){
  const name=document.getElementById('nc-name').value.trim(); if(!name){toast('Укажите имя','warn');return;}
  const nc={id:uid('cl'),name,phone:document.getElementById('nc-phone').value||'—',address:document.getElementById('nc-addr').value||DB.company.city,type:name.match(/ТОО|ИП|ОО/)?'Юр. лицо':'Физ. лицо'};
  DB.clients.unshift(nc);
  saveDB(); if(apiOn()) persist(API.persist.createClient(nc)); closeModal(); renderModule(); toast('Клиент добавлен');
}
function editClientModal(id){
  const cl=clientById(id); if(!cl) return;
  const types=['Физ. лицо','Юр. лицо'];
  const opts=types.map(t=>`<option value="${t}"${cl.type===t?' selected':''}>${t}</option>`).join('');
  openModal(`<div class="modal-h">${icon('clients')}<h3>Изменить клиента</h3><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b"><div class="constr-body" style="padding:0">
      <div class="fld full"><label>Имя / организация</label><input id="ec-name" value="${escA(cl.name)}"></div>
      <div class="fld"><label>Телефон</label><input id="ec-phone" value="${escA(cl.phone||'')}"></div>
      <div class="fld"><label>Тип</label><select id="ec-type">${opts}</select></div>
      <div class="fld full"><label>Адрес</label><input id="ec-addr" value="${escA(cl.address||'')}"></div>
    </div></div>
    <div class="modal-f"><button class="btn" data-act="close-modal">Отмена</button><button class="btn primary" data-act="save-client" data-id="${id}">${icon('check','sm')} Сохранить</button></div>`);
}
function saveClient(id){
  const cl=clientById(id); if(!cl) return;
  const v=i=>{const el=document.getElementById(i);return el?el.value.trim():'';};
  const name=v('ec-name'); if(!name){ toast('Укажите имя','warn'); return; }
  cl.name=name; cl.phone=v('ec-phone')||'—'; cl.address=v('ec-addr')||cl.address; cl.type=v('ec-type')||cl.type;
  saveDB(); if(apiOn()) persist(API.persist.saveClient(cl));
  closeModal(); render(); toast('Клиент обновлён');
}
function delClientModal(id){
  const cl=clientById(id); if(!cl) return;
  const deals=DB.deals.filter(d=>d.clientId===id);
  if(deals.length){
    openModal(`<div class="modal-h">${icon('alert')}<h3>Нельзя удалить клиента</h3><button class="x" data-act="close-modal">${icon('x')}</button></div>
      <div class="modal-b"><p style="margin:0;color:var(--muted);line-height:1.5">У клиента <b>${escA(cl.name)}</b> есть сделки (${deals.length}). Сначала удалите или закройте их — потом можно будет удалить клиента.</p></div>
      <div class="modal-f"><button class="btn" data-act="close-modal">Понятно</button></div>`);
    return;
  }
  openModal(`<div class="modal-h">${icon('trash')}<h3>Удалить клиента?</h3><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b"><p style="margin:0;color:var(--muted);line-height:1.5">${escA(cl.name)} · ${escA(cl.phone)}.<br>Будет удалена и переписка в чате. Действие необратимо.</p></div>
    <div class="modal-f"><button class="btn" data-act="close-modal">Отмена</button><button class="btn danger" data-act="del-client-confirm" data-id="${id}">${icon('trash','sm')} Удалить</button></div>`);
}
function delClientConfirm(id){
  const cl=clientById(id); if(!cl) return;
  if(DB.deals.some(d=>d.clientId===id)){ toast('У клиента есть сделки — удаление невозможно','warn'); return; }
  DB.clients=DB.clients.filter(c=>c.id!==id);
  if(Array.isArray(DB.waMessages)) DB.waMessages=DB.waMessages.filter(m=>m.clientId!==id);
  saveDB();
  if(apiOn()) persist(API.fetch('clients/'+id, {method:'DELETE'}));
  closeModal(); renderModule(); toast('Клиент удалён');
}
function delDealModal(id){
  const d=dealById(id); if(!d) return; const cl=clientById(d.clientId);
  const paid=dealPaid(d);
  const warn = paid>0 ? `<br><span style="color:#fbbf24">Внимание: по сделке есть оплаты на ${money(paid)} — они тоже будут удалены.</span>` : '';
  openModal(`<div class="modal-h">${icon('trash')}<h3>Удалить сделку?</h3><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b"><p style="margin:0;color:var(--muted);line-height:1.55">${cl?escA(cl.name):'—'} · ${stageById(d.stage).name}${d.sum?' · '+money(d.sum):''}.<br>Будут удалены конструкции и оплаты сделки. Действие необратимо.${warn}</p></div>
    <div class="modal-f"><button class="btn" data-act="close-modal">Отмена</button><button class="btn danger" data-act="del-deal-confirm" data-id="${id}">${icon('trash','sm')} Удалить</button></div>`);
}
function delDealConfirm(id){
  const d=dealById(id); if(!d) return;
  DB.deals=DB.deals.filter(x=>x.id!==id);
  if(state.measureDealId===id) state.measureDealId=null;
  saveDB();
  if(apiOn()) persist(API.fetch('deals/'+id, {method:'DELETE'}));
  closeModal(); render(); toast('Сделка удалена');
}

/* ====== КРЕДИТОРКА (payables) — ручное ведение ====== */
const PAY_STATUSES=['ожидает','просрочено','оплачено'];
function payableModal(id){
  const p = id ? DB.payables.find(x=>x.id===id) : null;
  const opts = PAY_STATUSES.map(s=>`<option value="${s}"${p&&p.status===s?' selected':''}>${s}</option>`).join('');
  openModal(`<div class="modal-h">${icon('wallet')}<h3>${p?'Изменить долг':'Новый долг поставщику'}</h3><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b"><div class="constr-body" style="padding:0">
      <div class="fld full"><label>Поставщик</label><input id="pay-sup" value="${p?escA(p.supplier):''}" placeholder="напр. Rehau KZ"></div>
      <div class="fld full"><label>За что</label><input id="pay-for" value="${p?escA(p.forWhat||''):''}" placeholder="напр. Профиль, партия"></div>
      <div class="fld"><label>Сумма, ₸</label><input id="pay-amt" type="number" min="0" value="${p?p.amount:''}"></div>
      <div class="fld"><label>Срок оплаты</label><input id="pay-due" type="date" value="${p&&p.due?String(p.due).slice(0,10):''}"></div>
      <div class="fld"><label>Статус</label><select id="pay-status">${opts}</select></div>
    </div></div>
    <div class="modal-f"><button class="btn" data-act="close-modal">Отмена</button><button class="btn primary" data-act="save-payable"${p?` data-id="${p.id}"`:''}>${icon('check','sm')} Сохранить</button></div>`);
}
function savePayable(id){
  const v=i=>{const el=document.getElementById(i);return el?el.value.trim():'';};
  const supplier=v('pay-sup'); if(!supplier){ toast('Укажите поставщика','warn'); return; }
  const forWhat=v('pay-for');
  const amount=Math.max(0,Math.round(parseFloat(v('pay-amt'))||0));
  const dueRaw=v('pay-due'); const due=dueRaw?new Date(dueRaw).toISOString():'';
  const status=v('pay-status')||'ожидает';
  if(id){ const p=DB.payables.find(x=>x.id===id); if(!p) return; Object.assign(p,{supplier,forWhat,amount,due,status});
    saveDB(); if(apiOn()) persist(API.persist.savePayable(p)); }
  else { const np={id:uid('pay'),supplier,forWhat,amount,due,status}; DB.payables.push(np);
    saveDB(); if(apiOn()) persist(API.persist.createPayable(np)); }
  closeModal(); renderModule(); toast(id?'Долг обновлён':'Долг добавлен');
}
function payablePaid(id){
  const p=DB.payables.find(x=>x.id===id); if(!p) return;
  p.status='оплачено'; saveDB(); if(apiOn()) persist(API.persist.savePayable(p));
  renderModule(); toast('Отмечено как оплачено');
}
function delPayableModal(id){
  const p=DB.payables.find(x=>x.id===id); if(!p) return;
  openModal(`<div class="modal-h">${icon('trash')}<h3>Удалить запись?</h3><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b"><p style="margin:0;color:var(--muted);line-height:1.5">${escA(p.supplier)} · ${money(p.amount)}.<br>Действие необратимо.</p></div>
    <div class="modal-f"><button class="btn" data-act="close-modal">Отмена</button><button class="btn danger" data-act="del-payable-confirm" data-id="${id}">${icon('trash','sm')} Удалить</button></div>`);
}
function delPayableConfirm(id){
  DB.payables=DB.payables.filter(x=>x.id!==id);
  saveDB(); if(apiOn()) persist(API.persist.deletePayable(id));
  closeModal(); renderModule(); toast('Запись удалена');
}

/* ====== КАТАЛОГИ И ПРАЙС (стеклопакеты, открывания, опции) — только директор ====== */
function catBody(cfg,row){ const b={id:row.id, name:row.name, sort:row.sort||0}; b[cfg.priceKey]=row[cfg.priceKey]; if(cfg.hasPer) b.per=row.per; return b; }
function catModal(type,id){
  if(!isDirector()) return;
  const cfg=CATALOGS_EDIT[type]; if(!cfg) return;
  const row=id?cfg.arr().find(x=>x.id===id):null;
  const perRow = cfg.hasPer ? `<div class="fld"><label>Расчёт цены</label><select id="cat-per">${['шт','м','периметр'].map(o=>`<option value="${o}"${row&&row.per===o?' selected':''}>${o==='шт'?'за штуку':o==='м'?'за пог.м':'по периметру'}</option>`).join('')}</select></div>` : '';
  openModal(`<div class="modal-h">${icon('money')}<h3>${row?'Изменить — '+cfg.title.toLowerCase():cfg.title+': добавить'}</h3><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b"><div class="constr-body" style="padding:0">
      <div class="fld full"><label>Наименование</label><input id="cat-name" value="${row?escA(row.name):''}" placeholder="напр. Двухкамерный 32мм"></div>
      <div class="fld"><label>Цена, ${cfg.unit}</label><input id="cat-price" type="number" min="0" value="${row?row[cfg.priceKey]:''}"></div>
      ${perRow}
    </div></div>
    <div class="modal-f"><button class="btn" data-act="close-modal">Отмена</button><button class="btn primary" data-act="cat-save" data-type="${type}"${row?` data-id="${row.id}"`:''}>${icon('check','sm')} Сохранить</button></div>`);
}
function catSave(type,id){
  if(!isDirector()) return;
  const cfg=CATALOGS_EDIT[type]; if(!cfg) return; const arr=cfg.arr();
  const v=i=>{const el=document.getElementById(i);return el?el.value.trim():'';};
  const name=v('cat-name'); if(!name){ toast('Укажите наименование','warn'); return; }
  const price=Math.max(0,Math.round(parseFloat(v('cat-price'))||0));
  let row;
  if(id){ row=arr.find(x=>x.id===id); if(!row) return; row.name=name; row[cfg.priceKey]=price; if(cfg.hasPer) row.per=v('cat-per')||'шт'; }
  else { row={id:uid(cfg.prefix), name, sort:arr.length}; row[cfg.priceKey]=price; if(cfg.hasPer) row.per=v('cat-per')||'шт'; arr.push(row); }
  saveDB();
  if(apiOn()) persist(id ? API.fetch(cfg.api+'/'+id,{method:'PUT',body:catBody(cfg,row)}) : API.fetch(cfg.api,{method:'POST',body:catBody(cfg,row)}));
  closeModal(); render(); toast(id?'Сохранено':'Добавлено');
}
function catDelModal(type,id){
  if(!isDirector()) return;
  const cfg=CATALOGS_EDIT[type]; if(!cfg) return; const row=cfg.arr().find(x=>x.id===id); if(!row) return;
  if(cfg.usedBy(id)){
    openModal(`<div class="modal-h">${icon('alert')}<h3>Нельзя удалить</h3><button class="x" data-act="close-modal">${icon('x')}</button></div>
      <div class="modal-b"><p style="margin:0;color:var(--muted);line-height:1.5">«${escA(row.name)}» используется в сделках. Сначала измените эти конструкции, потом можно будет удалить позицию.</p></div>
      <div class="modal-f"><button class="btn" data-act="close-modal">Понятно</button></div>`);
    return;
  }
  openModal(`<div class="modal-h">${icon('trash')}<h3>Удалить из каталога?</h3><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b"><p style="margin:0;color:var(--muted)">«${escA(row.name)}». Действие необратимо.</p></div>
    <div class="modal-f"><button class="btn" data-act="close-modal">Отмена</button><button class="btn danger" data-act="cat-del-confirm" data-type="${type}" data-id="${id}">${icon('trash','sm')} Удалить</button></div>`);
}
function catDelConfirm(type,id){
  if(!isDirector()) return;
  const cfg=CATALOGS_EDIT[type]; if(!cfg) return; const arr=cfg.arr();
  const i=arr.findIndex(x=>x.id===id); if(i>=0) arr.splice(i,1);
  saveDB(); if(apiOn()) persist(API.fetch(cfg.api+'/'+id,{method:'DELETE'}));
  closeModal(); render(); toast('Удалено из каталога');
}

/* warehouse — приход (пополнение) */
function whReceiveModal(id, kind){
  const it = kind==='mat' ? matById(id) : compById(id);
  if(!it) return;
  const costRow = (kind==='mat' && seesMoney()) ? `<div class="fld"><label>Цена прихода, ₸/${it.unit}</label><input type="number" id="wr-rate" value="${it.rate||0}"></div>` : '';
  const supRow = it.supplier ? `<div class="fld full"><label>Поставщик</label><input id="wr-sup" value="${it.supplier}"></div>` : '';
  openModal(`<div class="modal-h">${icon('box')}<div><h3>Приход на склад</h3><div class="mh-sub">${it.name} · сейчас ${it.stock} ${it.unit}</div></div><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b"><div class="constr-body" style="padding:0">
      <div class="fld"><label>Количество, ${it.unit}</label><input type="number" min="1" id="wr-qty" value="${Math.max(it.min, Math.round((it.min*2-it.stock)>0?(it.min*2-it.stock):it.min))}" autofocus></div>
      ${costRow}${supRow}
    </div></div>
    <div class="modal-f"><button class="btn" data-act="close-modal">Отмена</button><button class="btn green" data-act="wh-confirm-receive" data-id="${id}" data-kind="${kind}">${icon('check','sm')} Оприходовать</button></div>`);
}
function whConfirmReceive(id, kind){
  const it = kind==='mat' ? matById(id) : compById(id);
  if(!it) return;
  const qty = Math.max(0, Math.round((parseFloat(document.getElementById('wr-qty').value)||0)*10)/10);
  if(qty<=0){ toast('Укажите количество','warn'); return; }
  const rateEl=document.getElementById('wr-rate'); if(rateEl){ const r=parseFloat(rateEl.value); if(r>0) it.rate=Math.round(r); }
  const supEl=document.getElementById('wr-sup'); if(supEl && supEl.value.trim()) it.supplier=supEl.value.trim();
  it.stock = Math.round((it.stock+qty)*10)/10;
  const reason = (supEl && supEl.value.trim()) ? 'Поставка — '+supEl.value.trim() : 'Поступление на склад';
  recordMovement({kind, item:it, dir:'in', type:'receipt', qty, reason});
  DB.activity.unshift({who:state.user.id,text:`Приход на склад: ${it.name} +${qty} ${it.unit}`,at:SEED_NOW.toISOString(),kind:'wh'});
  saveDB();
  if(apiOn()){ persist(kind==='mat'?API.persist.saveMaterial(it):API.persist.saveComponent(it)); persist(API.persist.createActivity(DB.activity[0])); }
  closeModal(); render();
  toast(`Оприходовано: ${it.name} +${qty} ${it.unit} · остаток ${it.stock} ${it.unit}`);
}

/* warehouse — расход / списание (брак, в производство вручную, возврат, корректировка) */
function whWriteoffModal(id, kind){
  const it = kind==='mat' ? matById(id) : compById(id);
  if(!it) return;
  const opts = WRITEOFF_TYPES.map(t=>`<option value="${t}">${MOVE_TYPES[t].label}</option>`).join('');
  openModal(`<div class="modal-h">${icon('minus')}<div><h3>Расход со склада</h3><div class="mh-sub">${it.name} · остаток ${it.stock} ${it.unit}</div></div><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b"><div class="constr-body" style="padding:0">
      <div class="fld"><label>Количество, ${it.unit}</label><input type="number" min="0" step="0.1" max="${it.stock}" id="wo-qty" placeholder="0" autofocus></div>
      <div class="fld"><label>Тип расхода</label><select id="wo-type">${opts}</select></div>
      <div class="fld full"><label>Причина / комментарий</label><input id="wo-reason" placeholder="напр. брак при резке"></div>
    </div></div>
    <div class="modal-f"><button class="btn" data-act="close-modal">Отмена</button><button class="btn danger" data-act="wh-confirm-writeoff" data-id="${id}" data-kind="${kind}">${icon('check','sm')} Списать</button></div>`);
}
function whConfirmWriteoff(id, kind){
  const it = kind==='mat' ? matById(id) : compById(id);
  if(!it) return;
  const qty = Math.max(0, Math.round((parseFloat(document.getElementById('wo-qty').value)||0)*10)/10);
  if(qty<=0){ toast('Укажите количество','warn'); return; }
  if(qty>it.stock){ toast(`Нельзя списать больше остатка (${it.stock} ${it.unit})`,'warn'); return; }
  const type=(document.getElementById('wo-type')||{}).value||'writeoff';
  const reason=((document.getElementById('wo-reason')||{}).value||'').trim()||MOVE_TYPES[type].label;
  it.stock = Math.round((it.stock-qty)*10)/10;
  recordMovement({kind, item:it, dir:'out', type, qty, reason});
  DB.activity.unshift({who:state.user.id,text:`Расход со склада: ${it.name} −${qty} ${it.unit} (${MOVE_TYPES[type].label})`,at:SEED_NOW.toISOString(),kind:'wh'});
  saveDB();
  if(apiOn()){ persist(kind==='mat'?API.persist.saveMaterial(it):API.persist.saveComponent(it)); persist(API.persist.createActivity(DB.activity[0])); }
  closeModal(); render();
  toast(`Списано: ${it.name} −${qty} ${it.unit} · остаток ${it.stock} ${it.unit}`);
  const low=[...DB.materials,...DB.components].filter(x=>x.stock<x.min).map(x=>x.name);
  if(low.length) toast(`⚠ Ниже минимума: ${low.slice(0,3).join(', ')}${low.length>3?` и ещё ${low.length-3}`:''} — нужен дозаказ`,'warn');
}

/* ====== СКЛАД: управление номенклатурой (профили / комплектующие) ====== */
function whItemModal(kind, id){
  const money$=seesMoney(); const isMat=(kind==='mat');
  const it = id ? (isMat?matById(id):compById(id)) : null;
  const typeOpts=['ПВХ','Алюминий'].map(t=>`<option${it&&it.type===t?' selected':''}>${t}</option>`).join('');
  const serOpts=['Эконом','Средняя','Премиум'].map(s=>`<option${it&&it.series===s?' selected':''}>${s}</option>`).join('');
  const title=(it?'Изменить':'Добавить')+(isMat?' профиль':' комплектующее');
  const matFields=isMat?`
      <div class="fld"><label>Тип</label><select id="wi-type">${typeOpts}</select></div>
      <div class="fld"><label>Серия</label><select id="wi-series">${serOpts}</select></div>
      ${money$?`<div class="fld"><label>Цена, ₸/м²</label><input id="wi-rate" type="number" min="0" value="${it?it.rate:''}"></div>`:''}
      <div class="fld full"><label>Поставщик</label><input id="wi-sup" value="${it?escA(it.supplier||''):''}"></div>`:'';
  openModal(`<div class="modal-h">${icon('box')}<h3>${title}</h3><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b"><div class="constr-body" style="padding:0">
      <div class="fld full"><label>Наименование</label><input id="wi-name" value="${it?escA(it.name):''}" placeholder="${isMat?'напр. Rehau Grazio 70':'напр. Стеклопакет двухкам. 32мм'}"></div>
      ${matFields}
      <div class="fld"><label>Ед. изм.</label><input id="wi-unit" value="${it?escA(it.unit||''):(isMat?'пог.м':'шт')}"></div>
      <div class="fld"><label>Минимум (для дозаказа)</label><input id="wi-min" type="number" min="0" value="${it?it.min:''}"></div>
      ${!id?`<div class="fld"><label>Начальный остаток</label><input id="wi-stock" type="number" min="0" value="0"></div>`:''}
    </div></div>
    <div class="modal-f"><button class="btn" data-act="close-modal">Отмена</button><button class="btn primary" data-act="wh-item-save" data-kind="${kind}"${it?` data-id="${it.id}"`:''}>${icon('check','sm')} Сохранить</button></div>`);
}
function whItemSave(kind, id){
  const money$=seesMoney(); const isMat=(kind==='mat');
  const v=i=>{const el=document.getElementById(i);return el?el.value.trim():'';};
  const num=i=>Math.max(0,parseFloat(v(i))||0);
  const name=v('wi-name'); if(!name){ toast('Укажите наименование','warn'); return; }
  const unit=v('wi-unit')||(isMat?'пог.м':'шт'); const min=num('wi-min');
  if(isMat){
    const type=v('wi-type')||'ПВХ'; const series=v('wi-series')||'Эконом'; const supplier=v('wi-sup');
    if(id){ const m=matById(id); if(!m) return; m.name=name; m.type=type; m.series=series; m.unit=unit; m.min=min; m.supplier=supplier; if(money$) m.rate=Math.round(num('wi-rate'));
      saveDB(); if(apiOn()) persist(API.persist.saveMaterialCard(m)); }
    else { const nm={id:uid('m'),name,type,series,rate:money$?Math.round(num('wi-rate')):0,stock:num('wi-stock'),min,unit,supplier};
      DB.materials.push(nm); saveDB(); if(apiOn()) persist(API.persist.createMaterial(nm)); }
  } else {
    if(id){ const c=compById(id); if(!c) return; c.name=name; c.unit=unit; c.min=min;
      saveDB(); if(apiOn()) persist(API.persist.saveComponentCard(c)); }
    else { const nc={id:uid('c'),name,stock:num('wi-stock'),min,unit};
      DB.components.push(nc); saveDB(); if(apiOn()) persist(API.persist.createComponent(nc)); }
  }
  closeModal(); renderModule(); toast(id?'Сохранено':'Позиция добавлена');
}
function whItemDelModal(kind, id){
  if(!seesMoney()) return;
  const it = kind==='mat'?matById(id):compById(id); if(!it) return;
  if(kind==='mat' && DB.deals.some(d=>(d.items||[]).some(c=>c.profileId===id))){
    openModal(`<div class="modal-h">${icon('alert')}<h3>Нельзя удалить</h3><button class="x" data-act="close-modal">${icon('x')}</button></div>
      <div class="modal-b"><p style="margin:0;color:var(--muted);line-height:1.5">Профиль «${escA(it.name)}» используется в сделках. Сначала измените эти конструкции, потом удаляйте позицию.</p></div>
      <div class="modal-f"><button class="btn" data-act="close-modal">Понятно</button></div>`);
    return;
  }
  openModal(`<div class="modal-h">${icon('trash')}<h3>Удалить позицию?</h3><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b"><p style="margin:0;color:var(--muted)">«${escA(it.name)}». Действие необратимо.</p></div>
    <div class="modal-f"><button class="btn" data-act="close-modal">Отмена</button><button class="btn danger" data-act="wh-item-del-confirm" data-kind="${kind}" data-id="${id}">${icon('trash','sm')} Удалить</button></div>`);
}
function whItemDelConfirm(kind, id){
  if(!seesMoney()) return;
  if(kind==='mat') DB.materials=DB.materials.filter(x=>x.id!==id);
  else DB.components=DB.components.filter(x=>x.id!==id);
  saveDB(); if(apiOn()) persist(kind==='mat'?API.persist.deleteMaterial(id):API.persist.deleteComponent(id));
  closeModal(); renderModule(); toast('Позиция удалена');
}

/* measure mutations */
function mAdd(){ const d=currentMeasureDeal(); if(!d) return; d.items=d.items||[];
  const nit={id:uid('cn'),profileId:'m4',w:1300,h:1400,glassId:'g2',openId:'tilt',sashes:2,qty:1,extras:['sill','slopes']};
  d.items.push(nit);
  saveDB();
  if(apiOn()){ persist(API.persist.createItem(d.id, nit).then(()=>{ (nit.extras||[]).forEach(ex=>persist(API.persist.setItemExtra(nit.id, ex, true))); })); }
  renderModule(); }
function mDel(cid){ const d=currentMeasureDeal(); d.items=d.items.filter(c=>c.id!==cid); saveDB(); if(apiOn()) persist(API.persist.deleteItem(cid)); renderModule(); }
function mSet(cid,field,val){ const d=currentMeasureDeal(); const c=d.items.find(x=>x.id===cid); if(!c)return;
  if(field==='extras'){ c.extras=c.extras||[]; const i=c.extras.indexOf(val); if(i>=0)c.extras.splice(i,1); else c.extras.push(val); }
  else c[field]=val;
  saveDB();
  if(apiOn()){ if(field==='extras') persist(API.persist.setItemExtra(cid, val, c.extras.includes(val))); else persist(API.persist.saveItem(c)); }
  renderModule(); }

/* ============ НАСТРОЙКИ: компания / сотрудники / права (только директор) ============ */
function isDirector(){ return !!(state.user && state.user.role==='director'); }

function editCompanyModal(){
  if(!isDirector()) return;
  const c=DB.company||{};
  openModal(`<div class="modal-h">${icon('settings')}<h3>Данные компании</h3><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b"><div class="constr-body" style="padding:0">
      <div class="fld full"><label>Название</label><input id="co-name" value="${escA(c.name)}"></div>
      <div class="fld full"><label>Юридическое лицо</label><input id="co-legal" value="${escA(c.legal)}"></div>
      <div class="fld"><label>Город</label><input id="co-city" value="${escA(c.city)}"></div>
      <div class="fld"><label>Телефон</label><input id="co-phone" value="${escA(c.phone)}"></div>
      <div class="fld full"><label>Производство</label><input id="co-workshop" value="${escA(c.workshop)}"></div>
      <div class="fld full"><label>Оборот за год</label><input id="co-rev" value="${escA(c.revenueYear)}"></div>
    </div></div>
    <div class="modal-f"><button class="btn" data-act="close-modal">Отмена</button><button class="btn primary" data-act="save-company">${icon('check','sm')} Сохранить</button></div>`);
}
function saveCompany(){
  if(!isDirector()) return;
  const v=i=>{ const el=document.getElementById(i); return el?el.value.trim():''; };
  const name=v('co-name'); if(!name){ toast('Укажите название','warn'); return; }
  const c=DB.company;
  c.name=name; c.legal=v('co-legal'); c.city=v('co-city'); c.phone=v('co-phone');
  c.workshop=v('co-workshop'); c.revenueYear=v('co-rev');
  saveDB(); if(apiOn()) persist(API.persist.saveCompany(c));
  closeModal(); render(); toast('Данные компании сохранены');
}

const ROLE_OPTS=['director','manager','surveyor','production','warehouse'];
function userModal(id){
  if(!isDirector()) return;
  const u = id ? userById(id) : null;
  const roleOf = u?u.role:'manager';
  const opts = ROLE_OPTS.map(r=>`<option value="${r}"${r===roleOf?' selected':''}>${roleRu(r)}</option>`).join('');
  const apiMode = apiOn();
  const pwHint = u ? '(пусто — без изменений)' : (apiMode ? '(мин. 6 символов)' : '(в демо не требуется)');
  openModal(`<div class="modal-h">${icon('user')}<h3>${u?'Сотрудник':'Новый сотрудник'}</h3><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b"><div class="constr-body" style="padding:0">
      <div class="fld full"><label>Имя</label><input id="us-name" value="${u?escA(u.name):''}"></div>
      <div class="fld"><label>Должность</label><input id="us-title" value="${u?escA(u.title):''}" placeholder="напр. Менеджер по продажам"></div>
      <div class="fld"><label>Роль (права доступа)</label><select id="us-role">${opts}</select></div>
      <div class="fld full"><label>Email (логин)</label><input id="us-email" value="${u?escA(u.email||''):''}" placeholder="name@okna.kz"></div>
      <div class="fld full"><label>Пароль ${pwHint}</label><input id="us-pass" type="text" placeholder="${u?'••••••':'okna2026'}"></div>
    </div></div>
    <div class="modal-f"><button class="btn" data-act="close-modal">Отмена</button><button class="btn primary" data-act="save-user"${u?` data-id="${u.id}"`:''}>${icon('check','sm')} ${u?'Сохранить':'Добавить'}</button></div>`);
}
function saveUser(id){
  if(!isDirector()) return;
  const v=i=>{ const el=document.getElementById(i); return el?el.value.trim():''; };
  const name=v('us-name'); if(!name){ toast('Укажите имя','warn'); return; }
  const role=v('us-role')||'manager'; const title=v('us-title')||roleRu(role);
  const email=v('us-email'); const passEl=document.getElementById('us-pass'); const pass=passEl?passEl.value:'';
  const apiMode=apiOn();
  if(apiMode && !email){ toast('Укажите email для входа','warn'); return; }
  if(pass && pass.length<6){ toast('Пароль минимум 6 символов','warn'); return; }
  if(id){
    const u=userById(id); if(!u) return;
    u.name=name; u.title=title; u.role=role; u.email=email;
    saveDB();
    if(apiMode){ persist(API.persist.saveUser(u)); if(pass) persist(API.persist.setUserPassword(u.id, pass)); }
    if(state.user && state.user.id===u.id){ state.user.name=u.name; state.user.title=u.title; state.user.role=u.role; }
    closeModal(); render(); toast('Сотрудник обновлён');
  } else {
    if(apiMode && !pass){ toast('Задайте пароль (мин. 6 символов)','warn'); return; }
    const nu={ id:uid('u'), name, role, title, email, primary:false };
    DB.users.push(nu);
    saveDB();
    if(apiMode) persist(API.persist.createUser(nu).then(()=>{ if(pass) return API.persist.setUserPassword(nu.id, pass); }));
    closeModal(); render(); toast('Сотрудник добавлен');
  }
}
function delUserModal(id){
  if(!isDirector()) return;
  const u=userById(id); if(!u) return;
  if(state.user && state.user.id===id){ toast('Нельзя удалить себя','warn'); return; }
  openModal(`<div class="modal-h">${icon('trash')}<h3>Удалить сотрудника?</h3><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b"><p style="margin:0;color:var(--muted);line-height:1.5">${escA(u.name)} · ${escA(u.title)}.<br>Действие необратимо.</p></div>
    <div class="modal-f"><button class="btn" data-act="close-modal">Отмена</button><button class="btn danger" data-act="del-user-confirm" data-id="${id}">${icon('trash','sm')} Удалить</button></div>`);
}
function delUserConfirm(id){
  if(!isDirector()) return;
  const u=userById(id); if(!u) return;
  if(state.user && state.user.id===id){ toast('Нельзя удалить себя','warn'); return; }
  DB.users=DB.users.filter(x=>x.id!==id);
  saveDB(); if(apiOn()) persist(API.persist.deleteUser(id));
  closeModal(); render(); toast('Сотрудник удалён');
}
function togglePerm(mod, role){
  if(!isDirector()) return;
  if(mod==='settings' && role==='director'){ toast('Директор всегда имеет доступ к настройкам','warn'); return; }
  MODULE_ROLES[mod]=MODULE_ROLES[mod]||[];
  const i=MODULE_ROLES[mod].indexOf(role);
  const on = i<0;
  if(on) MODULE_ROLES[mod].push(role); else MODULE_ROLES[mod].splice(i,1);
  if(apiOn()) persist(API.persist.setModuleRole(mod, role, on));
  renderModule();
}

/* ============ WHATSAPP (Green API) ============ */
function waPreset(cl, d){
  const co=DB.company.name;
  if(d && (d.sum || (d.items||[]).length)){ const k=computeMeasure(d);
    return `${cl.name}, здравствуйте! Это ${co}. Подготовили коммерческое предложение по вашим окнам на сумму ${money(k.total)}. Для запуска заказа предоплата — ${money(k.prepay)}. С радостью ответим на вопросы.`; }
  return `${cl.name}, здравствуйте! Это ${co}. Спасибо за обращение — готовы помочь с расчётом и замером по вашим окнам.`;
}
function waSendModal(clientId, dealId){
  const d = dealId ? dealById(dealId) : null;
  const cl = clientId ? clientById(clientId) : (d ? clientById(d.clientId) : null);
  if(!cl){ toast('Клиент не найден','warn'); return; }
  const preset = waPreset(cl, d);
  let notice='';
  if(!apiOn()){
    notice = `<div class="muted2" style="font-size:11.5px;margin-top:10px;line-height:1.5;color:#fbbf24">Демо-режим: реальная отправка доступна после входа по логину и подключения Green API в Настройках.</div>`;
  } else if(!(waConfig && waConfig.enabled && waConfig.configured)){
    notice = `<div class="muted2" style="font-size:11.5px;margin-top:10px;line-height:1.5;color:#fbbf24">WhatsApp не подключён. Директор может подключить инстанс в Настройки → WhatsApp · Green API.</div>`;
  }
  openModal(`<div class="modal-h">${icon('wa')}<div><h3>Сообщение в WhatsApp</h3><div class="mh-sub">${cl.name} · ${cl.phone}</div></div><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b">
      <div class="fld full"><label>Текст сообщения</label><textarea id="wa-msg" rows="5" style="background:var(--bg2);border:1px solid var(--line);border-radius:9px;padding:10px;color:var(--txt);font-family:inherit;font-size:13.5px;resize:vertical">${escA(preset)}</textarea></div>
      ${notice}
    </div>
    <div class="modal-f"><button class="btn" data-act="close-modal">Отмена</button>
      <button class="btn green" data-act="wa-send" data-id="${clientId||''}" data-deal="${dealId||''}">${icon('send','sm')} Отправить</button></div>`);
}
function logWaActivity(cl){
  if(!cl) return;
  DB.activity.unshift({who:(state.user&&state.user.id)||null, text:`Отправлено сообщение в WhatsApp — ${cl.name}`, at:SEED_NOW.toISOString(), kind:'lead'});
  saveDB(); if(apiOn()) persist(API.persist.createActivity(DB.activity[0]));
}
function waDoSend(clientId, dealId){
  const d = dealId ? dealById(dealId) : null;
  const cl = clientId ? clientById(clientId) : (d ? clientById(d.clientId) : null);
  const msg=((document.getElementById('wa-msg')||{}).value||'').trim();
  if(!msg){ toast('Пустое сообщение','warn'); return; }
  if(!apiOn()){ closeModal(); logWaActivity(cl); toast('Демо: сообщение «отправлено» в WhatsApp'); return; }
  if(!(waConfig && waConfig.enabled && waConfig.configured)){ toast('WhatsApp не подключён — настройте в Настройках','warn'); return; }
  if(!cl || !cl.phone){ toast('У клиента нет номера телефона','warn'); return; }
  const btn=document.querySelector('[data-act="wa-send"]'); if(btn){ btn.disabled=true; btn.textContent='Отправляем…'; }
  API.wa.send(cl.phone, msg, dealId?{dealId}:{}).then(()=>{
    closeModal(); logWaActivity(cl); toast(`Сообщение отправлено в WhatsApp — ${cl.name}`);
  }).catch(e=>{
    if(btn){ btn.disabled=false; btn.innerHTML=`${icon('send','sm')} Отправить`; }
    toast('Не отправлено: '+((e&&e.message)||''),'warn');
  });
}
/* ---- двусторонний чат ---- */
function waChatModal(clientId){
  const cl=clientById(clientId); if(!cl){ toast('Клиент не найден','warn'); return; }
  const canSend = !apiOn() || (waConfig && waConfig.enabled && waConfig.configured);
  const hint = (apiOn() && !canSend) ? `<div class="muted2" style="text-align:center;font-size:11px;padding:6px 14px;color:#fbbf24">WhatsApp не подключён — отправка недоступна (Настройки → WhatsApp)</div>` : '';
  openModal(`<div class="modal-h">${icon('wa')}<div><h3>WhatsApp · ${cl.name}</h3><div class="mh-sub">${cl.phone}</div></div><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b" style="padding:0;display:flex;flex-direction:column">
      <div id="wa-chat-msgs" class="wa-chat" data-cid="${clientId}"><div class="muted2" style="text-align:center;padding:24px">Загрузка…</div></div>
      ${hint}
    </div>
    <div class="modal-f" style="gap:8px">
      <input id="wa-chat-input" placeholder="Сообщение…" autocomplete="off" style="flex:1;background:var(--bg2);border:1px solid var(--line);border-radius:9px;padding:10px;color:var(--txt);font-size:13.5px" ${canSend?'':'disabled'}>
      <button class="btn green" data-act="wa-chat-send" data-id="${clientId}" ${canSend?'':'disabled'}>${icon('send','sm')}</button>
    </div>`, true);
  waBindChat(clientId);
}
/* совмещённый вид: слева сделка, справа чат (из Воронки) */
function waDealChatModal(dealId){
  const d=dealById(dealId); if(!d){ toast('Сделка не найдена','warn'); return; }
  const cl=clientById(d.clientId); if(!cl){ toast('Клиент не найден','warn'); return; }
  const canSend = !apiOn() || (waConfig && waConfig.enabled && waConfig.configured);
  const st=stageById(d.stage); const sum=d.sum||dealItemsSum(d); const paid=dealPaid(d); const debt=Math.max(0,sum-paid);
  const money$=seesMoney();
  const items=(d.items||[]).map(c=>{ const mt=matById(c.profileId);
    return `<div class="stat-line"><span>${mt?mt.type:''} ${c.w}×${c.h}${(c.qty||1)>1?' ·'+c.qty+'шт':''}</span><span class="muted">${openById(c.openId)?.name||''}</span></div>`; }).join('')
    || '<div class="muted2" style="font-size:12px">Конструкции не добавлены</div>';
  const moneyBlock = money$ ? `
      <div class="stat-line"><span>Сумма заказа</span><span style="font-weight:700">${money(sum)}</span></div>
      <div class="stat-line"><span>Оплачено</span><span style="color:#4ade80;font-weight:700">${money(paid)}</span></div>
      <div class="stat-line"><span>Остаток</span><span style="color:${debt>0?'#fbbf24':'#4ade80'};font-weight:700">${money(debt)}</span></div>` : '';
  const info = `
    <div class="wa-deal-info">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <span class="av" style="width:40px;height:40px;border-radius:10px;display:grid;place-items:center;background:${colorFor(cl.id)};color:#fff;font-weight:700">${initials(cl.name)}</span>
        <div><div style="font-weight:700">${cl.name} ${d.hot?icon('flame','sm'):''}</div><div class="muted2" style="font-size:11.5px">${cl.phone}</div></div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
        <span class="tag">${icon('layers','sm')} ${d.source}</span>
        <span class="tag">${icon('user','sm')} ${(userById(d.manager)||{}).name||'—'}</span>
      </div>
      <div class="stat-line"><span>${icon('pin','sm')} Адрес</span><span class="muted" style="text-align:right;max-width:60%">${cl.address}</span></div>
      ${moneyBlock}
      <div class="muted2" style="font-size:11px;text-transform:uppercase;letter-spacing:.4px;margin:14px 0 4px">Конструкции (${(d.items||[]).length})</div>
      ${items}
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:16px">
        <button class="btn sm" data-act="open-deal" data-id="${d.id}">${icon('funnel','sm')} Открыть сделку целиком</button>
        ${d.stage==='measure'?`<button class="btn sm soft" data-act="go-measure-deal" data-id="${d.id}">${icon('ruler','sm')} Открыть замер</button>`:''}
        ${money$&&debt>0?`<button class="btn sm primary" data-act="add-payment" data-id="${d.id}">${icon('money','sm')} Принять оплату</button>`:''}
      </div>
    </div>`;
  const hint = (apiOn() && !canSend) ? `<div class="muted2" style="text-align:center;font-size:11px;padding:6px 14px;color:#fbbf24">WhatsApp не подключён — отправка недоступна (Настройки → WhatsApp)</div>` : '';
  const stageBar = STAGES.map(s=>`<button class="chip ${s.id===d.stage?'on':''}" data-act="wa-move-stage" data-id="${d.id}" data-stage="${s.id}">${s.name}</button>`).join('');
  openModal(`<div class="modal-h">${icon('wa')}<div><h3>Сделка и чат · ${cl.name}</h3><div class="mh-sub">${cl.phone} · ${st.name}</div></div><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b" style="padding:0">
      <div class="wa-stagebar"><span class="muted2" style="font-size:11px;margin-right:4px">Стадия:</span>${stageBar}</div>
      <div class="wa-split">
        ${info}
        <div class="wa-chat-pane">
          <div id="wa-chat-msgs" class="wa-chat" data-cid="${cl.id}"><div class="muted2" style="text-align:center;padding:24px">Загрузка…</div></div>
          ${hint}
          <div class="wa-compose">
            <input id="wa-chat-input" placeholder="Сообщение…" autocomplete="off" style="flex:1;background:var(--bg2);border:1px solid var(--line);border-radius:9px;padding:10px;color:var(--txt);font-size:13.5px" ${canSend?'':'disabled'}>
            <button class="btn green" data-act="wa-chat-send" data-id="${cl.id}" ${canSend?'':'disabled'}>${icon('send','sm')}</button>
          </div>
        </div>
      </div>
    </div>`, true);
  waBindChat(cl.id);
}
/* подключение загрузки/поллинга/Enter для открытого чата */
function waBindChat(clientId){
  waLoadChat();
  const inp=document.getElementById('wa-chat-input');
  if(inp) inp.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); waChatSend(clientId); } });
  if(window.__waPoll){ clearInterval(window.__waPoll); window.__waPoll=null; }
  if(apiOn()) window.__waPoll=setInterval(()=>{ if(!document.getElementById('wa-chat-msgs')){ clearInterval(window.__waPoll); window.__waPoll=null; return; } waLoadChat(true); }, 5000);
}
function waLoadChat(quiet){
  const box=document.getElementById('wa-chat-msgs'); if(!box) return;
  const cid=box.dataset.cid;
  const paint=(list)=>{
    const last=list[list.length-1];
    const sig=list.length+':'+((last&&(last.id||last.at))||'')+':'+((last&&last.status)||'');
    if(box.dataset.sig===sig) return; box.dataset.sig=sig;
    if(!list.length){ box.innerHTML=`<div class="muted2" style="text-align:center;padding:24px;line-height:1.5">Переписки пока нет.<br>Напишите первым — сообщение уйдёт клиенту в WhatsApp.</div>`; return; }
    box.innerHTML=list.map(m=>{ const dir=m.direction||m.dir;
      return `<div class="wa-bub ${dir==='out'?'out':'in'}"><div class="wa-tx">${escA(m.text||'')}</div><div class="wa-mt">${chatTime(m.at)}${dir==='out'&&m.status?' · '+m.status:''}</div></div>`; }).join('');
    box.scrollTop=box.scrollHeight;
  };
  if(apiOn()){ API.wa.messages({clientId:cid}).then(r=>paint(r.messages||[])).catch(()=>{ if(!quiet && !box.dataset.sig) box.innerHTML='<div class="muted2" style="text-align:center;padding:20px">Не удалось загрузить историю</div>'; }); }
  else { paint((DB.waMessages||[]).filter(m=>m.clientId===cid)); }
}
function waChatSend(clientId){
  const cl=clientById(clientId); const inp=document.getElementById('wa-chat-input');
  const msg=((inp&&inp.value)||'').trim(); if(!msg) return;
  if(!apiOn()){
    DB.waMessages=DB.waMessages||[];
    DB.waMessages.push({id:uid('wm'),clientId,dir:'out',text:msg,status:'sent',at:new Date().toISOString()});
    saveDB(); inp.value=''; const box=document.getElementById('wa-chat-msgs'); if(box) box.dataset.sig=''; waLoadChat();
    return;
  }
  if(!(waConfig && waConfig.enabled && waConfig.configured)){ toast('WhatsApp не подключён — настройте в Настройках','warn'); return; }
  if(!cl.phone){ toast('У клиента нет номера','warn'); return; }
  inp.disabled=true;
  API.wa.send(cl.phone, msg, {clientId}).then(()=>{ inp.value=''; inp.disabled=false; const box=document.getElementById('wa-chat-msgs'); if(box) box.dataset.sig=''; waLoadChat(); inp.focus();
  }).catch(e=>{ inp.disabled=false; toast('Не отправлено: '+((e&&e.message)||''),'warn'); });
}

/* настройки интеграции */
function waSetupWebhook(){
  const el=document.getElementById('wa-status'); if(el){ el.textContent='Регистрируем вебхук…'; el.style.color='var(--muted)'; }
  if(!apiOn()){ if(el) el.textContent='доступно только в серверном режиме'; return; }
  API.wa.setupWebhook().then(()=>{ if(el){ el.textContent='✓ приём входящих включён'; el.style.color='#4ade80'; } toast('Вебхук зарегистрирован в Green API'); })
    .catch(e=>{ if(el){ el.textContent='ошибка: '+((e&&e.message)||''); el.style.color='#f87171'; } });
}
function waSaveConfig(){
  if(!isDirector()){ return; }
  const idInstance=((document.getElementById('wa-id')||{}).value||'').trim();
  const apiToken=((document.getElementById('wa-token')||{}).value||'').trim();
  const enabled=!!(document.getElementById('wa-enabled')||{}).checked;
  if(!apiOn()){ toast('Подключение доступно только в серверном режиме (вход по логину)','warn'); return; }
  if(enabled && !idInstance && !(waConfig&&waConfig.configured)){ toast('Укажите idInstance','warn'); return; }
  API.wa.saveConfig({idInstance, apiToken, enabled}).then(c=>{ waConfig=c; render(); toast('Настройки WhatsApp сохранены'); })
    .catch(e=>toast('Не сохранено: '+((e&&e.message)||''),'warn'));
}
function waCheck(){
  const el=document.getElementById('wa-status'); if(el) el.textContent='Проверяем…';
  if(!apiOn()){ if(el) el.textContent='доступно только в серверном режиме'; return; }
  API.wa.status().then(s=>{
    if(!el) return;
    if(!s.configured){ el.textContent='инстанс не задан'; el.style.color='var(--muted)'; return; }
    if(s.stateInstance==='authorized'){ el.textContent='✓ авторизован (готов к отправке)'; el.style.color='#4ade80'; }
    else { el.textContent='состояние: '+(s.stateInstance||s.error||'нет связи'); el.style.color='#fbbf24'; }
  }).catch(e=>{ if(el){ el.textContent='ошибка: '+((e&&e.message)||''); el.style.color='#f87171'; } });
}

/* ============ ЭКСПОРТ CSV ============ */
function csvCell(v){ v=(v==null?'':String(v)); return /[";\n\r]/.test(v) ? '"'+v.replace(/"/g,'""')+'"' : v; }
function exportCSV(name, rows){
  const csv=rows.map(r=>r.map(csvCell).join(';')).join('\r\n');
  const blob=new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
  toast('Выгружено: '+name);
}
function expStamp(){ return new Date().toISOString().slice(0,10); }
function doExport(what){
  const money$=seesMoney();
  if(what==='clients'){
    const rows=[['Имя','Тип','Телефон','Адрес','Сделок','Сумма заказов','Долг']];
    DB.clients.forEach(cl=>{ const ds=DB.deals.filter(d=>d.clientId===cl.id);
      rows.push([cl.name,cl.type,cl.phone,cl.address,ds.length,ds.reduce((s,d)=>s+(d.sum||0),0),ds.reduce((s,d)=>s+dealDebt(d),0)]); });
    return exportCSV(`клиенты_${expStamp()}.csv`, rows);
  }
  if(what==='deals'){
    const rows=[['Клиент','Стадия','Менеджер','Источник','Сумма','Оплачено','Долг','Создана','Примечание']];
    DB.deals.forEach(d=>{ const cl=clientById(d.clientId); const m=userById(d.manager);
      rows.push([cl?cl.name:'', stageById(d.stage)?stageById(d.stage).name:d.stage, m?m.name:'', d.source||'', d.sum||0, dealPaid(d), dealDebt(d), d.createdAt?dateFull(d.createdAt):'', d.note||'']); });
    return exportCSV(`сделки_${expStamp()}.csv`, rows);
  }
  if(what==='warehouse'){
    const tab=state.whTab;
    if(tab==='comp'){
      const rows=[['Наименование','Остаток','Ед.','Минимум']];
      DB.components.forEach(c=>rows.push([c.name,c.stock,c.unit,c.min]));
      return exportCSV(`склад_комплектующие_${expStamp()}.csv`, rows);
    }
    if(tab==='moves'){
      const rows=[['Дата','Позиция','Операция','Направление','Количество','Ед.','Причина','Сотрудник']];
      (DB.movements||[]).slice().sort((a,b)=>String(b.at||'').localeCompare(String(a.at||''))).forEach(m=>{
        const u=userById(m.who); rows.push([m.at?dateFull(m.at):'', m.name||m.itemId, moveType(m.type).label, m.dir==='in'?'приход':'расход', m.qty, m.unit||'', m.reason||'', u?u.name:'']); });
      return exportCSV(`склад_движения_${expStamp()}.csv`, rows);
    }
    const head=['Профиль','Тип','Серия']; if(money$) head.push('Цена за м²'); head.push('Остаток','Ед.','Минимум','Поставщик');
    const rows=[head];
    DB.materials.forEach(m=>{ const r=[m.name,m.type,m.series]; if(money$) r.push(m.rate); r.push(m.stock,m.unit,m.min,m.supplier); rows.push(r); });
    return exportCSV(`склад_профиль_${expStamp()}.csv`, rows);
  }
  if(what==='finance'){
    const tab=state.financeTab;
    if(tab==='pay'){
      const rows=[['Поставщик','За что','Сумма','Срок','Статус']];
      DB.payables.forEach(p=>rows.push([p.supplier,p.forWhat,p.amount,p.due?dateFull(p.due):'',p.status]));
      return exportCSV(`кредиторка_${expStamp()}.csv`, rows);
    }
    if(tab==='pl'){
      const revenue=DB.deals.reduce((s,d)=>s+dealPaid(d),0);
      const orders=DB.deals.filter(d=>d.sum>0).reduce((s,d)=>s+d.sum,0);
      const cost=Math.round(revenue*0.56); const margin=revenue-cost;
      const rows=[['Показатель','Значение'],['Получено (касса)',revenue],['Законтрактовано',orders],['Себестоимость',cost],['Маржа',margin],['Рентабельность, %',Math.round(margin/Math.max(1,revenue)*100)]];
      return exportCSV(`финансы_отчет_${expStamp()}.csv`, rows);
    }
    const rows=[['Клиент','Стадия','Заказ','Оплачено','Долг']];
    DB.deals.filter(d=>dealDebt(d)>0 && d.sum>0).forEach(d=>{ const cl=clientById(d.clientId);
      rows.push([cl?cl.name:'', stageById(d.stage)?stageById(d.stage).name:d.stage, d.sum, dealPaid(d), dealDebt(d)]); });
    return exportCSV(`дебиторка_${expStamp()}.csv`, rows);
  }
}

/* ============ ССЫЛКА ДЛЯ КЛИЕНТА ============ */
function sharePick(t){
  document.querySelectorAll('.share-opt').forEach(b=>b.classList.remove('on'));
  t.classList.add('on');
  const mk=document.querySelector('[data-act="share-make"]'); if(mk) mk.dataset.h=t.dataset.h;
  const ci=document.getElementById('share-hours'); if(ci) ci.value='';
}
function shareMake(t){
  const custom=parseFloat((document.getElementById('share-hours')||{}).value);
  const hours = (custom && custom>0) ? custom : (parseFloat(t.dataset.h)||24);
  const label = ((document.getElementById('share-label')||{}).value||'').trim();
  const url = demoLink(hours, label);
  const exp = Date.now()+Math.round(hours*3600*1000);
  const out=document.getElementById('share-out'); if(!out) return;
  out.innerHTML = `<div class="share-result">
    <div class="label">Ссылка готова · активна до ${fmtExpiry(exp)}</div>
    <textarea class="share-url" id="share-url" readonly rows="2">${url}</textarea>
    <button class="btn green" data-act="copy-link">${icon('copy','sm')} Скопировать ссылку</button>
    <a class="btn" href="https://wa.me/?text=${encodeURIComponent('Демо CRM для оконного бизнеса (доступ до '+fmtExpiry(exp)+'): '+url)}" target="_blank" rel="noopener">${icon('wa','sm')} Отправить в WhatsApp</a>
  </div>`;
  const ta=document.getElementById('share-url'); if(ta){ ta.focus(); ta.select(); }
}
function copyShareLink(){
  const ta=document.getElementById('share-url'); if(!ta) return;
  const done=()=>toast('Ссылка скопирована в буфер обмена');
  try{ navigator.clipboard.writeText(ta.value).then(done, ()=>{ ta.select(); document.execCommand('copy'); done(); }); }
  catch(e){ ta.select(); try{ document.execCommand('copy'); done(); }catch(_){ toast('Скопируйте ссылку вручную','warn'); } }
}

/* ============ ГЛОБАЛЬНЫЙ ПОИСК ============ */
function clearSearch(){
  const dd=document.getElementById('search-dd'); if(dd){ dd.classList.remove('open'); dd.innerHTML=''; }
  const si=document.getElementById('global-search'); if(si) si.value='';
}
function globalSearch(q){
  const dd=document.getElementById('search-dd'); if(!dd) return;
  q=(q||'').trim().toLowerCase();
  if(q.length<2){ dd.classList.remove('open'); dd.innerHTML=''; return; }
  const has=s=>(s||'').toLowerCase().includes(q);
  let html='';
  if(canSee('clients')){
    const cls=DB.clients.filter(c=>has(c.name)||has(c.phone)||has(c.address)).slice(0,5);
    if(cls.length) html+=`<div class="sd-group">Клиенты</div>`+cls.map(c=>
      `<button class="sd-item" data-act="open-client" data-id="${c.id}">${avatarXs(c.name,c.id)}<span class="sd-main">${c.name}</span><span class="sd-sub">${c.phone}</span></button>`).join('');
  }
  if(canSee('funnel')){
    const dls=DB.deals.filter(d=>{const cl=clientById(d.clientId); return has(cl&&cl.name)||has(d.note);}).slice(0,6);
    if(dls.length) html+=`<div class="sd-group">Сделки</div>`+dls.map(d=>{const cl=clientById(d.clientId);const st=stageById(d.stage);
      return `<button class="sd-item" data-act="open-deal" data-id="${d.id}"><span class="dot-i" style="background:${st.color}"></span><span class="sd-main">${cl.name}</span><span class="sd-sub">${st.name}${d.sum?' · '+moneyK(d.sum):''}</span></button>`;}).join('');
  }
  if(!html) html=`<div class="sd-empty">Ничего не найдено</div>`;
  dd.innerHTML=html; dd.classList.add('open');
}

/* ============ EVENT DELEGATION ============ */
document.addEventListener('click', e=>{
  const t=e.target.closest('[data-act]'); if(!t) return;
  const a=t.dataset.act, id=t.dataset.id;
  switch(a){
    case 'login': login(id); break;
    case 'api-login': apiLoginSubmit(); break;
    case 'logout': logout(); break;
    case 'nav': nav(t.dataset.mod); break;
    case 'toggle-side': state.sideOpen=!state.sideOpen; render(); break;
    case 'reset':
      if(apiOn()){ bootFromApi().then(()=>{ state.measureDealId=null; render(); toast('Данные обновлены с сервера'); }).catch(e=>toast('Ошибка обновления: '+(e&&e.message||''),'warn')); }
      else { resetDB(); state.measureDealId=null; render(); toast('Демо-данные сброшены'); }
      break;
    case 'notif': notifModal(); break;
    case 'edit-company': editCompanyModal(); break;
    case 'save-company': saveCompany(); break;
    case 'add-user': userModal(null); break;
    case 'edit-user': userModal(id); break;
    case 'save-user': saveUser(t.dataset.id||null); break;
    case 'del-user': delUserModal(id); break;
    case 'del-user-confirm': delUserConfirm(id); break;
    case 'perm-toggle': togglePerm(t.dataset.mod, t.dataset.role); break;
    case 'theme': state.theme = state.theme==='light' ? 'dark' : 'light'; try{ localStorage.setItem(THEME_KEY, state.theme); }catch(e){} applyTheme(state.theme); render(); break;
    case 'noop': break;
    case 'go-finance': state.module='finance'; state.financeTab='recv'; render(); break;
    case 'go-prod': state.module='production'; render(); break;
    case 'go-measure-deal': state.measureDealId=id; state.module='measure'; closeModal(); render(); break;
    case 'open-deal': openDeal(id); clearSearch(); break;
    case 'move-stage': moveStage(id, t.dataset.stage); break;
    case 'wa-move-stage': waMoveStage(id, t.dataset.stage); break;
    case 'new-deal': newDealModal(); break;
    case 'create-deal': createDeal(); break;
    case 'export': doExport(t.dataset.what); break;
    case 'cat-add': catModal(t.dataset.type, null); break;
    case 'cat-edit': catModal(t.dataset.type, id); break;
    case 'cat-save': catSave(t.dataset.type, t.dataset.id||null); break;
    case 'cat-del': catDelModal(t.dataset.type, id); break;
    case 'cat-del-confirm': catDelConfirm(t.dataset.type, id); break;
    case 'new-payable': payableModal(null); break;
    case 'edit-payable': payableModal(id); break;
    case 'save-payable': savePayable(t.dataset.id||null); break;
    case 'payable-paid': payablePaid(id); break;
    case 'del-payable': delPayableModal(id); break;
    case 'del-payable-confirm': delPayableConfirm(id); break;
    case 'del-deal': delDealModal(id); break;
    case 'del-deal-confirm': delDealConfirm(id); break;
    case 'edit-deal': editDealModal(id); break;
    case 'save-deal-edit': saveDealEdit(t.dataset.id); break;
    case 'add-task': addTaskModal(id); break;
    case 'create-task': createTask(t.dataset.id); break;
    case 'task-toggle': toggleTask(id); break;
    case 'task-del': delTask(id); break;
    case 'open-client': openClient(id); clearSearch(); break;
    case 'new-client': newClientModal(); break;
    case 'create-client': createClient(); break;
    case 'del-client': delClientModal(id); break;
    case 'del-client-confirm': delClientConfirm(id); break;
    case 'edit-client': editClientModal(id); break;
    case 'save-client': saveClient(t.dataset.id); break;
    case 'import-clients': importClientsModal(); break;
    case 'import-clients-run': importClientsRun(); break;
    case 'wa-deal': waSendModal(null, id); break;
    case 'wa-client': waSendModal(id, null); break;
    case 'wa-send': waDoSend(t.dataset.id||null, t.dataset.deal||null); break;
    case 'wa-chat': waChatModal(id); break;
    case 'wa-deal-chat': waDealChatModal(id); break;
    case 'wa-chat-send': waChatSend(id); break;
    case 'wa-save-config': waSaveConfig(); break;
    case 'wa-check': waCheck(); break;
    case 'wa-setup-webhook': waSetupWebhook(); break;
    case 'add-payment': addPaymentModal(id); break;
    case 'confirm-payment': confirmPayment(id); break;
    case 'm-pick': state.measureDealId=id; renderModule(); break;
    case 'm-add': mAdd(); break;
    case 'm-del': mDel(t.dataset.cid); break;
    case 'm-open': mSet(t.dataset.cid,'openId',t.dataset.v); break;
    case 'm-extra': mSet(t.dataset.cid,'extras',t.dataset.v); break;
    case 'gen-kp': { const d=dealById(id); d.sum=computeMeasure(d).total; saveDB(); if(apiOn()) persist(API.persist.saveDeal(d)); openKp(id); } break;
    case 'print-kp': printKp(id); break;
    case 'quick-prepay': applyPrepay(id); break;
    case 'confirm-prepay': applyPrepay(id); break;
    case 'wh-tab': state.whTab=t.dataset.v; renderModule(); break;
    case 'wh-mv-type': state.whMoveType=t.dataset.v; renderModule(); break;
    case 'wh-mv-period': state.whMovePeriod=t.dataset.v; renderModule(); break;
    case 'wh-receive': whReceiveModal(id, t.dataset.kind); break;
    case 'wh-confirm-receive': whConfirmReceive(id, t.dataset.kind); break;
    case 'wh-writeoff': whWriteoffModal(id, t.dataset.kind); break;
    case 'wh-confirm-writeoff': whConfirmWriteoff(id, t.dataset.kind); break;
    case 'wh-item-add': whItemModal(t.dataset.kind, null); break;
    case 'wh-edit': whItemModal(t.dataset.kind, id); break;
    case 'wh-item-save': whItemSave(t.dataset.kind, t.dataset.id||null); break;
    case 'wh-del': whItemDelModal(t.dataset.kind, id); break;
    case 'wh-item-del-confirm': whItemDelConfirm(t.dataset.kind, id); break;
    case 'open-prod': openProd(id); break;
    case 'move-prod': moveProd(id, t.dataset.stage); break;
    case 'fin-tab': state.financeTab=t.dataset.v; renderModule(); break;
    case 'share-demo': shareModal(); break;
    case 'share-pick': sharePick(t); break;
    case 'share-make': shareMake(t); break;
    case 'copy-link': copyShareLink(t); break;
    case 'close-modal': closeModal(); break;
    case 'modal-bg': if(e.target===t) closeModal(); break;
  }
});
document.addEventListener('change', e=>{
  const t=e.target.closest('[data-act]'); if(!t) return;
  if(t.dataset.act==='m-profile') mSet(t.dataset.cid,'profileId',t.value);
  if(t.dataset.act==='m-glass') mSet(t.dataset.cid,'glassId',t.value);
});
document.addEventListener('input', e=>{
  const t=e.target.closest('[data-act]'); if(!t) return;
  if(t.dataset.act==='search'){ globalSearch(t.value); return; }
  if(t.dataset.act==='m-discount'){ const d=dealById(t.dataset.id); d.discount=Math.max(0,Math.min(30,parseFloat(t.value)||0)); saveDB(); if(apiOn()) persist(API.persist.saveDeal(d)); patchMeasure(); }
  if(t.dataset.act==='m-prepay'){ const d=dealById(t.dataset.id); d.prepayPct=Math.max(0,Math.min(100,parseFloat(t.value)||0)); saveDB(); if(apiOn()) persist(API.persist.saveDeal(d)); patchMeasure(); }
});
document.addEventListener('keydown', e=>{ if(e.key==='Escape'){ closeModal(); clearSearch(); } });
document.addEventListener('keydown', e=>{ if(e.key==='Enter' && (e.target.id==='api-email'||e.target.id==='api-pass')){ e.preventDefault(); apiLoginSubmit(); } });
/* закрыть выпадашку поиска по клику вне неё */
document.addEventListener('click', e=>{
  const dd=document.getElementById('search-dd'); if(!dd||!dd.classList.contains('open')) return;
  if(e.target.closest('.search')) return;
  dd.classList.remove('open');
});

/* ============ DRAG & DROP ============ */
let dragId=null, dragKind=null;
document.addEventListener('dragstart', e=>{
  const c=e.target.closest('[data-card],[data-pcard]'); if(!c) return;
  dragId=c.dataset.card||c.dataset.pcard; dragKind=c.dataset.card?'deal':'prod'; c.classList.add('dragging');
});
document.addEventListener('dragend', e=>{ const c=e.target.closest('[data-card],[data-pcard]'); if(c)c.classList.remove('dragging');
  document.querySelectorAll('.drop-hot').forEach(x=>x.classList.remove('drop-hot')); dragId=null; });
document.addEventListener('dragover', e=>{
  const z=e.target.closest('[data-drop],[data-pdrop]'); if(!z) return; e.preventDefault();
  const col=z.closest('.kcol'); document.querySelectorAll('.drop-hot').forEach(x=>x.classList.remove('drop-hot')); if(col)col.classList.add('drop-hot');
});
document.addEventListener('drop', e=>{
  const z=e.target.closest('[data-drop],[data-pdrop]'); if(!z||!dragId) return; e.preventDefault();
  if(dragKind==='deal' && z.dataset.drop){ const d=dealById(dragId); if(d&&d.stage!==z.dataset.drop) moveStage(dragId, z.dataset.drop); }
  if(dragKind==='prod' && z.dataset.pdrop){ const d=dealById(dragId); if(d&&(d.prodStage||'queue')!==z.dataset.pdrop) moveProd(dragId, z.dataset.pdrop); }
  dragId=null;
});

/* ============ INIT ============ */
/* Если есть сохранённый токен — пробуем поднять данные с сервера и войти автоматически.
   При любой ошибке — тихий откат в демо-режим (localStorage), сайт не ломается. */
(async function init(){
  try{
    if(window.API && API.isAuthed()){
      await bootFromApi();
      const me=await API.me();
      state.user={ id:me.id, name:me.name, role:me.role_id, title:me.title, email:me.email };
      state.module=defaultModule(state.user.role);
    }
  }catch(e){ try{ API.logout(); }catch(_){ } }
  render();
})();
