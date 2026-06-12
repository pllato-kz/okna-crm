'use strict';
/* ============ ROOT RENDER ============ */
function render(){
  const app=document.getElementById('app');
  // Демо-гейт отключён: доступ контролирует вход (/api/login). gateStatus/renderGate оставлены для совместимости.
  if(!state.user){ app.innerHTML=renderLogin(); return; }
  app.innerHTML=renderShell();
  renderModule();
}

/* ============ ШЛЮЗ ДОСТУПА ПО ССЫЛКЕ ============ */
function fmtExpiry(ts){ try{ const d=new Date(ts); return d.toLocaleString('ru-RU',{day:'2-digit',month:'long',hour:'2-digit',minute:'2-digit'}); }catch(e){ return ''; } }
function renderGate(g){
  const expired = g.mode==='expired';
  return `<div class="gate-wrap"><button class="theme-fab" data-act="theme" title="Сменить тему">${icon(state.theme==='light'?'moon':'sun')}</button>
    <div class="gate-card">
      <div class="gate-icon">${icon(expired?'clock':'lock','lg')}</div>
      <div class="brand-name" style="font-size:15px;letter-spacing:.04em">Ocean Glass · демо</div>
      <h1>${expired?'Срок доступа к демо истёк':'Доступ к демо по ссылке'}</h1>
      <p>${expired
        ? `Эта демо-ссылка действовала до <b>${fmtExpiry(g.exp)}</b> и больше не активна. Запросите новую ссылку у менеджера Pllato — мы откроем доступ ещё раз.`
        : 'Демонстрационная версия открывается по персональной ссылке с ограниченным сроком. Попросите у менеджера Pllato актуальную ссылку для просмотра.'}</p>
      <a class="gate-btn" href="https://wa.me/77011239999" target="_blank" rel="noopener">${icon('wa','sm')} Запросить доступ в WhatsApp</a>
      <div class="gate-foot">Pllato · кастомные CRM · pllato.kz</div>
    </div></div>`;
}
function shareModal(){
  const opts=[{h:24,t:'24 часа'},{h:72,t:'3 дня'},{h:168,t:'7 дней'},{h:720,t:'30 дней'}];
  openModal(`<div class="modal-h">${icon('link')}<div><h3>Ссылка для клиента</h3><div class="mh-sub">Демо откроется по ссылке и закроется по истечении срока</div></div><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b"><div class="constr-body" style="padding:0">
      <div class="fld full"><label>Срок действия ссылки</label>
        <div class="share-opts">${opts.map((o,i)=>`<button class="share-opt${i===0?' on':''}" data-act="share-pick" data-h="${o.h}">${o.t}</button>`).join('')}</div>
      </div>
      <div class="fld full"><label>Своё значение, часов (необязательно)</label><input type="number" min="1" id="share-hours" placeholder="например 48"></div>
      <div class="fld full"><label>Кому (метка, необязательно)</label><input id="share-label" placeholder="например: ЖК Алтын, Серик"></div>
      <div id="share-out"></div>
    </div></div>
    <div class="modal-f"><button class="btn" data-act="close-modal">Закрыть</button><button class="btn green" data-act="share-make" data-h="24">${icon('link','sm')} Создать ссылку</button></div>`);
}
function renderModule(){
  const view=document.getElementById('view'); if(!view) return;
  const m=state.module;
  let html='';
  if(!canSee(m)){ html=renderNoAccess(); }
  else if(m==='dashboard') html=renderDashboard();
  else if(m==='funnel')    html=renderFunnel();
  else if(m==='clients')   html=renderClients();
  else if(m==='measure')   html=renderMeasure();
  else if(m==='warehouse') html=renderWarehouse();
  else if(m==='production')html=renderProduction();
  else if(m==='finance')   html=renderFinance();
  else if(m==='trash')     html=renderTrash();
  else if(m==='settings')  html=renderSettings();
  view.innerHTML=html;
  if(m==='measure') initMeasureBindings();
  view.scrollTop=0;
}

/* ============ LOGIN ============ */
function renderLogin(g){
  g = g || gateStatus();
  const ownerBtn = g.mode==='owner' ? `<button class="share-fab" data-act="share-demo" title="Создать ссылку для клиента">${icon('link','sm')} Поделиться демо</button>` : '';
  const clientBanner = g.mode==='valid' ? `<div class="demo-banner">${icon('clock','sm')} Демо-доступ активен до <b>${fmtExpiry(g.exp)}</b>${g.label?` · ${g.label}`:''}</div>` : '';
  const accts = DB.users.map(u=>{
    const c=colorFor(u.id);
    return `<button class="acct" data-act="login" data-id="${u.id}">
      <span class="av" style="background:${c}">${initials(u.name)}</span>
      <span class="ai"><span class="an">${u.name}</span><span class="at">${u.title}</span></span>
      <span class="ar">${u.primary?'демо':roleRu(u.role)}</span>
      ${icon('arrow','go')}
    </button>`;
  }).join('');
  return `<div class="login-wrap"><div class="login-fabs">${ownerBtn}<button class="theme-fab" data-act="theme" title="Сменить тему">${icon(state.theme==='light'?'moon':'sun')}</button></div>${clientBanner}<div class="login-card">
    <div class="login-side">
      <div class="brand">
        <div class="brand-logo">${icon('oglass','lg')}</div>
        <div><div class="brand-name">Ocean Glass</div><div class="brand-sub">окна · стекло · фасады</div></div>
      </div>
      <h1>CRM, <span class="grad">собранная под оконный бизнес</span></h1>
      <p>Воронка продаж, выезд на замер с расчётом конструкций прямо на объекте, мгновенное КП клиенту в WhatsApp, склад профиля и стеклопакетов, финансы и дебиторка — в одном окне.</p>
      <div class="login-feats">
        <div class="login-feat"><span class="fi">${icon('ruler','sm')}</span> Замер → расчёт → КП → предоплата за один визит</div>
        <div class="login-feat"><span class="fi">${icon('finance','sm')}</span> Дебиторка и эффективность продаж в реальном времени</div>
        <div class="login-feat"><span class="fi">${icon('warehouse','sm')}</span> Склад профиля, стеклопакетов и фурнитуры</div>
        <div class="login-feat"><span class="fi">${icon('shield','sm')}</span> Права доступа: сборщики и склад не видят финансы</div>
      </div>
    </div>
    <div class="login-main">
      <div class="api-login-box">
        <h2>Вход для сотрудников</h2>
        <div class="fld full" style="margin-bottom:10px"><label>Email</label><input id="api-email" type="email" placeholder="you@company.kz" autocomplete="username" style="width:100%;background:var(--bg2);border:1px solid var(--line);border-radius:9px;padding:11px;color:var(--txt)"></div>
        <div class="fld full" style="margin-bottom:12px"><label>Пароль</label><input id="api-pass" type="password" autocomplete="current-password" style="width:100%;background:var(--bg2);border:1px solid var(--line);border-radius:9px;padding:11px;color:var(--txt)"></div>
        <button class="btn primary" data-act="api-login" style="width:100%;justify-content:center">${icon('logout','sm')} Войти</button>
      </div>
      <div style="display:flex;align-items:center;gap:10px;margin:18px 0 14px;color:var(--muted2);font-size:11px;text-transform:uppercase;letter-spacing:.5px"><span style="flex:1;height:1px;background:var(--line)"></span>или демо-доступ без входа<span style="flex:1;height:1px;background:var(--line)"></span></div>
      <div class="lead">Каждая роль открывает свой набор модулей. Все данные демонстрационные.</div>
      <div class="accounts">${accts}</div>
      <div class="login-extra">Демо: ${DB.company.legal}, ${DB.company.city}. ${DB.company.workshop}. Оборот ${DB.company.revenueYear}.<br>Все цифры и клиенты вымышленные — можно смело кликать, двигать сделки и принимать оплаты.</div>
    </div>
  </div></div>`;
}
function roleRu(r){ return (typeof roleName==='function') ? roleName(r) : r; }

/* ============ SHELL ============ */
function navGroups(){
  return [
    {title:'Продажи', items:['dashboard','funnel','clients']},
    {title:'Поле',    items:['measure']},
    {title:'Операции',items:['warehouse','production']},
    {title:'Финансы', items:['finance']},
    {title:'Система',  items:['trash','settings']},
  ];
}
const MODULE_META = {
  dashboard:{name:'Дашборд',  icon:'dashboard', sub:'Ключевые показатели бизнеса'},
  funnel:   {name:'Воронка',  icon:'funnel',    sub:'Сделки по стадиям'},
  clients:  {name:'Клиенты',  icon:'clients',   sub:'База клиентов и история'},
  measure:  {name:'Замер и КП',icon:'ruler',    sub:'Расчёт конструкций на объекте'},
  warehouse:{name:'Склад',    icon:'warehouse', sub:'Профиль, стеклопакеты, фурнитура'},
  production:{name:'Производство',icon:'production',sub:'Резка, стеклопакет, сборка, монтаж'},
  finance:  {name:'Финансы',  icon:'finance',   sub:'Дебиторка, оплаты, отчётность'},
  trash:    {name:'Корзина',  icon:'trash',     sub:'Удалённые записи — восстановление'},
  settings: {name:'Настройки',icon:'settings',  sub:'Сотрудники и права доступа'},
};
function renderShell(){
  const u=state.user;
  const notifN = (typeof buildNotifs==='function') ? buildNotifs().length : 0;
  const measureCount = DB.deals.filter(d=>d.stage==='measure').length;
  const prodCount = DB.deals.filter(d=>['production','install'].includes(d.stage)).length;
  const nav = navGroups().map(g=>{
    const items=g.items.filter(canSee); if(!items.length) return '';
    return `<div class="nav-group">${g.title}</div>`+items.map(id=>{
      const m=MODULE_META[id]; const active=state.module===id?'active':'';
      let badge='';
      if(id==='measure'&&measureCount) badge=`<span class="badge">${measureCount}</span>`;
      if(id==='production'&&prodCount) badge=`<span class="badge alt">${prodCount}</span>`;
      return `<button class="nav-item ${active}" data-act="nav" data-mod="${id}">${icon(m.icon)}<span>${m.name}</span>${badge}</button>`;
    }).join('');
  }).join('');
  const meta=MODULE_META[state.module]||{name:'',sub:''};
  return `<div class="shell">
    <aside class="sidebar ${state.sideOpen?'open':''}">
      <div class="side-top">
        <div class="brand">
          <div class="brand-logo">${icon('oglass','lg')}</div>
          <div><div class="brand-name">Ocean Glass</div><div class="brand-sub">CRM · Ош</div></div>
        </div>
        <div class="company-pill">
          <div class="cc">${icon('pin','sm')} ${DB.company.city} · ${DB.company.workshop.split(' · ')[0]}</div>
        </div>
      </div>
      <nav class="nav">${nav}</nav>
      <div class="side-bottom">
        <div class="user-chip">
          <span class="av" style="background:${colorFor(u.id)}">${initials(u.name)}</span>
          <span class="ui"><span class="un">${u.name}</span><span class="ut">${u.title}</span></span>
          <button class="sw" data-act="logout" title="Сменить пользователя">${icon('logout','sm')}</button>
        </div>
      </div>
    </aside>
    <main class="main">
      <header class="topbar">
        <button class="icon-btn menu-toggle" data-act="toggle-side">${icon('menu')}</button>
        <div>
          <div class="page-title">${meta.name}</div>
          <div class="page-sub">${meta.sub}</div>
        </div>
        <div class="search">${icon('search','sm')}<input id="global-search" placeholder="Поиск клиента, сделки…" data-act="search" autocomplete="off"><div class="search-dd" id="search-dd"></div></div>
        <button class="icon-btn search-toggle" data-act="search-mobile" title="Поиск">${icon('search')}</button>
        <button class="icon-btn" data-act="theme" title="Сменить тему">${icon(state.theme==='light'?'moon':'sun')}</button>
        <button class="icon-btn" data-act="notif" title="Уведомления">${icon('bell')}${notifN?`<span class="notif-badge">${notifN>9?'9+':notifN}</span>`:''}</button>
        <button class="icon-btn" data-act="reset" title="Сбросить демо-данные">${icon('refresh')}</button>
      </header>
      <section class="content" id="view"></section>
    </main>
  </div>`;
}
function renderNoAccess(){
  return `<div class="empty">${icon('shield')}<h3>Нет доступа</h3><p>Этот раздел недоступен для роли «${state.user.title}».<br>Так работают права: сборщики и склад не видят финансы и клиентскую воронку.</p></div>`;
}

/* ============ MODAL ============ */
function openModal(html, wide){
  const root=document.getElementById('modal-root');
  root.innerHTML=`<div class="modal-bg" data-act="modal-bg"><div class="modal ${wide?'wide':''}">${html}</div></div>`;
}
// карточка, к которой надо вернуться после под-действия (изменить / сообщение / чат)
let __cardReturn=null;
function closeModal(){
  const r=__cardReturn; __cardReturn=null;
  document.getElementById('modal-root').innerHTML='';
  if(r){ try{ r(); }catch(e){} }
}

/* ============ TOAST ============ */
function toast(text, kind){
  const root=document.getElementById('toast-root');
  root.innerHTML=`<div class="toast"><div class="t ${kind||'ok'}">
    <span class="ti" style="background:${kind==='warn'?'var(--amber-soft)':'var(--green-soft)'};color:${kind==='warn'?'#fbbf24':'#4ade80'}">${icon(kind==='warn'?'alert':'check','sm')}</span>
    <span>${text}</span></div></div>`;
  clearTimeout(window.__toastT);
  window.__toastT=setTimeout(()=>{ root.innerHTML=''; }, 3200);
}

/* ============ SMALL UI HELPERS ============ */
function kpi(o){
  const c=o.color||'var(--accent)';
  const clickable=o.act||o.nav;
  const attrs = o.nav ? `data-act="kpi-nav" data-mod="${o.nav}"${o.tab?` data-tab="${o.tab}"`:''}` : (o.act?`data-act="${o.act}"`:'');
  return `<div class="kpi ${clickable?'clickable':''}" ${attrs}>
    <div class="k-ic" style="background:${o.soft||'var(--accent-soft)'};color:${c}">${icon(o.icon)}</div>
    <div class="k-lbl">${o.label}</div>
    <div class="k-val">${o.value}</div>
    ${o.sub?`<div class="k-sub ${o.subClass||''}">${o.sub}</div>`:''}
  </div>`;
}
function avatarXs(name,id){ return `<span class="avatar-xs" style="background:${colorFor(id||name)}">${initials(name)}</span>`; }
function bars(rows, max){
  max = max || Math.max(1,...rows.map(r=>r.value));
  return `<div class="bars">`+rows.map(r=>`
    <div class="bar-row">
      <span class="bl">${r.label}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.max(2,r.value/max*100)}%;background:${r.color||'linear-gradient(90deg,#2563eb,#3b82f6)'}">${r.inBar||''}</div></div>
      <span class="bv">${r.display!=null?r.display:r.value}</span>
    </div>`).join('')+`</div>`;
}

/* ============ УВЕДОМЛЕНИЯ ============ */
function notifKindMeta(kind){
  return ({
    money:  {icon:'money',     color:'#16a34a'},
    measure:{icon:'ruler',     color:'#0891b2'},
    funnel: {icon:'funnel',    color:'#2563eb'},
    prod:   {icon:'production',color:'#db2777'},
    lead:   {icon:'flame',     color:'#d97706'},
    wh:     {icon:'box',       color:'#7c3aed'},
  })[kind] || {icon:'bell', color:'var(--accent)'};
}
/* Персональные уведомления: каждому — его задачи; директору — ещё и просрочки по всем (контроль). */
function buildNotifs(){
  const me=state.user; if(!me || !Array.isArray(DB.tasks)) return [];
  const open=DB.tasks.filter(t=>!t.done);
  const cls=t=>(typeof taskClass==='function')?taskClass(t):{k:'',txt:'',color:'var(--muted)'};
  const overdue=t=>(typeof taskDayDiff==='function')?taskDayDiff(t.due)<0:false;
  const list=[];
  // 1) мои задачи
  open.filter(t=>t.assignee===me.id).forEach(t=>{ const c=cls(t); const d=dealById(t.dealId); const cl=d?clientById(d.clientId):null;
    list.push({ id:'my_'+t.id, dealId:t.dealId, ov:c.k==='overdue', due:t.due,
      icon:c.k==='overdue'?'alert':'clock', color:c.color,
      title:(c.k==='overdue'?'Просрочена задача: ':'Задача: ')+t.title,
      sub:`${cl?cl.name+' · ':''}${dateStr(t.due)} · ${c.txt}` });
  });
  // 1b) нехватка материалов на производстве — ответственному за сделку, складу и директору
  if(typeof materialShortage==='function'){
    DB.deals.filter(d=>['production','install'].includes(d.stage)).forEach(d=>{
      const relevant = (d.manager===me.id) || me.role==='warehouse' || me.role==='director';
      if(!relevant) return;
      const short=materialShortage(d); if(!short.length) return;
      const cl=dealById(d.id)?clientById(d.clientId):null;
      list.push({ id:'short_'+d.id, dealId:d.id, ov:true, due:'', icon:'alert', color:'#dc2626',
        title:'Не хватает материалов: '+(cl?cl.name:d.id),
        sub: short.map(s=>`${s.name} — не хватает ${s.lack} ${s.unit}`).slice(0,3).join('; ') });
    });
  }
  // 2) директор: просроченные чужие задачи (контроль)
  if(me.role==='director'){
    open.filter(t=>t.assignee!==me.id && overdue(t)).forEach(t=>{ const u=userById(t.assignee); const d=dealById(t.dealId); const cl=d?clientById(d.clientId):null;
      list.push({ id:'ov_'+t.id, dealId:t.dealId, ov:true, due:t.due, icon:'alert', color:'#f87171',
        title:'Просрочка у сотрудника: '+t.title, sub:`${u?u.name+' · ':''}${cl?cl.name+' · ':''}${dateStr(t.due)}` });
    });
  }
  return list.sort((a,b)=>(b.ov-a.ov)||String(a.due||'').localeCompare(String(b.due||'')));
}
function notifModal(){
  const list=buildNotifs();
  const items=list.map(n=>`<div class="tl-item" ${n.dealId?`data-act="goto-deal" data-id="${n.dealId}" style="cursor:pointer"`:''}>
      <div class="tl-dot" style="background:${n.color}24;color:${n.color}">${icon(n.icon,'sm')}</div>
      <div class="tl-c"><div class="tl-t">${n.title}</div><div class="tl-d">${n.sub}</div></div></div>`).join('')
    || '<div class="muted" style="padding:18px;text-align:center">Новых уведомлений нет 🎉</div>';
  openModal(`<div class="modal-h">${icon('bell')}<div><h3>Уведомления</h3><div class="mh-sub">${list.length?'актуальных: '+list.length:'всё под контролем'}</div></div><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b"><div class="timeline">${items}</div></div>
    <div class="modal-f"><button class="btn" data-act="close-modal">Закрыть</button></div>`);
}
