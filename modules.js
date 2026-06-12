'use strict';
/* ============ DASHBOARD ============ */
function renderDashboard(){
  const deals=DB.deals;
  const won=deals.filter(d=>['production','install','done'].includes(d.stage));
  const revenue=DB.deals.reduce((s,d)=>s+dealPaid(d),0);
  const monthRevenue=DB.deals.reduce((s,d)=>s+(d.payments||[]).filter(p=>(SEED_NOW-new Date(p.date))<32*864e5).reduce((a,p)=>a+p.amount,0),0);
  const debt=deals.reduce((s,d)=>s+dealDebt(d),0);
  const payable=DB.payables.filter(p=>p.status!=='оплачено').reduce((s,p)=>s+p.amount,0);
  const activeLeads=deals.filter(d=>!['done'].includes(d.stage)).length;
  const conv=Math.round(won.length/Math.max(1,deals.length)*100);
  const avg=Math.round(won.reduce((s,d)=>s+(d.sum||0),0)/Math.max(1,won.length));
  const inProd=deals.filter(d=>['production','install'].includes(d.stage)).length;

  // funnel viz
  const fmax=deals.length;
  const fviz=STAGES.map((s,i)=>{
    const arr=deals.filter(d=>d.stage===s.id);
    const cnt=arr.length;
    const conv2=i===0?100:Math.round(cnt/Math.max(1,fmax)*100);
    return `<div class="fv-row">
      <span class="fv-lbl">${escA(s.name)}</span>
      <div class="fv-bar" style="width:${Math.max(8,cnt/Math.max(1,fmax)*100)}%;background:${s.color}">${cnt}<span style="opacity:.85;font-weight:600">${moneyK(arr.reduce((a,d)=>a+(d.sum||0),0))}</span></div>
    </div>`;
  }).join('');

  // managers
  const mgrs={}; won.forEach(d=>{ mgrs[d.manager]=(mgrs[d.manager]||0)+(d.sum||0); });
  const mgrRows=Object.entries(mgrs).sort((a,b)=>b[1]-a[1]).map(([id,v])=>({label:userById(id).name, value:v, display:moneyK(v), color:'linear-gradient(90deg,#7c3aed,#a78bfa)'}));

  // sources
  const src={}; deals.forEach(d=>{ src[d.source]=(src[d.source]||0)+1; });
  const srcRows=Object.entries(src).sort((a,b)=>b[1]-a[1]).map(([k,v])=>({label:k,value:v,display:v,color:'linear-gradient(90deg,#0891b2,#22d3ee)'}));

  // monthly revenue (mock 6 mo)
  const mvals=[3.1,3.8,4.2,3.6,4.9,monthRevenue/1e6];
  const mlabels=['дек','янв','фев','мар','апр','май'];
  const mmax=Math.max(...mvals);

  const feed=DB.activity.slice(0,5).map(a=>{
    const u=userById(a.who);
    return `<div class="tl-item"><div class="tl-dot" style="background:${colorFor(a.who)}33;color:${colorFor(a.who)}">${avatarXs(u.name,a.who)}</div>
      <div class="tl-c"><div class="tl-t">${escA(a.text)}</div><div class="tl-d">${escA(u.name)} · ${dateStr(a.at)}</div></div></div>`;
  }).join('');

  // задачи и напоминания
  const openTasks=(DB.tasks||[]).filter(t=>!t.done).sort((a,b)=>String(a.due||'').localeCompare(String(b.due||''))).slice(0,8);
  const taskWidget=openTasks.length?openTasks.map(t=>{const tc=taskClass(t); const td=dealById(t.dealId); const tcl=td?clientById(td.clientId):null; const tu=userById(t.assignee);
    return `<div style="display:flex;gap:10px;align-items:flex-start;padding:9px 2px;border-bottom:1px solid var(--line);cursor:pointer" ${td?`data-act="goto-deal" data-id="${td.id}"`:''}>
      <input type="checkbox" data-act="task-toggle" data-id="${t.id}" style="width:auto;margin-top:2px;cursor:pointer">
      <div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:500">${escA(t.title)}</div>
        <div class="muted2" style="font-size:11.5px;margin-top:2px">${escA(tcl?tcl.name+' · ':'')}<span style="color:${tc.color}">${dateStr(t.due)} · ${tc.txt}</span>${escA(tu?' · '+tu.name.split(' ')[0]:'')}</div></div>
    </div>`;}).join(''):'<div class="muted" style="padding:8px 0">Открытых задач нет 🎉</div>';

  return `
  <div class="cards-row">
    ${kpi({icon:'money',label:'Выручка за месяц',value:moneyK(monthRevenue),color:'#16a34a',soft:'var(--green-soft)',sub:'<span class="up">▲ 18%</span> к апрелю',subClass:'',nav:'finance',tab:'pl'})}
    ${kpi({icon:'trend',label:'Эффективность продаж',value:conv+'%',color:'#2563eb',sub:`${won.length} из ${deals.length} сделок выиграно`,nav:'funnel'})}
    ${kpi({icon:'wallet',label:'Дебиторка (нам должны)',value:moneyK(debt),color:'#d97706',soft:'var(--amber-soft)',sub:'Открыть отчёт →',nav:'finance',tab:'recv'})}
    ${kpi({icon:'doc',label:'Кредиторка (мы должны)',value:moneyK(payable),color:'#dc2626',soft:'var(--red-soft)',sub:`${DB.payables.length} поставщиков`,nav:'finance',tab:'pay'})}
  </div>
  <div class="cards-row section-gap">
    ${kpi({icon:'funnel',label:'Активные сделки',value:activeLeads,color:'#7c3aed',sub:'в работе сейчас',nav:'funnel'})}
    ${kpi({icon:'money',label:'Средний чек',value:moneyK(avg),color:'#0891b2',nav:'finance',tab:'pl'})}
    ${kpi({icon:'production',label:'В производстве',value:inProd,color:'#db2777',sub:'заказов на линии',nav:'production'})}
    ${kpi({icon:'money',label:'Всего получено',value:moneyK(revenue),color:'#16a34a',nav:'finance',tab:'pl'})}
  </div>

  <div class="grid-2 section-gap">
    <div class="panel">
      <div class="panel-h">${icon('funnel')}<h3>Воронка продаж</h3><span class="ph-sub">все сделки по стадиям</span></div>
      <div class="panel-b"><div class="funnel-vis">${fviz}</div></div>
    </div>
    <div class="panel">
      <div class="panel-h">${icon('trend')}<h3>Выручка по месяцам</h3></div>
      <div class="panel-b">${bars(mvals.map((v,i)=>({label:mlabels[i],value:v,display:v.toFixed(1)+' млн',color:i===mvals.length-1?'linear-gradient(90deg,#16a34a,#4ade80)':'linear-gradient(90deg,#2563eb,#3b82f6)'})),mmax)}</div>
    </div>
  </div>

  <div class="grid-2 section-gap">
    <div class="panel">
      <div class="panel-h">${icon('clients')}<h3>Продажи по менеджерам</h3></div>
      <div class="panel-b">${mgrRows.length?bars(mgrRows):'<div class="muted">Нет данных</div>'}</div>
    </div>
    <div class="panel">
      <div class="panel-h">${icon('layers')}<h3>Источники лидов</h3></div>
      <div class="panel-b">${bars(srcRows)}</div>
    </div>
  </div>

  <div class="grid-2 section-gap">
    <div class="panel">
      <div class="panel-h">${icon('clock')}<h3>Задачи и напоминания</h3><span class="ph-sub">${openTasks.length} открытых</span></div>
      <div class="panel-b">${taskWidget}</div>
    </div>
    <div class="panel">
      <div class="panel-h">${icon('clock')}<h3>Последние события</h3></div>
      <div class="panel-b"><div class="timeline">${feed}</div></div>
    </div>
  </div>`;
}

/* ============ FUNNEL ============ */
function renderFunnel(){
  const fMgr=state.funnelMgr||'all', fStage=state.funnelStage||'all', fSrc=state.funnelSrc||'all';
  const anyFilter = fMgr!=='all'||fStage!=='all'||fSrc!=='all';
  // фильтры по ответственному и источнику применяем к набору сделок,
  // фильтр по стадии — прячет лишние колонки канбана
  const dir = state.user && state.user.role==='director';
  const editing = dir && state.stageEdit;
  const matchMS=d=> (fMgr==='all'||d.manager===fMgr) && (fSrc==='all'||d.source===fSrc);
  const deals=DB.deals.filter(matchMS);
  const totalSum=deals.filter(d=>d.stage!=='done').reduce((s,d)=>s+(d.sum||0),0);
  const stagesShown = (editing || fStage==='all') ? STAGES : STAGES.filter(s=>s.id===fStage);
  const cols=stagesShown.map((s,idx)=>{
    const arr=deals.filter(d=>d.stage===s.id);
    const sum=arr.reduce((a,d)=>a+(d.sum||0),0);
    const cards=arr.map(d=>funnelCard(d)).join('') || `<div class="muted2" style="font-size:12px;text-align:center;padding:14px 0">пусто</div>`;
    const locked = SYSTEM_STAGE_IDS.includes(s.id);
    const head = editing
      ? `<span class="dot-i" style="background:${s.color}"></span><span class="kc-name">${escA(s.name)}</span>
         <span style="margin-left:auto;display:flex;gap:2px;align-items:center">
           <button class="x" data-act="stage-move" data-id="${s.id}" data-dir="left" title="Левее" style="width:22px;height:26px;font-size:16px${idx===0?';opacity:.25;pointer-events:none':''}">‹</button>
           <button class="x" data-act="stage-move" data-id="${s.id}" data-dir="right" title="Правее" style="width:22px;height:26px;font-size:16px${idx===STAGES.length-1?';opacity:.25;pointer-events:none':''}">›</button>
           <button class="x" style="width:26px;height:26px" data-act="stage-edit" data-id="${s.id}" title="Изменить стадию">${icon('edit','sm')}</button>
           ${locked
             ? `<span class="muted2" style="display:inline-grid;place-items:center;width:26px;height:26px" title="Системная стадия: используется разделами «Замер» и «Производство» — удалить нельзя">${icon('lock','sm')}</span>`
             : `<button class="x" style="width:26px;height:26px" data-act="stage-del" data-id="${s.id}" title="Удалить стадию">${icon('trash','sm')}</button>`}</span>`
      : `<span class="dot-i" style="background:${s.color}"></span><span class="kc-name">${escA(s.name)}</span><span class="kc-count">${arr.length}</span><span class="kc-sum">${sum?moneyK(sum):''}</span>`;
    return `<div class="kcol" data-stage="${s.id}">
      <div class="kcol-h">${head}</div>
      <div class="kcol-b" data-drop="${s.id}">${cards}</div>
    </div>`;
  }).join('') + (editing ? `<div class="kcol" style="border-style:dashed;display:grid;place-items:center;min-height:120px"><button class="btn sm" data-act="stage-add">${icon('plus','sm')} Стадия</button></div>` : '');
  // селекты фильтров
  const selSt='background:var(--bg2);border:1px solid var(--line);border-radius:9px;padding:7px 10px;color:var(--txt);font-size:13px;outline:none;cursor:pointer';
  const mgrs=DB.users.filter(u=>['director','manager'].includes(u.role)||DB.deals.some(d=>d.manager===u.id));
  const mgrOpts=`<option value="all">Все ответственные</option>`+mgrs.map(u=>`<option value="${u.id}"${fMgr===u.id?' selected':''}>${escA(u.name)}</option>`).join('');
  const stageOpts=`<option value="all">Все стадии</option>`+STAGES.map(s=>`<option value="${s.id}"${fStage===s.id?' selected':''}>${escA(s.name)}</option>`).join('');
  const srcVals=[...new Set([...SOURCES,...DB.deals.map(d=>d.source).filter(Boolean)])];
  const srcOpts=`<option value="all">Все источники</option>`+srcVals.map(v=>`<option value="${escA(v)}"${fSrc===v?' selected':''}>${escA(v)}</option>`).join('');
  return `
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap">
    <div class="tag blue">${icon('funnel','sm')} ${deals.length}${anyFilter?` из ${DB.deals.length}`:''} сделок</div>
    <div class="tag">в работе: ${moneyK(totalSum)}</div>
    <div style="margin-left:auto;display:flex;gap:8px">
      <button class="btn sm" data-act="export" data-what="deals">${icon('doc','sm')} Экспорт</button>
      ${dir?`<button class="btn sm ${editing?'primary':''}" data-act="stage-edit-toggle">${icon('edit','sm')} ${editing?'Готово':'Стадии'}</button>`:''}
      <button class="btn primary" data-act="new-deal">${icon('plus','sm')} Новая сделка</button></div>
  </div>
  ${editing?`<div class="muted2" style="font-size:12px;margin-bottom:12px;padding:9px 12px;background:var(--accent-soft);border-radius:9px">Режим редактирования стадий: стрелками ‹ › меняйте порядок, ✎ — название и цвет, добавьте или удалите стадию. При удалении укажете, куда перенести её сделки.</div>`:''}
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;flex-wrap:wrap">
    <span class="muted2" style="font-size:11.5px">Фильтры:</span>
    <select data-act="funnel-mgr" style="${selSt}">${mgrOpts}</select>
    <select data-act="funnel-stage" style="${selSt}">${stageOpts}</select>
    <select data-act="funnel-src" style="${selSt}">${srcOpts}</select>
    ${anyFilter?`<button class="btn sm" data-act="funnel-reset">${icon('x','sm')} Сбросить</button>`:''}
  </div>
  <div class="kanban">${cols}</div>
  <div class="muted2" style="font-size:12px;margin-top:12px">Перетащите карточку между колонками мышью, либо откройте сделку и смените стадию.</div>`;
}
function funnelCard(d){
  const cl=clientById(d.clientId); const m=userById(d.manager); const st=stageById(d.stage);
  const days=Math.max(0,Math.round((SEED_NOW-new Date(d.stageSince))/864e5));
  const debt=dealDebt(d);
  return `<div class="kcard" draggable="true" data-card="${d.id}" data-act="open-deal" data-id="${d.id}" style="border-left-color:${st.color}">
    <div class="kc-top">
      <div><div class="kc-client">${escA(cl.name)} ${d.hot?icon('flame','sm'):''}</div>
        <div class="kc-addr">${icon('pin','sm')} ${escA(cl.address.split(',').slice(1).join(',').trim()||cl.address)}</div></div>
    </div>
    ${d.sum?`<div class="kc-sum">${money(d.sum)}</div>`:`<div class="kc-sum muted2" style="font-size:12.5px;font-weight:600">${escA(d.note||'—')}</div>`}
    ${d.sum&&debt>0&&['prepaid','production','install','done'].includes(d.stage)?`<div style="font-size:11.5px;margin-top:4px" class="tag amber">долг ${moneyK(debt)}</div>`:''}
    <div class="kc-meta">${avatarXs(m.name,d.manager)}<span class="muted2" style="font-size:11.5px">${escA(m.name.split(' ')[0])}</span>
      <span class="kc-days">${icon('clock','sm')} ${days}д</span></div>
  </div>`;
}

/* ============ DEAL MODAL ============ */
function openDeal(id){
  const d=dealById(id); if(!d) return;
  __cardReturn=null; __openCard={type:'deal',id}; // открыли карточку «начисто» — отразим в URL
  const cl=clientById(d.clientId); const m=userById(d.manager); const st=stageById(d.stage);
  const sum=d.sum||dealItemsSum(d); const paid=dealPaid(d); const debt=Math.max(0,sum-paid);
  const items=(d.items||[]).map(c=>{
    const mat=matById(c.profileId);
    return `<tr><td>${escA(mat?mat.name:'—')} · ${c.w}×${c.h}мм</td><td class="muted">${escA(openById(c.openId)?.name||'')}, ${c.sashes} ств.</td><td class="num">${money(constrPrice(c))}</td></tr>`;
  }).join('');
  const pays=(d.payments||[]).map(p=>`<div class="stat-line"><span>${escA(p.type)} · ${dateStr(p.date)}</span><span style="color:${p.amount<0?'#f87171':'#4ade80'};font-weight:700">${p.amount<0?'−':'+'}${money(Math.abs(p.amount))}</span></div>`).join('')||'<div class="muted" style="font-size:13px">Оплат пока нет</div>';
  const tlist=tasksForDeal(d.id);
  const taskRows=tlist.length?tlist.map(t=>{const tc=taskClass(t); const tu=userById(t.assignee);
    return `<div class="stat-line"><span style="display:flex;align-items:center;gap:9px;min-width:0">
        <input type="checkbox" ${t.done?'checked':''} data-act="task-toggle" data-id="${t.id}" style="width:auto;cursor:pointer">
        <span style="${t.done?'text-decoration:line-through;opacity:.55':''}">${escA(t.title)}</span></span>
      <span style="display:flex;align-items:center;gap:8px;white-space:nowrap"><span class="muted2" style="font-size:11.5px;color:${tc.color}">${dateStr(t.due)} · ${tc.txt}${escA(tu?' · '+tu.name.split(' ')[0]:'')}</span>
        <button class="x" style="width:26px;height:26px" data-act="task-del" data-id="${t.id}">${icon('x','sm')}</button></span></div>`;}).join('')
    :'<div class="muted2" style="font-size:12px">Задач нет — добавьте напоминание о следующем шаге</div>';
  const stageOpts=STAGES.map(s=>`<button class="chip ${s.id===d.stage?'on':''}" data-act="move-stage" data-id="${d.id}" data-stage="${s.id}">${escA(s.name)}</button>`).join('');
  const canMoney=seesMoney();
  openModal(`
    <div class="modal-h">
      <span class="av" style="width:42px;height:42px;border-radius:11px;display:grid;place-items:center;background:${colorFor(cl.id)};color:#fff;font-weight:700">${initials(cl.name)}</span>
      <div><h3>${escA(cl.name)} ${d.hot?icon('flame','sm'):''}</h3><div class="mh-sub">${escA(cl.phone)} · ${escA(cl.address)}</div></div>
      <button class="x" data-act="close-modal">${icon('x')}</button>
    </div>
    <div class="modal-b">
      <div class="fld full" style="margin-bottom:14px"><label>Стадия — нажмите, чтобы переключить</label><div class="chips oneline">${stageOpts}</div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
        <span class="tag">${icon('user','sm')} ${escA(m.name)}</span>
        <span class="tag">${icon('layers','sm')} ${escA(d.source)}</span>
      </div>
      ${canMoney?`<div class="cards-row" style="grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">
        <div class="kpi" style="padding:12px"><div class="k-lbl">Сумма заказа</div><div class="k-val" style="font-size:19px">${money(sum)}</div></div>
        <div class="kpi" style="padding:12px"><div class="k-lbl">Оплачено</div><div class="k-val" style="font-size:19px;color:#4ade80">${money(paid)}</div></div>
        <div class="kpi" style="padding:12px"><div class="k-lbl">Остаток</div><div class="k-val" style="font-size:19px;color:${debt>0?'#fbbf24':'#4ade80'}">${money(debt)}</div></div>
      </div>`:''}
      ${items?`<div class="panel" style="margin-bottom:16px"><div class="panel-h" style="padding:12px 14px">${icon('ruler','sm')}<h3 style="font-size:13.5px">Конструкции (${d.items.length})</h3></div>
        <table class="tbl"><tbody>${items}</tbody></table></div>`:''}
      ${canMoney?`<div class="panel" style="margin-bottom:16px"><div class="panel-h" style="padding:12px 14px">${icon('money','sm')}<h3 style="font-size:13.5px">Оплаты</h3></div><div class="panel-b" style="padding:12px 14px">${pays}</div></div>`:''}
      <div class="panel" id="deal-tasks" style="margin-bottom:16px"><div class="panel-h" style="padding:12px 14px">${icon('clock','sm')}<h3 style="font-size:13.5px">Задачи</h3><button class="btn sm" style="margin-left:auto" data-act="add-task" data-id="${d.id}">${icon('plus','sm')} Добавить</button></div>
        <div class="panel-b" style="padding:8px 14px">${taskRows}</div></div>
    </div>
    <div class="modal-f">
      <button class="btn danger" data-act="del-deal" data-id="${d.id}" style="margin-right:auto">${icon('trash','sm')} Удалить</button>
      <button class="btn" data-act="edit-deal" data-back="deal" data-id="${d.id}">${icon('edit','sm')} Изменить</button>
      ${canMoney&&(d.items||[]).length?`<button class="btn soft" data-act="gen-invoice" data-back="deal" data-id="${d.id}">${icon('doc','sm')} Счёт</button>
      <button class="btn soft" data-act="gen-contract" data-back="deal" data-id="${d.id}">${icon('doc','sm')} Договор</button>`:''}
      ${canWa()?`<button class="btn green" data-act="wa-deal-chat" data-back="deal" data-id="${d.id}">${icon('wa','sm')} Чат WhatsApp</button>
      <button class="btn" data-act="wa-deal" data-back="deal" data-id="${d.id}">${icon('send','sm')} Быстрое сообщение</button>`:''}
      ${d.stage==='measure'?`<button class="btn soft" data-act="go-measure-deal" data-id="${d.id}">${icon('ruler','sm')} Открыть замер</button>`:''}
      ${canMoney&&debt>0?`<button class="btn primary" data-act="add-payment" data-back="deal" data-id="${d.id}">${icon('money','sm')} Принять оплату</button>`:''}
    </div>
  `, true);
  syncUrl();
}

/* ============ CLIENTS ============ */
function renderClients(){
  const fType=state.clientType||'all', fDebt=state.clientDebt||'all', q=(state.clientSearch||'').trim().toLowerCase();
  const anyFilter = fType!=='all'||fDebt!=='all'||!!q;
  const matchQ=cl=> !q || [cl.name,cl.phone,cl.address].some(v=>(v||'').toLowerCase().includes(q));
  const filtered=DB.clients.filter(cl=>{
    if(fType!=='all' && cl.type!==fType) return false;
    if(!matchQ(cl)) return false;
    if(fDebt!=='all'){
      const debt=DB.deals.filter(d=>d.clientId===cl.id).reduce((s,d)=>s+dealDebt(d),0);
      if(fDebt==='debt' && !(debt>0)) return false;
      if(fDebt==='nodebt' && debt>0) return false;
    }
    return true;
  });
  const rows=filtered.map(cl=>{
    const ds=DB.deals.filter(d=>d.clientId===cl.id);
    const total=ds.reduce((s,d)=>s+(d.sum||0),0);
    const debt=ds.reduce((s,d)=>s+dealDebt(d),0);
    return `<tr class="clickable" data-act="open-client" data-id="${cl.id}">
      <td><div class="cell-name">${avatarXs(cl.name,cl.id)}<div><div style="font-weight:600">${escA(cl.name)}</div><div class="muted2" style="font-size:11.5px">${escA(cl.type)}</div></div></div></td>
      <td class="muted">${escA(cl.phone)}</td>
      <td class="muted">${escA(cl.address)}</td>
      <td class="num">${ds.length}</td>
      <td class="num">${total?moneyK(total):'—'}</td>
      <td class="num">${debt>0?`<span class="tag amber">${moneyK(debt)}</span>`:'<span class="muted2">—</span>'}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="6" class="muted" style="text-align:center;padding:30px">Никого не найдено по фильтрам</td></tr>`;
  // панель фильтров
  const selSt='background:var(--bg2);border:1px solid var(--line);border-radius:9px;padding:7px 10px;color:var(--txt);font-size:13px;outline:none;cursor:pointer';
  const types=[...new Set(DB.clients.map(c=>c.type).filter(Boolean))];
  const typeOpts=`<option value="all">Все типы</option>`+types.map(v=>`<option value="${escA(v)}"${fType===v?' selected':''}>${escA(v)}</option>`).join('');
  const debtOpts=[['all','Долг — любой'],['debt','С долгом'],['nodebt','Без долга']]
    .map(([v,l])=>`<option value="${v}"${fDebt===v?' selected':''}>${l}</option>`).join('');
  return `<div class="panel">
    <div class="panel-h">${icon('clients')}<h3>Клиенты</h3><span class="ph-sub">${anyFilter?`${filtered.length} из ${DB.clients.length}`:`${DB.clients.length} записей`}</span>
      <div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" data-act="import-clients">${icon('arrow','sm')} Импорт</button><button class="btn sm" data-act="export" data-what="clients">${icon('doc','sm')} Экспорт</button><button class="btn primary sm" data-act="new-client">${icon('plus','sm')} Добавить</button></div></div>
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:12px 16px;border-bottom:1px solid var(--line)">
      <div class="flt-search" style="flex:1;min-width:220px;max-width:360px">${icon('search','sm')}<input id="cl-search" data-act="cl-search" placeholder="Поиск по имени, телефону, адресу" value="${escA(state.clientSearch||'')}" autocomplete="off"></div>
      <select data-act="cl-type" style="${selSt}">${typeOpts}</select>
      <select data-act="cl-debt" style="${selSt}">${debtOpts}</select>
      ${anyFilter?`<button class="btn sm" data-act="clients-reset">${icon('x','sm')} Сбросить</button>`:''}
    </div>
    <table class="tbl">
      <thead><tr><th>Клиент</th><th>Телефон</th><th>Адрес</th><th class="num">Сделок</th><th class="num">Сумма</th><th class="num">Долг</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}
function openClient(id){
  const cl=clientById(id); if(!cl) return;
  __cardReturn=null; __openCard={type:'client',id};
  const ds=DB.deals.filter(d=>d.clientId===cl.id);
  const total=ds.reduce((s,d)=>s+(d.sum||0),0); const paid=ds.reduce((s,d)=>s+dealPaid(d),0);
  const dealRows=ds.map(d=>{const st=stageById(d.stage);
    return `<div class="stat-line"><span><span class="dot-i" style="background:${st.color}"></span> ${escA(st.name)} · ${dateStr(d.createdAt)} <span class="muted2">${escA(d.note||'')}</span></span><span style="font-weight:700">${d.sum?money(d.sum):'—'}</span></div>`;}).join('')||'<div class="muted">Сделок нет</div>';
  openModal(`
    <div class="modal-h">
      <span class="av" style="width:42px;height:42px;border-radius:11px;display:grid;place-items:center;background:${colorFor(cl.id)};color:#fff;font-weight:700">${initials(cl.name)}</span>
      <div><h3>${escA(cl.name)}</h3><div class="mh-sub">${escA(cl.type)} · ${escA(cl.phone)}</div></div>
      <button class="x" data-act="close-modal">${icon('x')}</button>
    </div>
    <div class="modal-b">
      <div class="cards-row" style="grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">
        <div class="kpi" style="padding:12px"><div class="k-lbl">Сделок</div><div class="k-val" style="font-size:19px">${ds.length}</div></div>
        <div class="kpi" style="padding:12px"><div class="k-lbl">Сумма</div><div class="k-val" style="font-size:19px">${moneyK(total)}</div></div>
        <div class="kpi" style="padding:12px"><div class="k-lbl">Оплачено</div><div class="k-val" style="font-size:19px;color:#4ade80">${moneyK(paid)}</div></div>
      </div>
      <div class="fld full" style="margin-bottom:6px"><label>${icon('pin','sm')} Адрес</label><div style="font-size:13.5px">${escA(cl.address)}</div></div>
      <div class="panel" style="margin-top:14px"><div class="panel-h" style="padding:12px 14px">${icon('funnel','sm')}<h3 style="font-size:13.5px">История сделок</h3></div><div class="panel-b" style="padding:12px 14px">${dealRows}</div></div>
    </div>
    <div class="modal-f"><button class="btn danger" data-act="del-client" data-id="${cl.id}" style="margin-right:auto">${icon('trash','sm')} Удалить</button>
      <button class="btn" data-act="edit-client" data-back="client" data-id="${cl.id}">${icon('edit','sm')} Изменить</button>
      ${canWa()?`<button class="btn" data-act="wa-client" data-back="client" data-id="${cl.id}">${icon('send','sm')} Сообщение</button>
      <button class="btn green" data-act="wa-chat" data-back="client" data-id="${cl.id}">${icon('wa','sm')} Чат WhatsApp</button>`:''}</div>
  `);
  syncUrl();
}
