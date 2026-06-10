'use strict';
/* ============ ACTIONS ============ */
function login(id){ state.user=userById(id); state.module=defaultModule(state.user.role); state.measureDealId=null; render(); }
function logout(){ try{ if(window.API){ API.logout(); API.enabled=false; } }catch(e){} state.user=null; render(); }

/* ====== ВХОД ЧЕРЕЗ API (Слой 4) ====== */
/* Заменяет данные демо серверными (bootstrap), оставляя справочники-константы. */
async function bootFromApi(){
  const mapped = await API.loadBootstrap();
  DB = mapped.DB;            // данные с сервера в формате фронта
  API.enabled = true;        // включаем запись на сервер
  return mapped;
}
/* persist: запускает запись на сервер только в API-режиме; ошибку показывает тостом */
function apiOn(){ return !!(window.API && API.enabled); }
function persist(p){ if (p && p.catch) p.catch(e => toast('Не сохранено на сервере: ' + (e && e.message || ''), 'warn')); }
function snapshotStock(){ const m = {}; for (const x of DB.materials) m['m:' + x.id] = x.stock; for (const x of DB.components) m['c:' + x.id] = x.stock; return m; }
function persistStockDiff(before){
  for (const x of DB.materials)  if (before['m:' + x.id] !== x.stock) persist(API.persist.saveMaterial(x));
  for (const x of DB.components) if (before['c:' + x.id] !== x.stock) persist(API.persist.saveComponent(x));
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

function moveStage(id, stage){
  const d=dealById(id); if(!d) return;
  d.stage=stage; d.stageSince=SEED_NOW.toISOString();
  if(['production','install'].includes(stage) && !d.prodStage) d.prodStage='queue';
  if(stage!=='lead' && !d.sum && (d.items||[]).length) d.sum=computeMeasure(d).total;
  saveDB(); if(apiOn()) persist(API.persist.saveDeal(d)); closeModal(); render();
  toast(`Сделка перемещена в «${stageById(stage).name}»`);
}
function moveProd(id, stage){ const d=dealById(id); if(!d) return; d.prodStage=stage;
  if(stage==='installing' && d.stage==='production') d.stage='install';
  const before = apiOn() ? snapshotStock() : null;
  const used=consumeForStage(d, stage);
  if(used.length){
    DB.activity.unshift({who:state.user.id,text:`Списано со склада (${PROD_STAGES.find(s=>s.id===stage).name}) — ${clientById(d.clientId).name}`,at:SEED_NOW.toISOString(),kind:'wh'});
  }
  saveDB();
  if(apiOn()){ persist(API.persist.saveDeal(d)); if(before) persistStockDiff(before); if(used.length) persist(API.persist.createActivity(DB.activity[0])); }
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
  openModal(`<div class="modal-h">${icon('funnel')}<h3>Новая сделка</h3><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b"><div class="fld full" style="margin-bottom:12px"><label>Клиент</label><select id="nd-client" style="background:var(--bg2);border:1px solid var(--line);border-radius:9px;padding:10px;color:var(--txt)">${opts}</select></div>
    <div class="fld full"><label>Комментарий</label><input id="nd-note" placeholder="Что нужно клиенту" style="background:var(--bg2);border:1px solid var(--line);border-radius:9px;padding:10px;color:var(--txt)"></div></div>
    <div class="modal-f"><button class="btn" data-act="close-modal">Отмена</button><button class="btn primary" data-act="create-deal">${icon('plus','sm')} Создать лид</button></div>`);
}
function createDeal(){
  const cid=document.getElementById('nd-client').value; const note=document.getElementById('nd-note').value||'Новая заявка';
  const nd={id:uid('d'),clientId:cid,stage:'lead',manager:state.user.id,sum:0,createdAt:SEED_NOW.toISOString(),stageSince:SEED_NOW.toISOString(),note,source:'Звонок',payments:[],items:[],kp:null,prodStage:null};
  DB.deals.unshift(nd);
  saveDB(); if(apiOn()) persist(API.persist.createDeal(nd)); closeModal(); renderModule(); toast('Лид создан');
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
  DB.activity.unshift({who:state.user.id,text:`Приход на склад: ${it.name} +${qty} ${it.unit}`,at:SEED_NOW.toISOString(),kind:'wh'});
  saveDB();
  if(apiOn()){ persist(kind==='mat'?API.persist.saveMaterial(it):API.persist.saveComponent(it)); persist(API.persist.createActivity(DB.activity[0])); }
  closeModal(); render();
  toast(`Оприходовано: ${it.name} +${qty} ${it.unit} · остаток ${it.stock} ${it.unit}`);
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
    case 'theme': state.theme = state.theme==='light' ? 'dark' : 'light'; try{ localStorage.setItem(THEME_KEY, state.theme); }catch(e){} applyTheme(state.theme); render(); break;
    case 'noop': break;
    case 'go-finance': state.module='finance'; state.financeTab='recv'; render(); break;
    case 'go-prod': state.module='production'; render(); break;
    case 'go-measure-deal': state.measureDealId=id; state.module='measure'; closeModal(); render(); break;
    case 'open-deal': openDeal(id); clearSearch(); break;
    case 'move-stage': moveStage(id, t.dataset.stage); break;
    case 'new-deal': newDealModal(); break;
    case 'create-deal': createDeal(); break;
    case 'open-client': openClient(id); clearSearch(); break;
    case 'new-client': newClientModal(); break;
    case 'create-client': createClient(); break;
    case 'wa-deal': case 'wa-client': toast('Сообщение клиенту отправлено в WhatsApp (демо)'); break;
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
    case 'wh-receive': whReceiveModal(id, t.dataset.kind); break;
    case 'wh-confirm-receive': whConfirmReceive(id, t.dataset.kind); break;
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
