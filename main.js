'use strict';
/* ============ ACTIONS ============ */
function login(id){ state.user=userById(id); state.module=defaultModule(state.user.role); state.measureDealId=null; applyHashToState(); render(); flushHashOpen(); }
// открыть карточку из URL (?deal=/?client=), один раз
function flushHashOpen(){ const o=__pendingHashOpen; __pendingHashOpen=null; if(!o) return;
  if(o.deal && dealById(o.deal)) openDeal(o.deal);
  else if(o.client && clientById(o.client)) openClient(o.client); }
function logout(){ try{ if(window.API){ API.logout(); API.enabled=false; } }catch(e){} state.user=null; render(); }

/* ====== ВХОД ЧЕРЕЗ API (Слой 4) ====== */
/* Заменяет данные демо серверными (bootstrap), оставляя справочники-константы. */
async function bootFromApi(){
  const mapped = await API.loadBootstrap();
  DB = mapped.DB;            // данные с сервера в формате фронта
  applyServerCatalogs(mapped.catalogs); // справочники и права с сервера → живые глобали
  API.enabled = true;        // включаем запись на сервер
  try { waConfig = await API.wa.getConfig(); } catch(e){ waConfig = { configured:false, enabled:false, idInstance:'' }; }
  try { igConfig = await API.ig.getConfig(); } catch(e){ igConfig = { configured:false, enabled:false, username:'' }; }
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
    const def={}; Object.keys(MODULE_ROLES).forEach(k=>def[k]=MODULE_ROLES[k].slice());
    Object.keys(MODULE_ROLES).forEach(k=>{ delete MODULE_ROLES[k]; });
    Object.keys(cat.MODULE_ROLES).forEach(k=>{ MODULE_ROLES[k]=cat.MODULE_ROLES[k].slice(); });
    Object.keys(def).forEach(k=>{ if(!(k in MODULE_ROLES)) MODULE_ROLES[k]=def[k]; });
  }
  if(Array.isArray(cat.ROLES) && cat.ROLES.length){ ROLES = cat.ROLES.map(r=>({...r})); }
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
    who: (state.user && state.user.id) || null, at: now().toISOString(),
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
  d.stage=stage; d.stageSince=now().toISOString();
  if(['production','install'].includes(stage) && !d.prodStage) d.prodStage='queue';
  if(stage!=='lead' && !d.sum && (d.items||[]).length) d.sum=computeMeasure(d).total;
  saveDB(); if(apiOn()) persist(API.persist.saveDeal(d));
}
/* при переводе в производство — проверка нехватки материалов; уведомление в ленту (склад/ответственный) */
function notifyProdShortage(d){
  if(typeof materialShortage!=='function') return null;
  const short=materialShortage(d); if(!short.length) return null;
  const cl=clientById(d.clientId);
  const txt='⚠ Не хватает материалов для производства — '+(cl?cl.name:d.id)+': '+short.map(s=>`${s.name} (−${s.lack} ${s.unit})`).join(', ');
  DB.activity.unshift({who:(state.user&&state.user.id)||null, text:txt, at:now().toISOString(), kind:'wh'});
  saveDB(); if(apiOn()) persist(API.persist.createActivity(DB.activity[0]));
  return short;
}
function moveStage(id, stage){
  const d=dealById(id); if(!d) return;
  setDealStage(d, stage);
  const short = stage==='production' ? notifyProdShortage(d) : null;
  closeModal(); render();
  if(short) toast('⚠ Не хватает материалов — уведомлены ответственный и склад','warn');
  else toast(`Сделка перемещена в «${stageById(stage).name}»`);
}
/* смена стадии из совмещённого вида (чат сделки) — обновляем модалку, не закрывая чат */
function waMoveStage(id, stage){
  const d=dealById(id); if(!d) return;
  if(d.stage===stage) return;
  setDealStage(d, stage);
  const short = stage==='production' ? notifyProdShortage(d) : null;
  waDealChatModal(id);
  toast(short?'⚠ Не хватает материалов — уведомлены ответственный и склад':`Стадия: «${stageById(stage).name}»`, short?'warn':undefined);
}
function moveProd(id, stage){ const d=dealById(id); if(!d) return; d.prodStage=stage;
  if(stage==='installing' && d.stage==='production') d.stage='install';
  const before = snapshotStock();   // всегда — для журнала движений
  const used=consumeForStage(d, stage);
  if(used.length){
    const cl=clientById(d.clientId);
    DB.activity.unshift({who:state.user.id,text:`Списано со склада (${PROD_STAGES.find(s=>s.id===stage).name}) — ${cl.name}`,at:now().toISOString(),kind:'wh'});
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
  if(dealPaid(d)===0){ d.payments=d.payments||[]; addedPay={id:uid('p'),type:'Аванс',amount:k.prepay,date:now().toISOString()}; d.payments.push(addedPay); }
  d.stage='prepaid'; d.stageSince=now().toISOString(); d.prodStage='queue';
  DB.activity.unshift({who:state.user.id,text:`Принял предоплату ${money(k.prepay)} — ${clientById(d.clientId).name}`,at:now().toISOString(),kind:'money'});
  state.measureDealId=null;
  saveDB();
  if(apiOn()){ persist(API.persist.saveDeal(d)); if(addedPay) persist(API.persist.createPayment(d.id, addedPay)); persist(API.persist.createActivity(DB.activity[0])); }
  closeModal(); render();
  toast(`Аванс ${money(k.prepay)} принят · заказ в очереди производства`);
}
function addPaymentModal(id){
  const d=dealById(id); const debt=dealDebt(d); const cl=clientById(d.clientId);
  openModal(`<div class="modal-h">${icon('money')}<div><h3>Принять оплату</h3><div class="mh-sub">${escA(cl.name)} · остаток ${money(debt)}</div></div><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b"><div class="fld full"><label>Сумма оплаты, сом</label><input id="pay-amt" type="number" value="${debt}" style="background:var(--bg2);border:1px solid var(--line);border-radius:9px;padding:11px;color:var(--txt);font-size:16px;font-weight:700"></div>
    <div class="muted2" style="font-size:12px;margin-top:8px">Платёж зачислится по сделке и обновит дебиторку.</div></div>
    <div class="modal-f"><button class="btn" data-act="close-modal">Отмена</button><button class="btn green" data-act="confirm-payment" data-id="${id}">${icon('check','sm')} Зачислить</button></div>`);
}
function confirmPayment(id){
  const d=dealById(id); const amt=parseFloat(document.getElementById('pay-amt').value)||0; if(amt<=0){closeModal();return;}
  d.payments=d.payments||[]; const addedPay={id:uid('p'),type:'Доплата',amount:amt,date:now().toISOString()}; d.payments.push(addedPay);
  const wasDone = d.stage==='done';
  if(dealDebt(d)<=0 && d.stage==='install') d.stage='done';
  saveDB();
  if(apiOn()){ persist(API.persist.createPayment(d.id, addedPay)); if(!wasDone && d.stage==='done') persist(API.persist.saveDeal(d)); }
  closeModal(); render(); toast(`Оплата ${money(amt)} зачислена`);
}
function newDealModal(){
  const opts=DB.clients.map(c=>`<option value="${c.id}">${escA(c.name)}</option>`).join('');
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
  const nd={id:uid('d'),clientId:cid,stage:'lead',manager:state.user.id,sum:0,createdAt:now().toISOString(),stageSince:now().toISOString(),note,source:'Звонок',payments:[],items:[],kp:null,prodStage:null};
  DB.deals.unshift(nd);
  saveDB(); if(apiOn()) persist(API.persist.createDeal(nd)); closeModal(); renderModule(); toast('Лид создан');
}
function editDealModal(id){
  const d=dealById(id); if(!d) return;
  const mgrs=DB.users.filter(u=>['director','manager'].includes(u.role)||u.id===d.manager);
  const mgrOpts=mgrs.map(u=>`<option value="${u.id}"${u.id===d.manager?' selected':''}>${escA(u.name)} · ${roleRu(u.role)}</option>`).join('');
  const srcOpts=SOURCES.map(s=>`<option${s===d.source?' selected':''}>${s}</option>`).join('');
  const money$=seesMoney();
  const moneyFields=money$?`
      <div class="fld"><label>Сумма заказа, сом</label><input id="ed-sum" type="number" min="0" value="${d.sum||dealItemsSum(d)}"></div>
      <div class="fld"><label>Оплачено, сом</label><input id="ed-paid" type="number" min="0" value="${dealPaid(d)}"></div>`:'';
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
    if(delta!==0){ addedPay={id:uid('p'), type:'Доплата', amount:delta, date:now().toISOString()}; d.payments=d.payments||[]; d.payments.push(addedPay); }
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
/* ====== ИМПОРТ СКЛАДА (профиль / комплектующие) ====== */
let __impWhKind='mat';
function mapWhRows(rows, kind){
  if(!rows.length) return [];
  const head=rows[0].map(h=>String(h).toLowerCase().trim());
  const find=(...keys)=>head.findIndex(h=>keys.some(k=>h.includes(k)));
  const numOf=s=>{ const n=parseFloat(String(s||'').replace(/\s/g,'').replace(/[^\d.,-]/g,'').replace(',','.')); return isFinite(n)?n:0; };
  if(kind==='mat'){
    const iName=find('профиль','наимен','назв','матери'), iType=find('тип'), iSer=find('серия'), iRate=find('цена','rate'), iStock=find('остаток','кол','stock'), iMin=find('миним','мин'), iUnit=find('ед'), iSup=find('поставщ');
    let data, idx;
    if(iName>=0||iStock>=0){ data=rows.slice(1); idx={name:iName>=0?iName:0,type:iType,series:iSer,rate:iRate,stock:iStock,min:iMin,unit:iUnit,sup:iSup}; }
    else { data=rows; idx={name:0,type:1,series:2,rate:3,stock:4,unit:5,min:6,sup:7}; }
    return data.map(r=>{ const g=i=>(i>=0&&i<r.length)?String(r[i]).trim():''; const name=g(idx.name); if(!name) return null;
      return { name, type:g(idx.type)||'ПВХ', series:g(idx.series)||'Эконом', rate:Math.round(numOf(g(idx.rate))), stock:numOf(g(idx.stock)), min:numOf(g(idx.min)), unit:g(idx.unit)||'пог.м', supplier:g(idx.sup)||'' }; }).filter(Boolean);
  }
  const iName=find('наимен','назв','компл'), iStock=find('остаток','кол','stock'), iMin=find('миним','мин'), iUnit=find('ед');
  let data, idx;
  if(iName>=0||iStock>=0){ data=rows.slice(1); idx={name:iName>=0?iName:0,stock:iStock,unit:iUnit,min:iMin}; }
  else { data=rows; idx={name:0,stock:1,unit:2,min:3}; }
  return data.map(r=>{ const g=i=>(i>=0&&i<r.length)?String(r[i]).trim():''; const name=g(idx.name); if(!name) return null;
    return { name, stock:numOf(g(idx.stock)), min:numOf(g(idx.min)), unit:g(idx.unit)||'шт' }; }).filter(Boolean);
}
function importWhModal(kind){
  if(!seesMoney()) return; __impWhKind=kind==='comp'?'comp':'mat'; __impRows=[];
  const isMat=__impWhKind==='mat';
  const cols=isMat?'<b>Профиль</b>, <b>Тип</b>, <b>Серия</b>, <b>Цена</b>, <b>Остаток</b>, <b>Ед.</b>, <b>Минимум</b>, <b>Поставщик</b>':'<b>Наименование</b>, <b>Остаток</b>, <b>Ед.</b>, <b>Минимум</b>';
  openModal(`<div class="modal-h">${icon('box')}<h3>Импорт — ${isMat?'профиль':'стеклопакеты и фурнитура'}</h3><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b">
      <div class="muted2" style="font-size:12px;line-height:1.5;margin-bottom:12px">Загрузите CSV. Колонки по заголовкам: ${cols} (либо в таком порядке без заголовков — как в кнопке «Экспорт»). Совпадение по наименованию обновляет позицию, новые — добавляются.</div>
      <input type="file" id="imp-file" accept=".csv,text/csv,text/plain" style="margin-bottom:12px;width:100%">
      <div id="imp-preview" class="muted2" style="font-size:12px">Файл не выбран</div>
    </div>
    <div class="modal-f"><button class="btn" data-act="close-modal">Отмена</button><button class="btn primary" id="imp-run" data-act="import-wh-run" disabled>${icon('check','sm')} Импортировать</button></div>`);
  const f=document.getElementById('imp-file');
  if(f) f.addEventListener('change', e=>{ const file=e.target.files&&e.target.files[0]; if(!file) return;
    const rd=new FileReader();
    rd.onload=()=>{ try{ __impRows=mapWhRows(parseCSV(String(rd.result)), __impWhKind); }catch(err){ __impRows=[]; } renderImpWhPreview(); };
    rd.onerror=()=>{ __impRows=[]; renderImpWhPreview(); };
    rd.readAsText(file,'utf-8'); });
}
function renderImpWhPreview(){
  const box=document.getElementById('imp-preview'); const btn=document.getElementById('imp-run'); if(!box) return;
  if(!__impRows.length){ box.innerHTML='Не найдено строк для импорта — проверьте файл.'; if(btn) btn.disabled=true; return; }
  const isMat=__impWhKind==='mat';
  const head=isMat?'<th>Профиль</th><th>Тип</th><th>Серия</th><th class="num">Остаток</th><th>Ед.</th>':'<th>Наименование</th><th class="num">Остаток</th><th>Ед.</th>';
  const rows=__impRows.slice(0,5).map(x=>isMat
    ?`<tr><td>${escA(x.name)}</td><td>${escA(x.type)}</td><td>${escA(x.series)}</td><td class="num">${x.stock}</td><td>${escA(x.unit)}</td></tr>`
    :`<tr><td>${escA(x.name)}</td><td class="num">${x.stock}</td><td>${escA(x.unit)}</td></tr>`).join('');
  box.innerHTML=`<div style="margin-bottom:8px">Найдено позиций: <b>${__impRows.length}</b>${__impRows.length>5?' (показаны первые 5)':''}</div>
    <div class="tbl-scroll"><table class="tbl"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
  if(btn) btn.disabled=false;
}
function importWhRun(){
  if(!__impRows.length || !seesMoney()) return;
  const isMat=__impWhKind==='mat'; let added=0, updated=0;
  const norm=s=>String(s||'').toLowerCase().trim();
  __impRows.forEach(x=>{
    if(isMat){
      const ex=DB.materials.find(m=>norm(m.name)===norm(x.name));
      if(ex){ ex.type=x.type; ex.series=x.series; if(x.rate) ex.rate=x.rate; ex.stock=x.stock; ex.min=x.min; ex.unit=x.unit; if(x.supplier) ex.supplier=x.supplier; updated++;
        if(apiOn()){ persist(API.persist.saveMaterialCard(ex)); persist(API.persist.saveMaterial(ex)); } }
      else { const nm={id:uid('m'),name:x.name,type:x.type,series:x.series,rate:x.rate,stock:x.stock,min:x.min,unit:x.unit,supplier:x.supplier}; DB.materials.push(nm); added++;
        if(apiOn()) persist(API.persist.createMaterial(nm)); }
    } else {
      const ex=DB.components.find(c=>norm(c.name)===norm(x.name));
      if(ex){ ex.stock=x.stock; ex.min=x.min; ex.unit=x.unit; updated++;
        if(apiOn()){ persist(API.persist.saveComponentCard(ex)); persist(API.persist.saveComponent(ex)); } }
      else { const nc={id:uid('c'),name:x.name,stock:x.stock,min:x.min,unit:x.unit}; DB.components.push(nc); added++;
        if(apiOn()) persist(API.persist.createComponent(nc)); }
    }
  });
  saveDB(); closeModal(); renderModule();
  toast(`Импорт: добавлено ${added}${updated?` · обновлено ${updated}`:''}`);
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
/* вернуться в нужный карточный модал (сделка или производство) */
function reopenModal(id){ if(__modalKind==='prod' && typeof openProd==='function') openProd(id); else openDeal(id); }
/* фото объекта: монтажник прикрепляет итоговое фото (сжимаем в base64 для демо) */
function dealPhotoAdd(dealId){
  const d=dealById(dealId); if(!d) return;
  const inp=document.createElement('input'); inp.type='file'; inp.accept='image/*';
  inp.onchange=()=>{ const f=inp.files&&inp.files[0]; if(!f) return;
    const reader=new FileReader();
    reader.onload=()=>{ const img=new Image(); img.onload=()=>{
      const max=1280; let w=img.width, h=img.height; if(w>max||h>max){ const k=Math.min(max/w,max/h); w=Math.round(w*k); h=Math.round(h*k); }
      const cv=document.createElement('canvas'); cv.width=w; cv.height=h; cv.getContext('2d').drawImage(img,0,0,w,h);
      let src; try{ src=cv.toDataURL('image/jpeg',0.72); }catch(e){ src=reader.result; }
      d.photos=d.photos||[]; d.photos.push({id:uid('ph'), src, by:(state.user&&state.user.id)||null, at:now().toISOString()});
      saveDB(); toast('Фото добавлено'); reopenModal(dealId);
    }; img.onerror=()=>toast('Не удалось прочитать изображение','warn'); img.src=reader.result; };
    reader.readAsDataURL(f);
  };
  inp.click();
}
function dealPhotoView(pid, dealId){ const d=dealById(dealId); const ph=(d&&d.photos||[]).find(p=>p.id===pid); if(!ph) return;
  openModal(`<div class="modal-h">${icon('box')}<div><h3>Фото объекта</h3><div class="mh-sub">${chatTime(ph.at)}</div></div><button class="x" data-act="deal-photo-back" data-id="${dealId}">${icon('x')}</button></div>
    <div class="modal-b" style="text-align:center"><img src="${ph.src}" alt="фото" style="max-width:100%;border-radius:10px"></div>
    <div class="modal-f"><button class="btn" data-act="deal-photo-back" data-id="${dealId}">${icon('arrow','sm')} Назад</button></div>`, true); }
function dealCommentAdd(dealId){ const d=dealById(dealId); if(!d) return; const el=document.getElementById('cmt-input-'+dealId); const txt=(el&&el.value||'').trim(); if(!txt) return;
  d.comments=d.comments||[]; d.comments.push({id:uid('cm'), by:(state.user&&state.user.id)||null, at:now().toISOString(), text:txt});
  saveDB(); reopenModal(dealId); }
function addTaskModal(dealId){
  const d=dealById(dealId);
  const users=DB.users.filter(u=>['director','manager','surveyor','production'].includes(u.role));
  const opts=users.map(u=>`<option value="${u.id}"${u.id===(d&&d.manager)?' selected':''}>${escA(u.name)}</option>`).join('');
  openModal(`<div class="modal-h">${icon('clock')}<h3>Новая задача</h3><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b"><div class="constr-body" style="padding:0">
      <div class="fld full"><label>Что сделать</label><input id="tk-title" placeholder="напр. Перезвонить клиенту"></div>
      <div class="fld"><label>Срок</label><input id="tk-due" type="date" value="${now().toISOString().slice(0,10)}"></div>
      <div class="fld"><label>Ответственный</label><select id="tk-assignee">${opts}</select></div>
    </div></div>
    <div class="modal-f"><button class="btn" data-act="close-modal">Отмена</button><button class="btn primary" data-act="create-task" data-id="${dealId}">${icon('check','sm')} Добавить</button></div>`);
}
function createTask(dealId){
  const v=i=>{const el=document.getElementById(i);return el?el.value.trim():'';};
  const title=v('tk-title'); if(!title){ toast('Опишите задачу','warn'); return; }
  const dueRaw=v('tk-due'); const due=dueRaw?new Date(dueRaw).toISOString():now().toISOString();
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
/* ============ КОРЗИНА: мягкое удаление ============ */
function trashPush(type, snapshot, name, sub){
  DB.trash = DB.trash || [];
  DB.trash.unshift({ id:uid('tr'), type, name:name||'', sub:sub||'', snapshot,
    deletedAt:new Date().toISOString(), retentionDays:TRASH_DEFAULT_DAYS });
}
function purgeExpiredTrash(){
  if(!Array.isArray(DB.trash) || !DB.trash.length) return;
  const before=DB.trash.length;
  DB.trash = DB.trash.filter(r=>{ const left=trashMsLeft(r); return left===null || left>0; });
  if(DB.trash.length!==before) saveDB();
}
function trashSetRetention(id, days){
  const r=(DB.trash||[]).find(x=>x.id===id); if(!r) return;
  r.retentionDays=days; saveDB(); renderModule();
}
function trashPurge(id){ DB.trash=(DB.trash||[]).filter(x=>x.id!==id); saveDB(); renderModule(); toast('Удалено окончательно'); }
function restoreDealApi(d, tasks){
  persist(API.persist.createDeal(d).then(()=>{
    (d.items||[]).forEach(it=>persist(API.persist.createItem(d.id, it).then(()=>{ (it.extras||[]).forEach(ex=>persist(API.persist.setItemExtra(it.id, ex, true))); })));
    (d.payments||[]).forEach(p=>persist(API.persist.createPayment(d.id, p)));
    (tasks||[]).forEach(t=>persist(API.persist.createTask(t)));
  }));
}
function trashRestore(id){
  const r=(DB.trash||[]).find(x=>x.id===id); if(!r) return; const s=r.snapshot;
  switch(r.type){
    case 'client':
      if(!clientById(s.id)){ const {_wa, ...cl}=s; DB.clients.push(cl);
        if(Array.isArray(_wa)){ DB.waMessages=DB.waMessages||[]; _wa.forEach(m=>DB.waMessages.push(m)); }
        if(apiOn()) persist(API.persist.createClient(cl)); }
      break;
    case 'deal':
      if(!dealById(s.id)){ const {_tasks, ...d}=s; DB.deals.push(d);
        if(Array.isArray(_tasks)){ DB.tasks=DB.tasks||[]; _tasks.forEach(t=>DB.tasks.push(t)); }
        if(apiOn()) restoreDealApi(d, _tasks); }
      break;
    case 'material':  if(!matById(s.id)){ DB.materials.push(s); if(apiOn()) persist(API.persist.createMaterial(s)); } break;
    case 'component': if(!compById(s.id)){ DB.components.push(s); if(apiOn()) persist(API.persist.createComponent(s)); } break;
    case 'payable':   if(!DB.payables.some(p=>p.id===s.id)){ DB.payables.push(s); if(apiOn()) persist(API.persist.createPayable(s)); } break;
    case 'glass': case 'opening': case 'extra': { const cfg=CATALOGS_EDIT[r.type];
      if(cfg && !cfg.arr().some(x=>x.id===s.id)){ cfg.arr().push(s); if(apiOn()) persist(API.fetch(cfg.api,{method:'POST',body:catBody(cfg,s)})); } break; }
  }
  DB.trash=DB.trash.filter(x=>x.id!==id); saveDB(); render(); toast('Восстановлено из корзины');
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
    <div class="modal-b"><p style="margin:0;color:var(--muted);line-height:1.5">${escA(cl.name)} · ${escA(cl.phone)}.<br>Клиент и переписка в чате переместятся в корзину — можно восстановить.</p></div>
    <div class="modal-f"><button class="btn" data-act="close-modal">Отмена</button><button class="btn danger" data-act="del-client-confirm" data-id="${id}">${icon('trash','sm')} В корзину</button></div>`);
}
function delClientConfirm(id){
  const cl=clientById(id); if(!cl) return;
  if(DB.deals.some(d=>d.clientId===id)){ toast('У клиента есть сделки — удаление невозможно','warn'); return; }
  const snap={...cl}; if(Array.isArray(DB.waMessages)) snap._wa=DB.waMessages.filter(m=>m.clientId===id);
  DB.clients=DB.clients.filter(c=>c.id!==id);
  if(Array.isArray(DB.waMessages)) DB.waMessages=DB.waMessages.filter(m=>m.clientId!==id);
  trashPush('client', snap, cl.name, cl.phone);
  saveDB();
  if(apiOn()) persist(API.fetch('clients/'+id, {method:'DELETE'}));
  closeModal(); renderModule(); toast('Клиент перемещён в корзину');
}
function delDealModal(id){
  const d=dealById(id); if(!d) return; const cl=clientById(d.clientId);
  const paid=dealPaid(d);
  const warn = paid>0 ? `<br><span style="color:#fbbf24">Внимание: по сделке есть оплаты на ${money(paid)} — они тоже будут удалены.</span>` : '';
  openModal(`<div class="modal-h">${icon('trash')}<h3>Удалить сделку?</h3><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b"><p style="margin:0;color:var(--muted);line-height:1.55">${cl?escA(cl.name):'—'} · ${stageById(d.stage).name}${d.sum?' · '+money(d.sum):''}.<br>Сделка с конструкциями и оплатами переместится в корзину — можно восстановить.${warn}</p></div>
    <div class="modal-f"><button class="btn" data-act="close-modal">Отмена</button><button class="btn danger" data-act="del-deal-confirm" data-id="${id}">${icon('trash','sm')} В корзину</button></div>`);
}
function delDealConfirm(id){
  const d=dealById(id); if(!d) return; const cl=clientById(d.clientId);
  const snap={...d}; snap._tasks=(DB.tasks||[]).filter(t=>t.dealId===id);
  DB.deals=DB.deals.filter(x=>x.id!==id);
  if(Array.isArray(DB.tasks)) DB.tasks=DB.tasks.filter(t=>t.dealId!==id);
  if(state.measureDealId===id) state.measureDealId=null;
  trashPush('deal', snap, cl?cl.name:'Сделка', stageById(d.stage).name+(d.sum?' · '+money(d.sum):''));
  saveDB();
  if(apiOn()) persist(API.fetch('deals/'+id, {method:'DELETE'}));
  closeModal(); render(); toast('Сделка перемещена в корзину');
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
      <div class="fld"><label>Сумма, сом</label><input id="pay-amt" type="number" min="0" value="${p?p.amount:''}"></div>
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
    <div class="modal-b"><p style="margin:0;color:var(--muted);line-height:1.5">${escA(p.supplier)} · ${money(p.amount)}.<br>Запись переместится в корзину — можно восстановить.</p></div>
    <div class="modal-f"><button class="btn" data-act="close-modal">Отмена</button><button class="btn danger" data-act="del-payable-confirm" data-id="${id}">${icon('trash','sm')} В корзину</button></div>`);
}
function delPayableConfirm(id){
  const p=DB.payables.find(x=>x.id===id);
  DB.payables=DB.payables.filter(x=>x.id!==id);
  if(p) trashPush('payable', {...p}, p.supplier, money(p.amount));
  saveDB(); if(apiOn()) persist(API.persist.deletePayable(id));
  closeModal(); renderModule(); toast('Запись перемещена в корзину');
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
    <div class="modal-b"><p style="margin:0;color:var(--muted)">«${escA(row.name)}». Позиция переместится в корзину — можно восстановить.</p></div>
    <div class="modal-f"><button class="btn" data-act="close-modal">Отмена</button><button class="btn danger" data-act="cat-del-confirm" data-type="${type}" data-id="${id}">${icon('trash','sm')} В корзину</button></div>`);
}
function catDelConfirm(type,id){
  if(!isDirector()) return;
  const cfg=CATALOGS_EDIT[type]; if(!cfg) return; const arr=cfg.arr();
  const i=arr.findIndex(x=>x.id===id); if(i<0) return; const row=arr[i];
  arr.splice(i,1);
  trashPush(type, {...row}, row.name, cfg.title);
  saveDB(); if(apiOn()) persist(API.fetch(cfg.api+'/'+id,{method:'DELETE'}));
  closeModal(); render(); toast('Перемещено в корзину');
}

/* warehouse — приход (пополнение) */
function whReceiveModal(id, kind){
  const it = kind==='mat' ? matById(id) : compById(id);
  if(!it) return;
  const isProfile = kind==='mat'; const barLen = it.barLen||6;
  const qtyLabel = isProfile ? `Количество, хлыстов (по ${barLen} м)` : `Количество, ${escA(it.unit)}`;
  const qtyDefault = isProfile
    ? Math.max(1, Math.ceil((((it.min*2-it.stock)>0?(it.min*2-it.stock):it.min))/barLen))
    : Math.max(it.min, Math.round((it.min*2-it.stock)>0?(it.min*2-it.stock):it.min));
  const hint = isProfile ? `<div class="muted2" style="font-size:11.5px">профиль приходит хлыстами по ${barLen} м · ${qtyDefault} хлыст. = ${qtyDefault*barLen} пог.м</div>` : '';
  const costRow = (isProfile && seesMoney()) ? `<div class="fld"><label>Цена прихода, сом/хлыст</label><input type="number" id="wr-rate" value="${Math.round(matCost(it)*barLen)}"></div>` : '';
  const supRow = it.supplier ? `<div class="fld full"><label>Поставщик</label><input id="wr-sup" value="${escA(it.supplier)}"></div>` : '';
  openModal(`<div class="modal-h">${icon('box')}<div><h3>Приход на склад</h3><div class="mh-sub">${escA(it.name)} · сейчас ${it.stock} ${escA(it.unit)}</div></div><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b"><div class="constr-body" style="padding:0">
      <div class="fld full"><label>${qtyLabel}</label><input type="number" min="1" id="wr-qty" value="${qtyDefault}" autofocus>${hint}</div>
      ${costRow}${supRow}
    </div></div>
    <div class="modal-f"><button class="btn" data-act="close-modal">Отмена</button><button class="btn green" data-act="wh-confirm-receive" data-id="${id}" data-kind="${kind}">${icon('check','sm')} Оприходовать</button></div>`);
}
function whConfirmReceive(id, kind){
  const it = kind==='mat' ? matById(id) : compById(id);
  if(!it) return;
  const isProfile = kind==='mat'; const barLen = it.barLen||6;
  const raw = parseFloat(document.getElementById('wr-qty').value)||0;
  if(raw<=0){ toast('Укажите количество','warn'); return; }
  const supEl=document.getElementById('wr-sup'); const rateEl=document.getElementById('wr-rate');
  let qtyMeters, label, moveReasonExtra='';
  if(isProfile){
    const bars=Math.max(0,Math.round(raw)); if(bars<=0){ toast('Укажите количество хлыстов','warn'); return; }
    qtyMeters = bars*barLen; label = `${bars} хлыст. (${qtyMeters} пог.м)`; moveReasonExtra = ` · ${bars} хлыст.`;
    if(rateEl){ const r=parseFloat(rateEl.value); if(r>0) it.cost=Math.round(r/barLen); } // цена за хлыст → за пог.м
  } else {
    qtyMeters = Math.max(0, Math.round(raw*10)/10); label = `${qtyMeters} ${it.unit}`;
  }
  if(supEl && supEl.value.trim()) it.supplier=supEl.value.trim();
  it.stock = Math.round((it.stock+qtyMeters)*10)/10;
  const reason = ((supEl && supEl.value.trim()) ? 'Поставка — '+supEl.value.trim() : 'Поступление на склад') + moveReasonExtra;
  recordMovement({kind, item:it, dir:'in', type:'receipt', qty:qtyMeters, reason});
  DB.activity.unshift({who:state.user.id,text:`Приход на склад: ${it.name} +${label}`,at:now().toISOString(),kind:'wh'});
  saveDB();
  if(apiOn()){ persist(kind==='mat'?API.persist.saveMaterial(it):API.persist.saveComponent(it)); persist(API.persist.createActivity(DB.activity[0])); }
  closeModal(); render();
  toast(`Оприходовано: ${it.name} +${label} · остаток ${it.stock} пог.м`);
}

/* warehouse — расход / списание (брак, в производство вручную, возврат, корректировка) */
function whWriteoffModal(id, kind){
  const it = kind==='mat' ? matById(id) : compById(id);
  if(!it) return;
  const opts = WRITEOFF_TYPES.map(t=>`<option value="${t}">${MOVE_TYPES[t].label}</option>`).join('');
  openModal(`<div class="modal-h">${icon('minus')}<div><h3>Расход со склада</h3><div class="mh-sub">${escA(it.name)} · остаток ${it.stock} ${escA(it.unit)}</div></div><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b"><div class="constr-body" style="padding:0">
      <div class="fld"><label>Количество, ${escA(it.unit)}</label><input type="number" min="0" step="0.1" max="${it.stock}" id="wo-qty" placeholder="0" autofocus></div>
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
  DB.activity.unshift({who:state.user.id,text:`Расход со склада: ${it.name} −${qty} ${it.unit} (${MOVE_TYPES[type].label})`,at:now().toISOString(),kind:'wh'});
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
      ${money$?`<div class="fld"><label>Закупка, сом/пог.м</label><input id="wi-cost" type="number" min="0" value="${it?matCost(it):''}" placeholder="напр. 1200"></div>
      <div class="fld"><label>Продажа для КП, сом/м²</label><input id="wi-rate" type="number" min="0" value="${it?it.rate:''}" placeholder="напр. 7800"></div>`:''}
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
    if(id){ const m=matById(id); if(!m) return; m.name=name; m.type=type; m.series=series; m.unit=unit; m.min=min; m.supplier=supplier; if(money$){ m.rate=Math.round(num('wi-rate')); m.cost=Math.round(num('wi-cost')); }
      saveDB(); if(apiOn()) persist(API.persist.saveMaterialCard(m)); }
    else { const nm={id:uid('m'),name,type,series,rate:money$?Math.round(num('wi-rate')):0,cost:money$?Math.round(num('wi-cost')):0,stock:num('wi-stock'),min,unit,supplier,barLen:6};
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
    <div class="modal-b"><p style="margin:0;color:var(--muted)">«${escA(it.name)}». Позиция переместится в корзину — можно восстановить.</p></div>
    <div class="modal-f"><button class="btn" data-act="close-modal">Отмена</button><button class="btn danger" data-act="wh-item-del-confirm" data-kind="${kind}" data-id="${id}">${icon('trash','sm')} В корзину</button></div>`);
}
function whItemDelConfirm(kind, id){
  if(!seesMoney()) return;
  if(kind==='mat'){ const it=matById(id); DB.materials=DB.materials.filter(x=>x.id!==id); if(it) trashPush('material', {...it}, it.name, it.series||''); }
  else { const it=compById(id); DB.components=DB.components.filter(x=>x.id!==id); if(it) trashPush('component', {...it}, it.name, it.unit||''); }
  saveDB(); if(apiOn()) persist(kind==='mat'?API.persist.deleteMaterial(id):API.persist.deleteComponent(id));
  closeModal(); renderModule(); toast('Позиция перемещена в корзину');
}

/* measure mutations */
// Сумма сделки = расчёт по позициям. Держим d.sum в синхроне при изменении
// состава (единый источник правды — позиции, а не «момент печати документа»).
function syncDealSum(d){ if(!d) return; d.sum=computeMeasure(d).total; if(apiOn()) persist(API.persist.saveDeal(d)); }
function mAdd(){ const d=currentMeasureDeal(); if(!d) return; d.items=d.items||[];
  const nit={id:uid('cn'),profileId:'m4',w:1300,h:1400,glassId:'g2',openId:'tilt',sashes:2,qty:1,extras:['sill','slopes']};
  d.items.push(nit);
  if(apiOn()){ persist(API.persist.createItem(d.id, nit).then(()=>{ (nit.extras||[]).forEach(ex=>persist(API.persist.setItemExtra(nit.id, ex, true))); })); }
  syncDealSum(d); saveDB();
  renderModule(); }
function mDel(cid){ const d=currentMeasureDeal(); d.items=d.items.filter(c=>c.id!==cid); if(apiOn()) persist(API.persist.deleteItem(cid)); syncDealSum(d); saveDB(); renderModule(); }
function mSet(cid,field,val){ const d=currentMeasureDeal(); const c=d.items.find(x=>x.id===cid); if(!c)return;
  if(field==='extras'){ c.extras=c.extras||[]; const i=c.extras.indexOf(val); if(i>=0)c.extras.splice(i,1); else c.extras.push(val); }
  else c[field]=val;
  if(apiOn()){ if(field==='extras') persist(API.persist.setItemExtra(cid, val, c.extras.includes(val))); else persist(API.persist.saveItem(c)); }
  syncDealSum(d); saveDB();
  renderModule(); }
/* настройка отдельной створки (open/dir/active). i — индекс створки. */
function mSashSet(cid,i,patch){ const d=currentMeasureDeal(); if(!d) return; const c=(d.items||[]).find(x=>x.id===cid); if(!c)return;
  const list=ensureSashList(c); const s=list[i]; if(!s) return;
  Object.assign(s,patch); ensureSashList(c); // ensure пересчитает легаси openId
  if(apiOn()) persist(API.persist.saveItem(c));
  syncDealSum(d); saveDB(); renderModule(); }

/* ============ НАСТРОЙКИ: компания / сотрудники / права (только директор) ============ */
function isDirector(){ return !!(state.user && state.user.role==='director'); }

function editCompanyModal(){
  if(!isDirector()) return;
  const c=DB.company||{};
  const tpl = (c.contractTpl && c.contractTpl.trim()) ? c.contractTpl : DEFAULT_CONTRACT_TPL;
  openModal(`<div class="modal-h">${icon('settings')}<h3>Данные компании</h3><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b"><div class="constr-body" style="padding:0">
      <div class="fld full"><label>Название</label><input id="co-name" value="${escA(c.name)}"></div>
      <div class="fld full"><label>Юридическое лицо</label><input id="co-legal" value="${escA(c.legal)}"></div>
      <div class="fld"><label>Город</label><input id="co-city" value="${escA(c.city)}"></div>
      <div class="fld"><label>Телефон</label><input id="co-phone" value="${escA(c.phone)}"></div>
      <div class="fld full"><label>Производство</label><input id="co-workshop" value="${escA(c.workshop)}"></div>
      <div class="fld full"><label>Оборот за год</label><input id="co-rev" value="${escA(c.revenueYear)}"></div>
    </div>
    <div class="panel-h" style="border:none;padding:14px 0 6px"><h3 style="font-size:13.5px">${icon('doc','sm')} Реквизиты для счетов и договоров</h3></div>
    <div class="constr-body" style="padding:0">
      <div class="fld full"><label>Юридический адрес</label><input id="co-address" value="${escA(c.address||'')}"></div>
      <div class="fld"><label>ИНН</label><input id="co-inn" value="${escA(c.inn||'')}"></div>
      <div class="fld"><label>ОКПО</label><input id="co-okpo" value="${escA(c.okpo||'')}"></div>
      <div class="fld full"><label>Банк</label><input id="co-bank" value="${escA(c.bank||'')}"></div>
      <div class="fld"><label>Расчётный счёт</label><input id="co-account" value="${escA(c.account||'')}"></div>
      <div class="fld"><label>БИК</label><input id="co-bik" value="${escA(c.bik||'')}"></div>
      <div class="fld full"><label>Директор (для подписи, полностью)</label><input id="co-director" value="${escA(c.director||'')}"></div>
      <div class="fld"><label>Директор (кратко, «Фамилия И. О.»)</label><input id="co-director-short" value="${escA(c.directorShort||'')}"></div>
      <div class="fld"><label>Ставка НДС, %</label><input id="co-vat" type="number" min="0" max="30" value="${c.vatRate!=null?c.vatRate:0}"></div>
      <div class="fld full"><label style="display:flex;align-items:center;gap:9px;font-size:13px;color:var(--txt);text-transform:none"><input type="checkbox" id="co-stamp" ${c.stamp?'checked':''} style="width:auto"> Показывать «М.П.» (место печати) в документах</label></div>
    </div>
    <div class="panel-h" style="border:none;padding:14px 0 6px"><h3 style="font-size:13.5px">${icon('doc','sm')} Шаблон договора</h3></div>
    <div class="fld full"><textarea id="co-contract-tpl" rows="11" style="font-family:inherit;line-height:1.5">${escA(tpl)}</textarea></div>
    <div class="muted2" style="font-size:11.5px;line-height:1.6">Текст применяется ко всем новым договорам. Плейсхолдеры подставляются автоматически:
      <code>{company}</code> <code>{director}</code> <code>{client}</code> <code>{address}</code> <code>{total}</code> <code>{totalWords}</code> <code>{vat}</code> <code>{prepayPct}</code> <code>{prepay}</code> <code>{rest}</code> <code>{ready}</code> <code>{install}</code>.
      <b>**жирный**</b> — двойными звёздочками, новый абзац — пустой строкой. Спецификация, реквизиты сторон и подписи добавляются автоматически.
      <button class="btn sm ghost" data-act="contract-tpl-reset" style="margin-top:6px">${icon('refresh','sm')} Вернуть шаблон по умолчанию</button></div>
    </div>
    <div class="modal-f"><button class="btn" data-act="close-modal">Отмена</button><button class="btn primary" data-act="save-company">${icon('check','sm')} Сохранить</button></div>`);
}
function saveCompany(){
  if(!isDirector()) return;
  const v=i=>{ const el=document.getElementById(i); return el?el.value.trim():''; };
  const name=v('co-name'); if(!name){ toast('Укажите название','warn'); return; }
  const c=DB.company;
  c.name=name; c.legal=v('co-legal'); c.city=v('co-city'); c.phone=v('co-phone');
  c.workshop=v('co-workshop'); c.revenueYear=v('co-rev');
  // реквизиты для счетов и договоров
  c.address=v('co-address'); c.inn=v('co-inn'); c.okpo=v('co-okpo'); c.bank=v('co-bank');
  c.account=v('co-account'); c.bik=v('co-bik'); c.director=v('co-director'); c.directorShort=v('co-director-short');
  const vatEl=document.getElementById('co-vat'); c.vatRate=vatEl?Math.max(0,Math.min(30,Math.round(parseFloat(vatEl.value)||0))):0;
  const stampEl=document.getElementById('co-stamp'); c.stamp=!!(stampEl&&stampEl.checked);
  // шаблон договора: если совпал с дефолтным — не храним (чтобы правки дефолта подхватывались)
  const tplEl=document.getElementById('co-contract-tpl'); const tplVal=tplEl?tplEl.value.trim():'';
  c.contractTpl = (tplVal && tplVal!==DEFAULT_CONTRACT_TPL.trim()) ? tplVal : '';
  saveDB(); if(apiOn()) persist(API.persist.saveCompany(c));
  closeModal(); render(); toast('Данные компании сохранены');
}

function userModal(id){
  if(!isDirector()) return;
  const u = id ? userById(id) : null;
  const roleOf = u?u.role:'manager';
  const opts = ROLES.map(r=>`<option value="${r.id}"${r.id===roleOf?' selected':''}>${escA(r.name)}</option>`).join('');
  const apiMode = apiOn();
  // пароль задаётся только при создании; у существующих — отдельная кнопка «Сменить пароль»
  const passField = u
    ? `<div class="fld full"><label>Пароль</label><button class="btn sm" data-act="user-pass" data-id="${u.id}" style="width:fit-content">${icon('lock','sm')} Сменить пароль</button></div>`
    : `<div class="fld full"><label>Пароль ${apiMode?'(мин. 6 символов)':'(в демо не требуется)'}</label><input id="us-pass" type="text" placeholder="okna2026"></div>`;
  openModal(`<div class="modal-h">${icon('user')}<h3>${u?'Сотрудник':'Новый сотрудник'}</h3><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b"><div class="constr-body" style="padding:0">
      <div class="fld full"><label>Имя</label><input id="us-name" value="${u?escA(u.name):''}"></div>
      <div class="fld"><label>Должность</label><input id="us-title" value="${u?escA(u.title):''}" placeholder="напр. Менеджер по продажам"></div>
      <div class="fld"><label>Роль (права доступа)</label><select id="us-role">${opts}</select></div>
      <div class="fld full"><label>Email (логин)</label><input id="us-email" value="${u?escA(u.email||''):''}" placeholder="name@okna.kz"></div>
      ${passField}
    </div></div>
    <div class="modal-f"><button class="btn" data-act="close-modal">Отмена</button><button class="btn primary" data-act="save-user"${u?` data-id="${u.id}"`:''}>${icon('check','sm')} ${u?'Сохранить':'Добавить'}</button></div>`);
}
/* ---- смена пароля сотрудника (директор, либо себе) ---- */
function genPassword(){ const a='abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s=''; for(let i=0;i<8;i++) s+=a[Math.floor(Math.random()*a.length)]; return s; }
function userPassFill(){ const g=genPassword(); const a=document.getElementById('up-pass'), bb=document.getElementById('up-pass2'); if(a)a.value=g; if(bb)bb.value=g; }
function userPassModal(id){
  if(!isDirector()) return; const u=userById(id); if(!u) return;
  const apiMode=apiOn();
  openModal(`<div class="modal-h">${icon('lock')}<div><h3>Сменить пароль</h3><div class="mh-sub">${escA(u.name)} · ${escA(u.title||roleRu(u.role))}</div></div><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b"><div class="constr-body" style="padding:0">
      <div class="fld full"><label>Новый пароль</label><input id="up-pass" type="text" autocomplete="new-password" placeholder="минимум 6 символов"></div>
      <div class="fld full"><label>Повторите пароль</label><input id="up-pass2" type="text" autocomplete="new-password"></div>
      <div class="fld full"><button class="btn sm" data-act="gen-pass" style="width:fit-content">${icon('refresh','sm')} Сгенерировать</button></div>
      ${apiMode?'':`<div class="muted2" style="font-size:11.5px;line-height:1.5;color:#fbbf24">В демо вход выполняется выбором роли — пароль применится в подключённом (серверном) режиме.</div>`}
    </div></div>
    <div class="modal-f"><button class="btn" data-act="close-modal">Отмена</button><button class="btn primary" data-act="user-pass-save" data-id="${id}">${icon('check','sm')} Сохранить пароль</button></div>`);
  const el=document.getElementById('up-pass'); if(el) el.focus();
}
function userPassSave(id){
  if(!isDirector()) return; const u=userById(id); if(!u) return;
  const v=i=>{ const el=document.getElementById(i); return el?el.value.trim():''; };
  const p1=v('up-pass'), p2=v('up-pass2');
  if(p1.length<6){ toast('Пароль минимум 6 символов','warn'); return; }
  if(p1!==p2){ toast('Пароли не совпадают','warn'); return; }
  if(apiOn()){
    persist(API.persist.setUserPassword(id, p1).then(()=>toast(`Пароль обновлён · ${u.name}`)));
  } else {
    u.password=p1; saveDB(); toast('Пароль сохранён (демо)');
  }
  closeModal();
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
  if(role==='director'){ toast('Директор имеет доступ ко всем модулям','warn'); return; }
  MODULE_ROLES[mod]=MODULE_ROLES[mod]||[];
  const i=MODULE_ROLES[mod].indexOf(role);
  const on = i<0;
  if(on) MODULE_ROLES[mod].push(role); else MODULE_ROLES[mod].splice(i,1);
  persistPerms();
  if(apiOn()) persist(API.persist.setModuleRole(mod, role, on));
  renderModule();
}
/* ---- роли: добавление / удаление (только директор) ---- */
function addRoleModal(){
  if(!isDirector()) return;
  openModal(`<div class="modal-h">${icon('shield')}<h3>Новая роль</h3><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b"><div class="constr-body" style="padding:0">
      <div class="fld full"><label>Название роли</label><input id="role-name" placeholder="напр. Монтажник" autocomplete="off"></div>
      <div class="muted2" style="font-size:11.5px;line-height:1.5;margin-top:4px">Роль создаётся без доступа к модулям — откройте нужные в матрице прав ниже.</div>
    </div></div>
    <div class="modal-f"><button class="btn" data-act="close-modal">Отмена</button><button class="btn primary" data-act="create-role">${icon('check','sm')} Создать</button></div>`);
  const el=document.getElementById('role-name'); if(el) el.focus();
}
function createRole(){
  if(!isDirector()) return;
  const el=document.getElementById('role-name'); const name=el?el.value.trim():'';
  if(!name){ toast('Укажите название роли','warn'); return; }
  if(ROLES.some(r=>r.name.toLowerCase()===name.toLowerCase())){ toast('Роль с таким названием уже есть','warn'); return; }
  const r={ id:uid('role'), name, sys:false };
  ROLES.push(r); persistPerms();
  if(apiOn()) persist(API.persist.createRole(r));
  closeModal(); renderModule(); toast('Роль добавлена');
}
function delRoleModal(roleId){
  if(!isDirector()) return; const r=roleById(roleId); if(!r) return;
  if(r.sys){ toast('Базовую роль удалить нельзя','warn'); return; }
  const used=DB.users.filter(u=>u.role===roleId);
  if(used.length){ toast(`Роль назначена сотрудникам (${used.length}) — сначала смените им роль`,'warn'); return; }
  openModal(`<div class="modal-h">${icon('trash')}<h3>Удалить роль?</h3><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b"><p style="margin:0;color:var(--muted);line-height:1.5">Роль «${escA(r.name)}» и её права доступа будут удалены.</p></div>
    <div class="modal-f"><button class="btn" data-act="close-modal">Отмена</button><button class="btn danger" data-act="del-role-confirm" data-id="${roleId}">${icon('trash','sm')} Удалить</button></div>`);
}
function delRoleConfirm(roleId){
  if(!isDirector()) return; const r=roleById(roleId); if(!r||r.sys) return;
  if(DB.users.some(u=>u.role===roleId)){ toast('Роль назначена сотрудникам','warn'); return; }
  Object.keys(MODULE_ROLES).forEach(m=>{ const i=MODULE_ROLES[m].indexOf(roleId);
    if(i>=0){ MODULE_ROLES[m].splice(i,1); if(apiOn()) persist(API.persist.setModuleRole(m, roleId, false)); } });
  ROLES = ROLES.filter(x=>x.id!==roleId); persistPerms();
  if(apiOn()) persist(API.persist.deleteRole(roleId));
  closeModal(); renderModule(); toast('Роль удалена');
}

/* ============ СТАДИИ ВОРОНКИ (добавить / изменить / удалить + цвет) ============ */
function stageEditModal(id){
  if(!isDirector()) return; const s=stageById(id); if(!s) return;
  openModal(`<div class="modal-h">${icon('funnel')}<h3>Изменить стадию</h3><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b"><div class="constr-body" style="padding:0">
      <div class="fld"><label>Название</label><input id="stg-name" value="${escA(s.name)}" autocomplete="off"></div>
      <div class="fld"><label>Цвет</label><input id="stg-color" type="color" value="${s.color}" style="height:42px;padding:4px;cursor:pointer"></div>
    </div></div>
    <div class="modal-f"><button class="btn" data-act="close-modal">Отмена</button><button class="btn primary" data-act="stage-save" data-id="${id}">${icon('check','sm')} Сохранить</button></div>`);
}
function stageAddModal(){
  if(!isDirector()) return;
  openModal(`<div class="modal-h">${icon('funnel')}<h3>Новая стадия</h3><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b"><div class="constr-body" style="padding:0">
      <div class="fld"><label>Название</label><input id="stg-name" placeholder="напр. Согласование" autocomplete="off"></div>
      <div class="fld"><label>Цвет</label><input id="stg-color" type="color" value="#2563eb" style="height:42px;padding:4px;cursor:pointer"></div>
    </div></div>
    <div class="modal-f"><button class="btn" data-act="close-modal">Отмена</button><button class="btn primary" data-act="stage-save">${icon('check','sm')} Добавить</button></div>`);
  const el=document.getElementById('stg-name'); if(el) el.focus();
}
function stageSave(id){
  if(!isDirector()) return;
  const v=i=>{const el=document.getElementById(i);return el?el.value.trim():'';};
  const name=v('stg-name'); const color=v('stg-color')||'#2563eb';
  if(!name){ toast('Укажите название','warn'); return; }
  if(id){ const s=stageById(id); if(!s) return; s.name=name; s.color=color;
    if(apiOn()) persist(API.fetch('deal_stages/'+id,{method:'PUT',body:{name,color}})); }
  else {
    const ns={id:uid('st'), name, color, sort:STAGES.length};
    const doneIdx=STAGES.findIndex(s=>s.id==='done');
    if(doneIdx>=0) STAGES.splice(doneIdx,0,ns); else STAGES.push(ns);
    STAGES.forEach((s,i)=>s.sort=i);
    if(apiOn()) persist(API.fetch('deal_stages',{method:'POST',body:{id:ns.id,name,color,sort:ns.sort}}));
  }
  saveStages(); closeModal(); render(); toast(id?'Стадия изменена':'Стадия добавлена');
}
function stageDelModal(id){
  if(!isDirector()) return; const s=stageById(id); if(!s) return;
  if(SYSTEM_STAGE_IDS.includes(id)){ toast('Системную стадию (замер/производство/монтаж/выполнено) удалить нельзя — на ней завязаны разделы. Можно переименовать и сменить цвет','warn'); return; }
  if(STAGES.length<=1){ toast('Должна остаться хотя бы одна стадия','warn'); return; }
  const dealsIn=DB.deals.filter(d=>d.stage===id);
  const others=STAGES.filter(x=>x.id!==id);
  const moveSel = dealsIn.length
    ? `<div class="fld full" style="margin-top:10px"><label>Перенести сделки (${dealsIn.length}) в стадию</label><select id="stg-move">${others.map(o=>`<option value="${o.id}">${escA(o.name)}</option>`).join('')}</select></div>`
    : `<p class="muted2" style="margin:8px 0 0;font-size:12.5px">В этой стадии нет сделок.</p>`;
  openModal(`<div class="modal-h">${icon('trash')}<h3>Удалить стадию?</h3><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b"><p style="margin:0;color:var(--muted);line-height:1.5">Стадия «${escA(s.name)}» будет удалена.</p>${moveSel}</div>
    <div class="modal-f"><button class="btn" data-act="close-modal">Отмена</button><button class="btn danger" data-act="stage-del-confirm" data-id="${id}">${icon('trash','sm')} Удалить</button></div>`);
}
function stageDelConfirm(id){
  if(!isDirector()) return; const s=stageById(id); if(!s) return;
  if(SYSTEM_STAGE_IDS.includes(id)){ toast('Системную стадию удалить нельзя','warn'); return; }
  if(STAGES.length<=1){ toast('Должна остаться хотя бы одна стадия','warn'); return; }
  const dealsIn=DB.deals.filter(d=>d.stage===id);
  if(dealsIn.length){ const sel=document.getElementById('stg-move'); const target=sel?sel.value:null;
    if(!target){ toast('Выберите стадию для переноса','warn'); return; }
    dealsIn.forEach(d=>{ d.stage=target; d.stageSince=now().toISOString(); }); }
  const i=STAGES.findIndex(x=>x.id===id); if(i>=0) STAGES.splice(i,1);
  STAGES.forEach((s2,ix)=>s2.sort=ix);
  if(state.funnelStage===id) state.funnelStage='all';
  saveStages(); saveDB();
  if(apiOn()){
    Promise.all(dealsIn.map(d=>API.persist.saveDeal(d)))
      .then(()=>API.fetch('deal_stages/'+id,{method:'DELETE'}))
      .catch(e=>toast('Сервер: '+((e&&e.message)||''),'warn'));
  }
  closeModal(); render(); toast('Стадия удалена');
}

function stageMove(id, dir){
  if(!isDirector()) return;
  const i=STAGES.findIndex(s=>s.id===id); if(i<0) return;
  const j = dir==='left' ? i-1 : i+1; if(j<0 || j>=STAGES.length) return;
  const t=STAGES[i]; STAGES[i]=STAGES[j]; STAGES[j]=t;
  STAGES.forEach((s,ix)=>s.sort=ix);
  saveStages();
  if(apiOn()){ persist(API.fetch('deal_stages/'+STAGES[i].id,{method:'PUT',body:{sort:STAGES[i].sort}})); persist(API.fetch('deal_stages/'+STAGES[j].id,{method:'PUT',body:{sort:STAGES[j].sort}})); }
  renderModule();
}

/* ============ ЭТАПЫ ЦЕХА (производство): добавить / изменить / удалить + цвет ============ */
function prodStageMove(id, dir){
  if(!isDirector()) return;
  const i=PROD_STAGES.findIndex(s=>s.id===id); if(i<0) return;
  const j = dir==='left' ? i-1 : i+1; if(j<0 || j>=PROD_STAGES.length) return;
  const t=PROD_STAGES[i]; PROD_STAGES[i]=PROD_STAGES[j]; PROD_STAGES[j]=t;
  PROD_STAGES.forEach((s,ix)=>s.sort=ix);
  saveProdStages();
  if(apiOn()){ persist(API.fetch('prod_stages/'+PROD_STAGES[i].id,{method:'PUT',body:{sort:PROD_STAGES[i].sort}})); persist(API.fetch('prod_stages/'+PROD_STAGES[j].id,{method:'PUT',body:{sort:PROD_STAGES[j].sort}})); }
  renderModule();
}
function prodStageEditModal(id){
  if(!isDirector()) return; const s=prodStageById(id); if(!s) return;
  openModal(`<div class="modal-h">${icon('production')}<h3>Изменить этап цеха</h3><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b"><div class="constr-body" style="padding:0">
      <div class="fld"><label>Название</label><input id="ps-name" value="${escA(s.name)}" autocomplete="off"></div>
      <div class="fld"><label>Цвет</label><input id="ps-color" type="color" value="${s.color||'#64748b'}" style="height:42px;padding:4px;cursor:pointer"></div>
    </div></div>
    <div class="modal-f"><button class="btn" data-act="close-modal">Отмена</button><button class="btn primary" data-act="prod-stage-save" data-id="${id}">${icon('check','sm')} Сохранить</button></div>`);
}
function prodStageAddModal(){
  if(!isDirector()) return;
  openModal(`<div class="modal-h">${icon('production')}<h3>Новый этап цеха</h3><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b"><div class="constr-body" style="padding:0">
      <div class="fld"><label>Название</label><input id="ps-name" placeholder="напр. Упаковка" autocomplete="off"></div>
      <div class="fld"><label>Цвет</label><input id="ps-color" type="color" value="#2563eb" style="height:42px;padding:4px;cursor:pointer"></div>
    </div></div>
    <div class="modal-f"><button class="btn" data-act="close-modal">Отмена</button><button class="btn primary" data-act="prod-stage-save">${icon('check','sm')} Добавить</button></div>`);
  const el=document.getElementById('ps-name'); if(el) el.focus();
}
function prodStageSave(id){
  if(!isDirector()) return;
  const v=i=>{const el=document.getElementById(i);return el?el.value.trim():'';};
  const name=v('ps-name'); const color=v('ps-color')||'#2563eb';
  if(!name){ toast('Укажите название','warn'); return; }
  if(id){ const s=prodStageById(id); if(!s) return; s.name=name; s.color=color;
    if(apiOn()) persist(API.fetch('prod_stages/'+id,{method:'PUT',body:{name,color}})); }
  else {
    const ns={id:uid('ps'), name, color, sort:PROD_STAGES.length};
    const instIdx=PROD_STAGES.findIndex(s=>s.id==='installing');
    if(instIdx>=0) PROD_STAGES.splice(instIdx,0,ns); else PROD_STAGES.push(ns);
    PROD_STAGES.forEach((s,i)=>s.sort=i);
    if(apiOn()) persist(API.fetch('prod_stages',{method:'POST',body:{id:ns.id,name,color,sort:ns.sort}}));
  }
  saveProdStages(); closeModal(); render(); toast(id?'Этап изменён':'Этап добавлен');
}
function prodStageDelModal(id){
  if(!isDirector()) return; const s=prodStageById(id); if(!s) return;
  if(SYSTEM_PROD_IDS.includes(id)){ toast('Системный этап (очередь/резка/стеклопакет/сборка/монтаж) удалить нельзя — на нём завязано списание материалов и переход на монтаж. Можно переименовать и сменить цвет','warn'); return; }
  if(PROD_STAGES.length<=1){ toast('Должен остаться хотя бы один этап','warn'); return; }
  const dealsIn=DB.deals.filter(d=>['production','install'].includes(d.stage) && (d.prodStage||'queue')===id);
  const others=PROD_STAGES.filter(x=>x.id!==id);
  const moveSel = dealsIn.length
    ? `<div class="fld full" style="margin-top:10px"><label>Перенести заказы (${dealsIn.length}) на этап</label><select id="ps-move">${others.map(o=>`<option value="${o.id}">${escA(o.name)}</option>`).join('')}</select></div>`
    : `<p class="muted2" style="margin:8px 0 0;font-size:12.5px">На этом этапе нет заказов.</p>`;
  openModal(`<div class="modal-h">${icon('trash')}<h3>Удалить этап?</h3><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b"><p style="margin:0;color:var(--muted);line-height:1.5">Этап «${escA(s.name)}» будет удалён.</p>${moveSel}</div>
    <div class="modal-f"><button class="btn" data-act="close-modal">Отмена</button><button class="btn danger" data-act="prod-stage-del-confirm" data-id="${id}">${icon('trash','sm')} Удалить</button></div>`);
}
function prodStageDelConfirm(id){
  if(!isDirector()) return; const s=prodStageById(id); if(!s) return;
  if(SYSTEM_PROD_IDS.includes(id)){ toast('Системный этап удалить нельзя','warn'); return; }
  if(PROD_STAGES.length<=1){ toast('Должен остаться хотя бы один этап','warn'); return; }
  const dealsIn=DB.deals.filter(d=>['production','install'].includes(d.stage) && (d.prodStage||'queue')===id);
  if(dealsIn.length){ const sel=document.getElementById('ps-move'); const target=sel?sel.value:null;
    if(!target){ toast('Выберите этап для переноса','warn'); return; }
    dealsIn.forEach(d=>{ d.prodStage=target; }); }
  const i=PROD_STAGES.findIndex(x=>x.id===id); if(i>=0) PROD_STAGES.splice(i,1);
  PROD_STAGES.forEach((s2,ix)=>s2.sort=ix);
  saveProdStages(); saveDB();
  if(apiOn()){
    Promise.all(dealsIn.map(d=>API.persist.saveDeal(d)))
      .then(()=>API.fetch('prod_stages/'+id,{method:'DELETE'}))
      .catch(e=>toast('Сервер: '+((e&&e.message)||''),'warn'));
  }
  closeModal(); render(); toast('Этап удалён');
}

/* ============ WHATSAPP (Green API) ============ */
function waPreset(cl, d){
  const tpls=waTemplatesFor(d);
  if(tpls.length) return renderWaTpl(tpls[0].text, cl, d);
  return renderWaTpl('Здравствуйте, {client}! Это {company}.', cl, d);
}
function waSendModal(clientId, dealId){
  const d = dealId ? dealById(dealId) : null;
  const cl = clientId ? clientById(clientId) : (d ? clientById(d.clientId) : null);
  if(!cl){ toast('Клиент не найден','warn'); return; }
  const tpls = waTemplatesFor(d).map(t=>({label:t.label, text:renderWaTpl(t.text, cl, d)}));
  const preset = tpls.length ? tpls[0].text : waPreset(cl, d);
  const tplChips = tpls.length ? `<div class="fld full" style="margin-bottom:10px"><label>Быстрое сообщение — выберите шаблон</label>
      <div class="chips" style="flex-wrap:wrap">${tpls.map((t,i)=>`<button type="button" class="chip ${i===0?'on':''}" data-act="wa-tpl-pick" data-text="${escA(t.text)}">${escA(t.label)}</button>`).join('')}</div></div>` : '';
  let notice='';
  if(!apiOn()){
    notice = `<div class="muted2" style="font-size:11.5px;margin-top:10px;line-height:1.5;color:#fbbf24">Демо-режим: реальная отправка доступна после входа по логину и подключения Green API в Настройках.</div>`;
  } else if(!(waConfig && waConfig.enabled && waConfig.configured)){
    notice = `<div class="muted2" style="font-size:11.5px;margin-top:10px;line-height:1.5;color:#fbbf24">WhatsApp не подключён. Директор может подключить инстанс в Настройки → WhatsApp · Green API.</div>`;
  }
  openModal(`<div class="modal-h">${icon('wa')}<div><h3>Сообщение в WhatsApp</h3><div class="mh-sub">${escA(cl.name)} · ${escA(cl.phone)}</div></div><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b">
      ${tplChips}
      <div class="fld full"><label>Текст сообщения</label><textarea id="wa-msg" rows="5" style="background:var(--bg2);border:1px solid var(--line);border-radius:9px;padding:10px;color:var(--txt);font-family:inherit;font-size:13.5px;resize:vertical">${escA(preset)}</textarea></div>
      ${notice}
    </div>
    <div class="modal-f"><button class="btn" data-act="close-modal">Отмена</button>
      <button class="btn green" data-act="wa-send" data-id="${clientId||''}" data-deal="${dealId||''}">${icon('send','sm')} Отправить</button></div>`);
}
/* ---- управление шаблонами быстрых сообщений (директор) ---- */
function waTplModal(id){
  if(!isDirector()) return;
  const t = id ? WA_TEMPLATES.find(x=>x.id===id) : null;
  const stageOpts = [`<option value="any"${(!t||t.stage==='any')?' selected':''}>Любой этап</option>`]
    .concat(STAGES.map(s=>`<option value="${s.id}"${t&&t.stage===s.id?' selected':''}>${escA(s.name)}</option>`)).join('');
  const taSt='background:var(--bg2);border:1px solid var(--line);border-radius:9px;padding:10px;color:var(--txt);font-family:inherit;font-size:13.5px;resize:vertical;width:100%';
  openModal(`<div class="modal-h">${icon('wa')}<h3>${t?'Изменить шаблон':'Новый шаблон'}</h3><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b"><div class="constr-body" style="padding:0">
      <div class="fld"><label>Этап</label><select id="wt-stage">${stageOpts}</select></div>
      <div class="fld"><label>Название</label><input id="wt-label" value="${t?escA(t.label):''}" placeholder="напр. Запись на замер"></div>
      <div class="fld full"><label>Текст сообщения</label><textarea id="wt-text" rows="4" style="${taSt}">${t?escA(t.text):''}</textarea></div>
      <div class="fld full"><div class="muted2" style="font-size:11px;line-height:1.7">Подстановки: ${WA_TPL_VARS.map(v=>`<code style="background:var(--bg2);padding:1px 5px;border-radius:4px">${v}</code>`).join(' ')}</div></div>
    </div></div>
    <div class="modal-f"><button class="btn" data-act="close-modal">Отмена</button><button class="btn primary" data-act="wa-tpl-save"${t?` data-id="${t.id}"`:''}>${icon('check','sm')} Сохранить</button></div>`);
}
function waTplSave(id){
  if(!isDirector()) return;
  const v=i=>{const el=document.getElementById(i);return el?el.value.trim():'';};
  const stage=v('wt-stage')||'any'; const label=v('wt-label'); const text=v('wt-text');
  if(!label){ toast('Укажите название','warn'); return; }
  if(!text){ toast('Введите текст сообщения','warn'); return; }
  if(id){ const t=WA_TEMPLATES.find(x=>x.id===id); if(!t) return; t.stage=stage; t.label=label; t.text=text; }
  else { WA_TEMPLATES.push({id:uid('wt'), stage, label, text}); }
  saveWaTemplates(); closeModal(); renderModule(); toast(id?'Шаблон сохранён':'Шаблон добавлен');
}
function waTplDelModal(id){
  if(!isDirector()) return; const t=WA_TEMPLATES.find(x=>x.id===id); if(!t) return;
  openModal(`<div class="modal-h">${icon('trash')}<h3>Удалить шаблон?</h3><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b"><p style="margin:0;color:var(--muted);line-height:1.5">«${escA(t.label)}». Можно вернуть стандартные шаблоны кнопкой сброса.</p></div>
    <div class="modal-f"><button class="btn" data-act="close-modal">Отмена</button><button class="btn danger" data-act="wa-tpl-del-confirm" data-id="${id}">${icon('trash','sm')} Удалить</button></div>`);
}
function waTplDelConfirm(id){ if(!isDirector()) return; WA_TEMPLATES=WA_TEMPLATES.filter(x=>x.id!==id); saveWaTemplates(); closeModal(); renderModule(); toast('Шаблон удалён'); }
function waTplReset(){ if(!isDirector()) return; WA_TEMPLATES=defaultWaTemplates(); saveWaTemplates(); renderModule(); toast('Шаблоны сброшены к стандартным'); }
function logWaActivity(cl){
  if(!cl) return;
  DB.activity.unshift({who:(state.user&&state.user.id)||null, text:`Отправлено сообщение в WhatsApp — ${cl.name}`, at:now().toISOString(), kind:'lead'});
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
  openModal(`<div class="modal-h">${icon('wa')}<div><h3>WhatsApp · ${escA(cl.name)}</h3><div class="mh-sub">${escA(cl.phone)}</div></div><button class="x" data-act="close-modal">${icon('x')}</button></div>
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
    return `<div class="stat-line"><span>${escA(mt?mt.type:'')} ${c.w}×${c.h}${(c.qty||1)>1?' ·'+c.qty+'шт':''}</span><span class="muted">${escA(constrOpenLabel(c))}</span></div>`; }).join('')
    || '<div class="muted2" style="font-size:12px">Конструкции не добавлены</div>';
  const moneyBlock = money$ ? `
      <div class="stat-line"><span>Сумма заказа</span><span style="font-weight:700">${money(sum)}</span></div>
      <div class="stat-line"><span>Оплачено</span><span style="color:#4ade80;font-weight:700">${money(paid)}</span></div>
      <div class="stat-line"><span>Остаток</span><span style="color:${debt>0?'#fbbf24':'#4ade80'};font-weight:700">${money(debt)}</span></div>` : '';
  const info = `
    <div class="wa-deal-info">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <span class="av" style="width:40px;height:40px;border-radius:10px;display:grid;place-items:center;background:${colorFor(cl.id)};color:#fff;font-weight:700">${initials(cl.name)}</span>
        <div><div style="font-weight:700">${escA(cl.name)} ${d.hot?icon('flame','sm'):''}</div><div class="muted2" style="font-size:11.5px">${escA(cl.phone)}</div></div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
        <span class="tag">${icon('layers','sm')} ${escA(d.source)}</span>
        <span class="tag">${icon('user','sm')} ${(userById(d.manager)||{}).name||'—'}</span>
      </div>
      <div class="stat-line"><span>${icon('pin','sm')} Адрес</span><span class="muted" style="text-align:right;max-width:60%">${escA(cl.address)}</span></div>
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
  const stageBar = STAGES.map(s=>`<button class="chip ${s.id===d.stage?'on':''}" data-act="wa-move-stage" data-id="${d.id}" data-stage="${s.id}">${escA(s.name)}</button>`).join('');
  openModal(`<div class="modal-h">${icon('wa')}<div><h3>Сделка и чат · ${escA(cl.name)}</h3><div class="mh-sub">${escA(cl.phone)} · ${escA(st.name)}</div></div><button class="x" data-act="close-modal">${icon('x')}</button></div>
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
function igSaveConfig(){
  if(!isDirector()){ return; }
  const username=((document.getElementById('ig-user')||{}).value||'').trim();
  const token=((document.getElementById('ig-token')||{}).value||'').trim();
  const enabled=!!(document.getElementById('ig-enabled')||{}).checked;
  if(!apiOn()){ toast('Подключение доступно только в серверном режиме (вход по логину)','warn'); return; }
  API.ig.saveConfig({username, token, enabled}).then(c=>{ igConfig=c; render(); toast('Настройки Instagram сохранены'); })
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
/* ====== РЕЗЕРВНАЯ КОПИЯ (экспорт/импорт всех локальных данных) ====== */
let __backupObj=null;
function collectBackup(){
  return { app:'okna-crm', version:1, exportedAt:new Date().toISOString(),
    db:DB, stages:STAGES, prodStages:PROD_STAGES, waTemplates:WA_TEMPLATES, notifRead:[...notifRead] };
}
function exportBackup(){
  if(!isDirector()) return;
  const json=JSON.stringify(collectBackup(), null, 2);
  const blob=new Blob([json],{type:'application/json'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a');
  a.href=url; a.download=`okna-crm_backup_${expStamp()}.json`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
  toast('Резервная копия выгружена');
}
function importBackupModal(){
  if(!isDirector()) return; __backupObj=null;
  openModal(`<div class="modal-h">${icon('refresh')}<h3>Восстановить из резервной копии</h3><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b">
      <div class="muted2" style="font-size:12px;line-height:1.5;margin-bottom:12px">Загрузите JSON-файл резервной копии (кнопка «Экспорт всех данных»). <b style="color:#fbbf24">Текущие данные будут заменены.</b> В подключённом (серверном) режиме это восстанавливает локальные данные браузера.</div>
      <input type="file" id="bk-file" accept=".json,application/json" style="margin-bottom:12px;width:100%">
      <div id="bk-preview" class="muted2" style="font-size:12px">Файл не выбран</div>
    </div>
    <div class="modal-f"><button class="btn" data-act="close-modal">Отмена</button><button class="btn danger" id="bk-run" data-act="backup-restore" disabled>${icon('refresh','sm')} Восстановить</button></div>`);
  const f=document.getElementById('bk-file');
  if(f) f.addEventListener('change', e=>{ const file=e.target.files&&e.target.files[0]; if(!file) return;
    const rd=new FileReader();
    rd.onload=()=>{ try{ const o=JSON.parse(String(rd.result)); __backupObj=(o&&o.db)?o:null; }catch(err){ __backupObj=null; }
      const box=document.getElementById('bk-preview'); const btn=document.getElementById('bk-run');
      if(!__backupObj){ if(box) box.innerHTML='Файл не похож на резервную копию.'; if(btn) btn.disabled=true; return; }
      const d=__backupObj.db||{};
      if(box) box.innerHTML=`<div>Копия от <b>${__backupObj.exportedAt?dateFull(__backupObj.exportedAt):'—'}</b></div>
        <div style="margin-top:6px">Сделок: <b>${(d.deals||[]).length}</b> · Клиентов: <b>${(d.clients||[]).length}</b> · Профиль: <b>${(d.materials||[]).length}</b> · Комплектующих: <b>${(d.components||[]).length}</b> · Движений: <b>${(d.movements||[]).length}</b></div>`;
      if(btn) btn.disabled=false; };
    rd.onerror=()=>{ __backupObj=null; const box=document.getElementById('bk-preview'); if(box) box.innerHTML='Не удалось прочитать файл.'; };
    rd.readAsText(file,'utf-8'); });
}
function backupRestore(){
  if(!isDirector() || !__backupObj || !__backupObj.db) return;
  try{
    localStorage.setItem(DB_KEY, JSON.stringify(__backupObj.db));
    if(__backupObj.stages) localStorage.setItem(STAGES_KEY, JSON.stringify(__backupObj.stages));
    if(__backupObj.prodStages) localStorage.setItem(PROD_STAGES_KEY, JSON.stringify(__backupObj.prodStages));
    if(__backupObj.waTemplates) localStorage.setItem(WA_TPL_KEY, JSON.stringify(__backupObj.waTemplates));
    if(__backupObj.notifRead) localStorage.setItem(NOTIF_READ_KEY, JSON.stringify(__backupObj.notifRead));
    toast('Данные восстановлены — перезагрузка…');
    setTimeout(()=>location.reload(), 700);
  }catch(e){ toast('Ошибка восстановления: '+((e&&e.message)||''),'warn'); }
}
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
      // экспорт учитывает активные фильтры журнала (тип + период/диапазон дат)
      const ft=state.whMoveType||'all', fp=state.whMovePeriod||'all';
      let lo=-Infinity, hi=Infinity;
      if(fp==='date'){ if(state.whMoveFrom) lo=new Date(state.whMoveFrom+'T00:00:00').getTime(); if(state.whMoveTo) hi=new Date(state.whMoveTo+'T23:59:59').getTime(); }
      else if(fp!=='all'){ lo=SEED_NOW.getTime()-parseInt(fp,10)*86400000; }
      const byType=m=> ft==='all'?true:(ft==='out'?moveType(m.type).dir==='out':m.type===ft);
      const byPeriod=m=>{ const t=new Date(m.at).getTime(); return t>=lo&&t<=hi; };
      const rows=[['Дата','Позиция','Операция','Направление','Количество','Ед.','Причина','Сотрудник']];
      (DB.movements||[]).filter(m=>byType(m)&&byPeriod(m)).slice().sort((a,b)=>String(b.at||'').localeCompare(String(a.at||''))).forEach(m=>{
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
// подсветить и прокрутить элемент к центру (после перерисовки)
function flashEl(sel){
  requestAnimationFrame(()=>setTimeout(()=>{
    const el=document.querySelector(sel); if(!el) return;
    try{ el.scrollIntoView({behavior:'smooth', block:'center', inline:'center'}); }catch(e){ el.scrollIntoView(); }
    el.classList.add('flash'); setTimeout(()=>el.classList.remove('flash'), 1900);
  }, 70));
}
// из поиска: открыть Воронку, прокрутить к нужной стадии/карточке и открыть сделку
function searchOpenDeal(id){
  const d=dealById(id); if(!d){ openDeal(id); return; }
  clearSearch();
  if(!canSee('funnel')){ openDeal(id); return; }
  state.module='funnel'; state.sideOpen=false;
  state.funnelMgr='all'; state.funnelStage='all'; state.funnelSrc='all'; // снять фильтры, чтобы карточка была видна
  render();
  flashEl(`.kcard[data-card="${id}"]`);
  openDeal(id);
}
// из поиска: открыть Клиентов, прокрутить к строке клиента и открыть карточку
function searchOpenClient(id){
  const cl=clientById(id); if(!cl){ openClient(id); return; }
  clearSearch();
  if(!canSee('clients')){ openClient(id); return; }
  state.module='clients'; state.sideOpen=false;
  state.clientType='all'; state.clientDebt='all'; state.clientSearch=''; // снять фильтры, чтобы строка была видна
  render();
  flashEl(`tr[data-act="open-client"][data-id="${id}"]`);
  openClient(id);
}
// из поиска: сделка на замере → раздел «Замер и КП» с выбранной заявкой
function searchOpenMeasureDeal(id){
  const d=dealById(id); if(!d){ openDeal(id); return; }
  clearSearch();
  if(canSee('funnel')) return searchOpenDeal(id);
  if(!canSee('measure')){ openDeal(id); return; }
  state.measureDealId=id; state.module='measure'; state.sideOpen=false;
  render();
  flashEl(`[data-act="m-pick"][data-id="${id}"]`);
}
// из поиска: сделка в цеху → раздел «Производство», прокрутка к карточке + модалка
function searchOpenProdDeal(id){
  const d=dealById(id); if(!d){ openDeal(id); return; }
  clearSearch();
  if(canSee('funnel')) return searchOpenDeal(id);
  if(!canSee('production')){ openDeal(id); return; }
  state.module='production'; state.sideOpen=false;
  render();
  flashEl(`.kcard[data-pcard="${id}"]`);
  if(typeof openProd==='function') openProd(id);
}
// из задач/уведомлений: открыть раздел сделки по правам роли + карточку с прокруткой
function gotoDeal(id){
  const d=dealById(id); if(!d){ openDeal(id); return; }
  if(canSee('funnel')) return searchOpenDeal(id);
  if(d.stage==='measure' && canSee('measure')) return searchOpenMeasureDeal(id);
  if(['production','install'].includes(d.stage) && canSee('production')) return searchOpenProdDeal(id);
  if(canSee('production')) return searchOpenProdDeal(id);
  if(canSee('measure')) return searchOpenMeasureDeal(id);
  openDeal(id);
}
// из поиска: позиция склада → раздел «Склад», нужная вкладка, прокрутка к строке
function searchOpenWhItem(id, kind){
  clearSearch();
  if(!canSee('warehouse')) return;
  state.module='warehouse'; state.sideOpen=false;
  state.whTab = kind==='mat' ? 'profile' : 'comp';
  render();
  flashEl(`tr[data-wh-row="${id}"]`);
}
function globalSearch(q){
  const dd=document.getElementById('search-dd'); if(!dd) return;
  q=(q||'').trim().toLowerCase();
  if(q.length<2){ dd.classList.remove('open'); dd.innerHTML=''; return; }
  const has=s=>(s||'').toLowerCase().includes(q);
  const dealMatch=d=>{ const cl=clientById(d.clientId); return has(cl&&cl.name)||has(d.note); };
  const dealItem=(d,act)=>{ const cl=clientById(d.clientId); const st=stageById(d.stage);
    return `<button class="sd-item" data-act="${act}" data-id="${d.id}"><span class="dot-i" style="background:${st.color}"></span><span class="sd-main">${cl?cl.name:'—'}</span><span class="sd-sub">${escA(st.name)}${d.sum&&seesMoney()?' · '+moneyK(d.sum):''}</span></button>`; };
  let html='';
  // поиск показывает только то, к чему у роли есть доступ
  if(canSee('clients')){
    const cls=DB.clients.filter(c=>has(c.name)||has(c.phone)||has(c.address)).slice(0,5);
    if(cls.length) html+=`<div class="sd-group">Клиенты</div>`+cls.map(c=>
      `<button class="sd-item" data-act="search-open-client" data-id="${c.id}">${avatarXs(c.name,c.id)}<span class="sd-main">${escA(c.name)}</span><span class="sd-sub">${c.phone}</span></button>`).join('');
  }
  if(canSee('funnel')){
    const dls=DB.deals.filter(dealMatch).slice(0,6);
    if(dls.length) html+=`<div class="sd-group">Сделки</div>`+dls.map(d=>dealItem(d,'search-open-deal')).join('');
  } else {
    if(canSee('measure')){
      const dls=DB.deals.filter(d=>d.stage==='measure'&&dealMatch(d)).slice(0,6);
      if(dls.length) html+=`<div class="sd-group">Замер</div>`+dls.map(d=>dealItem(d,'search-open-measure')).join('');
    }
    if(canSee('production')){
      const dls=DB.deals.filter(d=>['production','install'].includes(d.stage)&&dealMatch(d)).slice(0,6);
      if(dls.length) html+=`<div class="sd-group">Производство</div>`+dls.map(d=>dealItem(d,'search-open-prod')).join('');
    }
  }
  if(canSee('warehouse')){
    const mats=DB.materials.filter(m=>has(m.name)||has(m.supplier)||has(m.series)).slice(0,4);
    const comps=DB.components.filter(c=>has(c.name)).slice(0,4);
    if(mats.length||comps.length){
      html+=`<div class="sd-group">Склад</div>`
        + mats.map(m=>`<button class="sd-item" data-act="search-open-wh" data-id="${m.id}" data-kind="mat">${icon('box','sm')}<span class="sd-main">${escA(m.name)}</span><span class="sd-sub">профиль · ${m.stock} ${escA(m.unit)}</span></button>`).join('')
        + comps.map(c=>`<button class="sd-item" data-act="search-open-wh" data-id="${c.id}" data-kind="comp">${icon('box','sm')}<span class="sd-main">${escA(c.name)}</span><span class="sd-sub">остаток · ${c.stock} ${escA(c.unit)}</span></button>`).join('');
    }
  }
  if(!html) html=`<div class="sd-empty">Ничего не найдено</div>`;
  dd.innerHTML=html; dd.classList.add('open');
}

/* ============ EVENT DELEGATION ============ */
document.addEventListener('click', e=>{
  const t=e.target.closest('[data-act]'); if(!t) return;
  const a=t.dataset.act, id=t.dataset.id;
  // клик по уведомлению — пометить прочитанным (badge учитывает только непрочитанные)
  if(t.dataset.nid){ notifRead.add(t.dataset.nid); saveNotifRead(); }
  // под-действие из карточки (изменить / сообщение / чат / оплата) — вернуться к ней после закрытия
  if(t.dataset.back==='deal') __cardReturn=()=>openDeal(id);
  else if(t.dataset.back==='client') __cardReturn=()=>openClient(id);
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
    case 'search-mobile': { const s=document.querySelector('.topbar .search'); if(s){ const open=s.classList.toggle('open'); if(open){ const i=document.getElementById('global-search'); if(i) i.focus(); } else { clearSearch(); } } } break;
    case 'notif': notifModal(); break;
    case 'notif-read-all': buildNotifs().forEach(n=>notifRead.add(n.id)); saveNotifRead(); render(); notifModal(); break;
    case 'edit-company': editCompanyModal(); break;
    case 'save-company': saveCompany(); break;
    case 'contract-tpl-reset': { const el=document.getElementById('co-contract-tpl'); if(el){ el.value=DEFAULT_CONTRACT_TPL; toast('Шаблон сброшен — не забудьте сохранить'); } } break;
    case 'add-user': userModal(null); break;
    case 'edit-user': userModal(id); break;
    case 'save-user': saveUser(t.dataset.id||null); break;
    case 'del-user': delUserModal(id); break;
    case 'del-user-confirm': delUserConfirm(id); break;
    case 'user-pass': userPassModal(id); break;
    case 'user-pass-save': userPassSave(id); break;
    case 'gen-pass': userPassFill(); break;
    case 'perm-toggle': togglePerm(t.dataset.mod, t.dataset.role); break;
    case 'wa-tpl-pick': { const ta=document.getElementById('wa-msg'); if(ta) ta.value=t.dataset.text;
      document.querySelectorAll('[data-act="wa-tpl-pick"]').forEach(b=>b.classList.remove('on')); t.classList.add('on'); } break;
    case 'wa-tpl-add': waTplModal(null); break;
    case 'wa-tpl-edit': waTplModal(id); break;
    case 'wa-tpl-save': waTplSave(t.dataset.id||null); break;
    case 'wa-tpl-del': waTplDelModal(id); break;
    case 'wa-tpl-del-confirm': waTplDelConfirm(id); break;
    case 'wa-tpl-reset': waTplReset(); break;
    case 'add-role': addRoleModal(); break;
    case 'create-role': createRole(); break;
    case 'del-role': delRoleModal(t.dataset.id); break;
    case 'del-role-confirm': delRoleConfirm(id); break;
    case 'theme': state.theme = state.theme==='light' ? 'dark' : 'light'; try{ localStorage.setItem(THEME_KEY, state.theme); }catch(e){} applyTheme(state.theme); render(); break;
    case 'noop': break;
    case 'go-finance': state.module='finance'; state.financeTab='recv'; render(); break;
    case 'go-prod': state.module='production'; render(); break;
    case 'kpi-nav': { const mod=t.dataset.mod; if(!canSee(mod)){ toast('Нет доступа к разделу','warn'); break; } state.module=mod; state.sideOpen=false; if(mod==='finance'&&t.dataset.tab) state.financeTab=t.dataset.tab; render(); } break;
    case 'go-measure-deal': state.measureDealId=id; state.module='measure'; closeModal(); render(); break;
    case 'open-deal': openDeal(id); clearSearch(); break;
    case 'stage-edit-toggle': state.stageEdit=!state.stageEdit; renderModule(); break;
    case 'stage-add': stageAddModal(); break;
    case 'stage-edit': stageEditModal(id); break;
    case 'stage-save': stageSave(t.dataset.id||null); break;
    case 'stage-del': stageDelModal(id); break;
    case 'stage-del-confirm': stageDelConfirm(id); break;
    case 'stage-move': stageMove(id, t.dataset.dir); break;
    case 'prod-stage-move': prodStageMove(id, t.dataset.dir); break;
    case 'prod-stage-edit-toggle': state.prodEdit=!state.prodEdit; renderModule(); break;
    case 'prod-stage-add': prodStageAddModal(); break;
    case 'prod-stage-edit': prodStageEditModal(id); break;
    case 'prod-stage-save': prodStageSave(t.dataset.id||null); break;
    case 'prod-stage-del': prodStageDelModal(id); break;
    case 'prod-stage-del-confirm': prodStageDelConfirm(id); break;
    case 'goto-deal': gotoDeal(id); break;
    case 'search-open-deal': searchOpenDeal(id); break;
    case 'search-open-client': searchOpenClient(id); break;
    case 'search-open-measure': searchOpenMeasureDeal(id); break;
    case 'search-open-prod': searchOpenProdDeal(id); break;
    case 'search-open-wh': searchOpenWhItem(id, t.dataset.kind); break;
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
    case 'deal-photo-add': dealPhotoAdd(id); break;
    case 'deal-photo-view': dealPhotoView(t.dataset.pid, id); break;
    case 'deal-photo-back': reopenModal(id); break;
    case 'deal-photo-del': { const d=dealById(id); if(d&&d.photos){ d.photos=d.photos.filter(ph=>ph.id!==t.dataset.pid); saveDB(); reopenModal(id); } } break;
    case 'deal-comment-add': dealCommentAdd(id); break;
    case 'create-task': createTask(t.dataset.id); break;
    case 'task-toggle': toggleTask(id); break;
    case 'task-del': delTask(id); break;
    case 'open-client': openClient(id); clearSearch(); break;
    case 'new-client': newClientModal(); break;
    case 'create-client': createClient(); break;
    case 'del-client': delClientModal(id); break;
    case 'del-client-confirm': delClientConfirm(id); break;
    case 'trash-restore': trashRestore(id); break;
    case 'trash-purge': trashPurge(id); break;
    case 'edit-client': editClientModal(id); break;
    case 'save-client': saveClient(t.dataset.id); break;
    case 'import-clients': importClientsModal(); break;
    case 'import-clients-run': importClientsRun(); break;
    case 'import-wh': importWhModal(t.dataset.kind); break;
    case 'import-wh-run': importWhRun(); break;
    case 'backup-export': exportBackup(); break;
    case 'backup-import': importBackupModal(); break;
    case 'backup-restore': backupRestore(); break;
    case 'wa-deal': if(!canWa()){ toast('Нет доступа к WhatsApp','warn'); break; } waSendModal(null, id); break;
    case 'wa-client': if(!canWa()){ toast('Нет доступа к WhatsApp','warn'); break; } waSendModal(id, null); break;
    case 'wa-send': if(!canWa()){ toast('Нет доступа к WhatsApp','warn'); break; } waDoSend(t.dataset.id||null, t.dataset.deal||null); break;
    case 'wa-chat': if(!canWa()){ toast('Нет доступа к WhatsApp','warn'); break; } waChatModal(id); break;
    case 'wa-deal-chat': if(!canWa()){ toast('Нет доступа к WhatsApp','warn'); break; } waDealChatModal(id); break;
    case 'wa-chat-send': if(!canWa()){ toast('Нет доступа к WhatsApp','warn'); break; } waChatSend(id); break;
    case 'wa-save-config': waSaveConfig(); break;
    case 'ig-save-config': igSaveConfig(); break;
    case 'wa-check': waCheck(); break;
    case 'wa-setup-webhook': waSetupWebhook(); break;
    case 'add-payment': addPaymentModal(id); break;
    case 'confirm-payment': confirmPayment(id); break;
    case 'm-pick': state.measureDealId=id; renderModule(); break;
    case 'm-add': mAdd(); break;
    case 'm-del': mDel(t.dataset.cid); break;
    case 'm-extra': mSet(t.dataset.cid,'extras',t.dataset.v); break;
    case 'm-price-auto': { const d=currentMeasureDeal(); const c=d&&(d.items||[]).find(x=>x.id===t.dataset.cid); if(c){ delete c.priceOverride; if(apiOn()) persist(API.persist.saveItem(c)); syncDealSum(d); saveDB(); renderModule(); } } break;
    // створки по отдельности: выбор створки + тип открывания / петли / активность
    case 'm-sash-pick': sashSel[t.dataset.cid]=+t.dataset.i; renderModule(); break;
    case 'm-sash-open': { sashSel[t.dataset.cid]=+t.dataset.i; const v=t.dataset.v; mSashSet(t.dataset.cid, +t.dataset.i, v!=='deaf'?{open:v,active:true}:{open:v}); } break;
    case 'm-sash-dir': mSashSet(t.dataset.cid, +t.dataset.i, {dir:t.dataset.v}); break;
    case 'm-sash-active': { const d=currentMeasureDeal(); const c=d&&(d.items||[]).find(x=>x.id===t.dataset.cid); if(c){ const s=ensureSashList(c)[+t.dataset.i]; if(s) mSashSet(t.dataset.cid, +t.dataset.i, {active:!s.active}); } } break;
    // Открытие/печать документов — операция только для чтения: НЕ трогаем d.sum
    // (раньше генерация КП/счёта/договора затирала сумму сделки расчётом по позициям).
    case 'gen-kp': openKp(id); break;
    case 'print-kp': printKp(id); break;
    case 'gen-invoice': openInvoice(id); break;
    case 'print-invoice': printInvoice(id); break;
    case 'gen-contract': {
        const d=dealById(id); if(!d) break;
        if(d.contractNo){ openContract(id); break; }
        if(apiOn()){
          // номер выдаёт сервер атомарно (без гонок и дублей)
          API.persist.allocateContract(d.id)
            .then(r=>{ d.contractNo=r.contractNo; d.contractDate=r.contractDate; saveDB(); openContract(id); })
            .catch(e=>{ toast('Не удалось выдать номер договора: '+((e&&e.message)||''),'warn'); });
        } else {
          d.contractNo=nextContractNo(); d.contractDate=now().toISOString().slice(0,10); saveDB(); openContract(id);
        }
      } break;
    case 'print-contract': printContract(id); break;
    case 'quick-prepay': applyPrepay(id); break;
    case 'confirm-prepay': applyPrepay(id); break;
    case 'wh-tab': state.whTab=t.dataset.v; renderModule(); break;
    case 'funnel-reset': state.funnelMgr='all'; state.funnelStage='all'; state.funnelSrc='all'; renderModule(); break;
    case 'clients-reset': state.clientType='all'; state.clientDebt='all'; state.clientSearch=''; renderModule(); break;
    case 'wh-low': state.whLow=!state.whLow; renderModule(); break;
    case 'wh-flt-reset': state.whSearch=''; state.whLow=false; renderModule(); break;
    case 'wh-mv-type': state.whMoveType=t.dataset.v; renderModule(); break;
    case 'wh-mv-period': state.whMovePeriod=t.dataset.v; state.whMoveFrom=null; state.whMoveTo=null; renderModule(); break;
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
    case 'fin-period': state.financePeriod=t.dataset.v; state.financeFrom=null; state.financeTo=null; renderModule(); break;
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
  if(t.dataset.act==='funnel-mgr'){ state.funnelMgr=t.value; renderModule(); }
  if(t.dataset.act==='funnel-stage'){ state.funnelStage=t.value; renderModule(); }
  if(t.dataset.act==='funnel-src'){ state.funnelSrc=t.value; renderModule(); }
  if(t.dataset.act==='cl-type'){ state.clientType=t.value; renderModule(); }
  if(t.dataset.act==='cl-debt'){ state.clientDebt=t.value; renderModule(); }
  if(t.dataset.act==='trash-retention'){ trashSetRetention(t.dataset.id, parseInt(t.value,10)); }
  if(t.dataset.act==='fin-date'){ state.financeFrom=t.value||null; state.financePeriod=(state.financeFrom||state.financeTo)?'date':'all'; renderModule(); }
  if(t.dataset.act==='fin-date-to'){ state.financeTo=t.value||null; state.financePeriod=(state.financeFrom||state.financeTo)?'date':'all'; renderModule(); }
  if(t.dataset.act==='wh-mv-from'){ state.whMoveFrom=t.value||null; state.whMovePeriod=(state.whMoveFrom||state.whMoveTo)?'date':'all'; renderModule(); }
  if(t.dataset.act==='wh-mv-to'){ state.whMoveTo=t.value||null; state.whMovePeriod=(state.whMoveFrom||state.whMoveTo)?'date':'all'; renderModule(); }
  if(t.dataset.act==='prod-date'){ const d=dealById(t.dataset.id); if(d){ d[t.dataset.field]=t.value||null; saveDB(); if(apiOn()) persist(API.persist.saveDeal(d)); renderModule(); openProd(d.id); } }
});
document.addEventListener('input', e=>{
  const t=e.target.closest('[data-act]'); if(!t) return;
  if(t.dataset.act==='search'){ globalSearch(t.value); return; }
  if(t.dataset.act==='cl-search'){ state.clientSearch=t.value; renderModule(); const si=document.getElementById('cl-search'); if(si){ si.focus(); const v=si.value; si.setSelectionRange(v.length,v.length); } return; }
  if(t.dataset.act==='wh-search'){ state.whSearch=t.value; renderModule(); const si=document.getElementById('wh-search'); if(si){ si.focus(); const v=si.value; si.setSelectionRange(v.length,v.length); } return; }
  if(t.dataset.act==='m-discount'){ const d=dealById(t.dataset.id); d.discount=Math.max(0,Math.min(30,parseFloat(t.value)||0)); saveDB(); if(apiOn()) persist(API.persist.saveDeal(d)); patchMeasure(); }
  if(t.dataset.act==='m-prepay'){ const d=dealById(t.dataset.id); d.prepayPct=Math.max(0,Math.min(100,parseFloat(t.value)||0)); saveDB(); if(apiOn()) persist(API.persist.saveDeal(d)); patchMeasure(); }
});
document.addEventListener('keydown', e=>{ if(e.key==='Escape'){ closeModal(); clearSearch(); } });
document.addEventListener('keydown', e=>{ if(e.key==='Enter' && (e.target.id==='api-email'||e.target.id==='api-pass')){ e.preventDefault(); apiLoginSubmit(); } });
/* закрыть выпадашку и мобильную строку поиска по клику вне неё */
document.addEventListener('click', e=>{
  if(e.target.closest('.search')||e.target.closest('[data-act="search-mobile"]')) return;
  const dd=document.getElementById('search-dd'); if(dd&&dd.classList.contains('open')) dd.classList.remove('open');
  const sb=document.querySelector('.topbar .search.open'); if(sb){ sb.classList.remove('open'); const i=document.getElementById('global-search'); if(i) i.value=''; }
});

/* ============ DRAG & DROP (+ авто-скролл к краям, как в Trello) ============ */
let dragId=null, dragKind=null;
let __dragX=0, __dragY=0, __dragRAF=null;
function dragAutoScrollStep(){
  if(dragId==null){ __dragRAF=null; return; }
  const EDGE=72, MAX=26;
  const ramp=d=>{ d=Math.max(0,d); return d>=EDGE?0:(1-d/EDGE); }; // ближе к краю — быстрее (0..1)
  const x=__dragX, y=__dragY;
  // горизонталь — доска канбана
  const board=document.querySelector('.kanban');
  if(board){ const r=board.getBoundingClientRect();
    if(y>=r.top-EDGE && y<=r.bottom+EDGE){
      if(x<r.left+EDGE) board.scrollLeft -= MAX*ramp(x-r.left);
      else if(x>r.right-EDGE) board.scrollLeft += MAX*ramp(r.right-x);
    }
  }
  // вертикаль — колонка под курсором, иначе область контента
  let vEl=null; const under=document.elementFromPoint(x,y);
  if(under) vEl=under.closest('.kcol-b');
  if(!vEl) vEl=document.querySelector('.content');
  if(vEl){ const r=vEl.getBoundingClientRect();
    if(y<r.top+EDGE) vEl.scrollTop -= MAX*ramp(y-r.top);
    else if(y>r.bottom-EDGE) vEl.scrollTop += MAX*ramp(r.bottom-y);
  }
  __dragRAF=requestAnimationFrame(dragAutoScrollStep);
}
function dragScrollStart(){ if(!__dragRAF) __dragRAF=requestAnimationFrame(dragAutoScrollStep); }
function dragScrollStop(){ if(__dragRAF){ cancelAnimationFrame(__dragRAF); __dragRAF=null; } }
document.addEventListener('dragstart', e=>{
  if(!e.target||!e.target.closest) return;
  const c=e.target.closest('[data-card],[data-pcard]'); if(!c) return;
  dragId=c.dataset.card||c.dataset.pcard; dragKind=c.dataset.card?'deal':'prod'; c.classList.add('dragging');
  __dragX=e.clientX; __dragY=e.clientY; dragScrollStart();
});
document.addEventListener('dragend', e=>{ const c=(e.target&&e.target.closest)?e.target.closest('[data-card],[data-pcard]'):null; if(c)c.classList.remove('dragging');
  document.querySelectorAll('.drop-hot').forEach(x=>x.classList.remove('drop-hot')); dragId=null; dragScrollStop(); });
/* трекинг позиции курсора для авто-скролла (capture — ловим всегда во время перетаскивания) */
document.addEventListener('dragover', e=>{ if(dragId!=null){ __dragX=e.clientX; __dragY=e.clientY; } }, true);
document.addEventListener('dragover', e=>{
  if(!e.target||!e.target.closest) return;
  const z=e.target.closest('[data-drop],[data-pdrop]'); if(!z) return; e.preventDefault();
  const col=z.closest('.kcol'); document.querySelectorAll('.drop-hot').forEach(x=>x.classList.remove('drop-hot')); if(col)col.classList.add('drop-hot');
});
document.addEventListener('drop', e=>{
  const z=(e.target&&e.target.closest)?e.target.closest('[data-drop],[data-pdrop]'):null; if(!z||!dragId){ dragScrollStop(); return; } e.preventDefault();
  if(dragKind==='deal' && z.dataset.drop){ const d=dealById(dragId); if(d&&d.stage!==z.dataset.drop) moveStage(dragId, z.dataset.drop); }
  if(dragKind==='prod' && z.dataset.pdrop){ const d=dealById(dragId); if(d&&(d.prodStage||'queue')!==z.dataset.pdrop) moveProd(dragId, z.dataset.pdrop); }
  dragId=null; dragScrollStop();
});

/* ============ INIT ============ */
/* Если есть сохранённый токен — пробуем поднять данные с сервера и войти автоматически.
   При любой ошибке — тихий откат в демо-режим (localStorage), сайт не ломается. */
(async function init(){
  purgeExpiredTrash();
  try{
    if(window.API && API.isAuthed()){
      await bootFromApi();
      const me=await API.me();
      state.user={ id:me.id, name:me.name, role:me.role_id, title:me.title, email:me.email };
      state.module=defaultModule(state.user.role);
    }
  }catch(e){ try{ API.logout(); }catch(_){ } }
  applyHashToState(); // учесть deep-link из URL
  render();
  flushHashOpen();
})();
/* навигация назад/вперёд браузера и ручная правка #-адреса */
window.addEventListener('hashchange', ()=>{
  if(!state.user) return;
  const h=parseHash();
  if(!(h.mod && MODULE_META[h.mod] && canSee(h.mod))){
    if(location.hash!==currentHash()) history.replaceState(null,'',currentHash()); // некорректный/недоступный — вернуть
    return;
  }
  const wantCard = h.deal ? {type:'deal',id:h.deal} : (h.client ? {type:'client',id:h.client} : null);
  const modChanged = h.mod!==state.module
    || (h.mod==='finance' && FIN_TABS.includes(h.tab) && h.tab!==state.financeTab)
    || (h.mod==='warehouse' && WH_TABS.includes(h.tab) && h.tab!==state.whTab);
  if(modChanged){
    if(__openCard){ __openCard=null; document.getElementById('modal-root').innerHTML=''; }
    applyHashToState(); state.sideOpen=false; render(); flushHashOpen(); return;
  }
  // тот же модуль/вкладка — синхронизируем только карточку
  if(wantCard){
    if(!__openCard || __openCard.type!==wantCard.type || __openCard.id!==wantCard.id){
      if(wantCard.type==='deal' && dealById(wantCard.id)) openDeal(wantCard.id);
      else if(wantCard.type==='client' && clientById(wantCard.id)) openClient(wantCard.id);
    }
  } else if(__openCard){ // ушли с карточки (кнопка «назад») — закрыть
    __openCard=null; document.getElementById('modal-root').innerHTML='';
  }
});
