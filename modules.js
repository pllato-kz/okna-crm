'use strict';
/* ============ DASHBOARD ============ */
function renderDashboard(){
  const deals=DB.deals;
  const won=deals.filter(d=>['production','install','done'].includes(d.stage));
  const revenue=DB.deals.reduce((s,d)=>s+dealPaid(d),0);
  const monthRevenue=DB.deals.reduce((s,d)=>s+(d.payments||[]).filter(p=>(SEED_NOW-new Date(p.date))<32*864e5).reduce((a,p)=>a+p.amount,0),0);
  const debt=deals.reduce((s,d)=>s+dealDebt(d),0);
  const payable=DB.payables.reduce((s,p)=>s+p.amount,0);
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
      <span class="fv-lbl">${s.name}</span>
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
      <div class="tl-c"><div class="tl-t">${a.text}</div><div class="tl-d">${u.name} · ${dateStr(a.at)}</div></div></div>`;
  }).join('');

  return `
  <div class="cards-row">
    ${kpi({icon:'money',label:'Выручка за месяц',value:moneyK(monthRevenue),color:'#16a34a',soft:'var(--green-soft)',sub:'<span class="up">▲ 18%</span> к апрелю',subClass:''})}
    ${kpi({icon:'trend',label:'Эффективность продаж',value:conv+'%',color:'#2563eb',sub:`${won.length} из ${deals.length} сделок выиграно`})}
    ${kpi({icon:'wallet',label:'Дебиторка (нам должны)',value:moneyK(debt),color:'#d97706',soft:'var(--amber-soft)',sub:'Открыть отчёт →',act:'go-finance'})}
    ${kpi({icon:'doc',label:'Кредиторка (мы должны)',value:moneyK(payable),color:'#dc2626',soft:'var(--red-soft)',sub:`${DB.payables.length} поставщиков`})}
  </div>
  <div class="cards-row section-gap">
    ${kpi({icon:'funnel',label:'Активные сделки',value:activeLeads,color:'#7c3aed',sub:'в работе сейчас'})}
    ${kpi({icon:'money',label:'Средний чек',value:moneyK(avg),color:'#0891b2'})}
    ${kpi({icon:'production',label:'В производстве',value:inProd,color:'#db2777',sub:'заказов на линии',act:'go-prod'})}
    ${kpi({icon:'money',label:'Всего получено',value:moneyK(revenue),color:'#16a34a'})}
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

  <div class="panel section-gap">
    <div class="panel-h">${icon('clock')}<h3>Последние события</h3></div>
    <div class="panel-b"><div class="timeline">${feed}</div></div>
  </div>`;
}

/* ============ FUNNEL ============ */
function renderFunnel(){
  const totalSum=DB.deals.filter(d=>d.stage!=='done').reduce((s,d)=>s+(d.sum||0),0);
  const cols=STAGES.map(s=>{
    const arr=DB.deals.filter(d=>d.stage===s.id);
    const sum=arr.reduce((a,d)=>a+(d.sum||0),0);
    const cards=arr.map(d=>funnelCard(d)).join('') || `<div class="muted2" style="font-size:12px;text-align:center;padding:14px 0">пусто</div>`;
    return `<div class="kcol" data-stage="${s.id}">
      <div class="kcol-h"><span class="dot-i" style="background:${s.color}"></span><span class="kc-name">${s.name}</span><span class="kc-count">${arr.length}</span><span class="kc-sum">${sum?moneyK(sum):''}</span></div>
      <div class="kcol-b" data-drop="${s.id}">${cards}</div>
    </div>`;
  }).join('');
  return `
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap">
    <div class="tag blue">${icon('funnel','sm')} ${DB.deals.length} сделок</div>
    <div class="tag">в работе: ${moneyK(totalSum)}</div>
    <div style="margin-left:auto"><button class="btn primary" data-act="new-deal">${icon('plus','sm')} Новая сделка</button></div>
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
      <div><div class="kc-client">${cl.name} ${d.hot?icon('flame','sm'):''}</div>
        <div class="kc-addr">${icon('pin','sm')} ${cl.address.split(',').slice(1).join(',').trim()||cl.address}</div></div>
    </div>
    ${d.sum?`<div class="kc-sum">${money(d.sum)}</div>`:`<div class="kc-sum muted2" style="font-size:12.5px;font-weight:600">${d.note||'—'}</div>`}
    ${d.sum&&debt>0&&['prepaid','production','install','done'].includes(d.stage)?`<div style="font-size:11.5px;margin-top:4px" class="tag amber">долг ${moneyK(debt)}</div>`:''}
    <div class="kc-meta">${avatarXs(m.name,d.manager)}<span class="muted2" style="font-size:11.5px">${m.name.split(' ')[0]}</span>
      <span class="kc-days">${icon('clock','sm')} ${days}д</span></div>
  </div>`;
}

/* ============ DEAL MODAL ============ */
function openDeal(id){
  const d=dealById(id); if(!d) return;
  const cl=clientById(d.clientId); const m=userById(d.manager); const st=stageById(d.stage);
  const sum=d.sum||dealItemsSum(d); const paid=dealPaid(d); const debt=Math.max(0,sum-paid);
  const items=(d.items||[]).map(c=>{
    const mat=matById(c.profileId);
    return `<tr><td>${mat?mat.name:'—'} · ${c.w}×${c.h}мм</td><td class="muted">${openById(c.openId)?.name||''}, ${c.sashes} ств.</td><td class="num">${money(constrPrice(c))}</td></tr>`;
  }).join('');
  const pays=(d.payments||[]).map(p=>`<div class="stat-line"><span>${p.type} · ${dateStr(p.date)}</span><span style="color:#4ade80;font-weight:700">+${money(p.amount)}</span></div>`).join('')||'<div class="muted" style="font-size:13px">Оплат пока нет</div>';
  const stageOpts=STAGES.map(s=>`<button class="chip ${s.id===d.stage?'on':''}" data-act="move-stage" data-id="${d.id}" data-stage="${s.id}">${s.name}</button>`).join('');
  const canMoney=seesMoney();
  openModal(`
    <div class="modal-h">
      <span class="av" style="width:42px;height:42px;border-radius:11px;display:grid;place-items:center;background:${colorFor(cl.id)};color:#fff;font-weight:700">${initials(cl.name)}</span>
      <div><h3>${cl.name} ${d.hot?icon('flame','sm'):''}</h3><div class="mh-sub">${cl.phone} · ${cl.address}</div></div>
      <button class="x" data-act="close-modal">${icon('x')}</button>
    </div>
    <div class="modal-b">
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
        <span class="tag" style="border-color:${st.color}55;color:${st.color}"><span class="dot-i" style="background:${st.color}"></span>${st.name}</span>
        <span class="tag">${icon('user','sm')} ${m.name}</span>
        <span class="tag">${icon('layers','sm')} ${d.source}</span>
      </div>
      ${canMoney?`<div class="cards-row" style="grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">
        <div class="kpi" style="padding:12px"><div class="k-lbl">Сумма заказа</div><div class="k-val" style="font-size:19px">${money(sum)}</div></div>
        <div class="kpi" style="padding:12px"><div class="k-lbl">Оплачено</div><div class="k-val" style="font-size:19px;color:#4ade80">${money(paid)}</div></div>
        <div class="kpi" style="padding:12px"><div class="k-lbl">Остаток</div><div class="k-val" style="font-size:19px;color:${debt>0?'#fbbf24':'#4ade80'}">${money(debt)}</div></div>
      </div>`:''}
      ${items?`<div class="panel" style="margin-bottom:16px"><div class="panel-h" style="padding:12px 14px">${icon('ruler','sm')}<h3 style="font-size:13.5px">Конструкции (${d.items.length})</h3></div>
        <table class="tbl"><tbody>${items}</tbody></table></div>`:''}
      ${canMoney?`<div class="panel" style="margin-bottom:16px"><div class="panel-h" style="padding:12px 14px">${icon('money','sm')}<h3 style="font-size:13.5px">Оплаты</h3></div><div class="panel-b" style="padding:12px 14px">${pays}</div></div>`:''}
      <div class="fld full" style="margin-bottom:6px"><label>Сменить стадию</label><div class="chips">${stageOpts}</div></div>
    </div>
    <div class="modal-f">
      <button class="btn green" data-act="wa-deal-chat" data-id="${d.id}">${icon('wa','sm')} Чат WhatsApp</button>
      <button class="btn" data-act="wa-deal" data-id="${d.id}">${icon('send','sm')} Быстрое сообщение</button>
      ${d.stage==='measure'?`<button class="btn soft" data-act="go-measure-deal" data-id="${d.id}">${icon('ruler','sm')} Открыть замер</button>`:''}
      ${canMoney&&debt>0?`<button class="btn primary" data-act="add-payment" data-id="${d.id}">${icon('money','sm')} Принять оплату</button>`:''}
    </div>
  `, true);
}

/* ============ CLIENTS ============ */
function renderClients(){
  const rows=DB.clients.map(cl=>{
    const ds=DB.deals.filter(d=>d.clientId===cl.id);
    const total=ds.reduce((s,d)=>s+(d.sum||0),0);
    const debt=ds.reduce((s,d)=>s+dealDebt(d),0);
    return `<tr class="clickable" data-act="open-client" data-id="${cl.id}">
      <td><div class="cell-name">${avatarXs(cl.name,cl.id)}<div><div style="font-weight:600">${cl.name}</div><div class="muted2" style="font-size:11.5px">${cl.type}</div></div></div></td>
      <td class="muted">${cl.phone}</td>
      <td class="muted">${cl.address}</td>
      <td class="num">${ds.length}</td>
      <td class="num">${total?moneyK(total):'—'}</td>
      <td class="num">${debt>0?`<span class="tag amber">${moneyK(debt)}</span>`:'<span class="muted2">—</span>'}</td>
    </tr>`;
  }).join('');
  return `<div class="panel">
    <div class="panel-h">${icon('clients')}<h3>Клиенты</h3><span class="ph-sub">${DB.clients.length} записей</span>
      <div style="margin-left:auto"><button class="btn primary sm" data-act="new-client">${icon('plus','sm')} Добавить</button></div></div>
    <table class="tbl">
      <thead><tr><th>Клиент</th><th>Телефон</th><th>Адрес</th><th class="num">Сделок</th><th class="num">Сумма</th><th class="num">Долг</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}
function openClient(id){
  const cl=clientById(id); if(!cl) return;
  const ds=DB.deals.filter(d=>d.clientId===cl.id);
  const total=ds.reduce((s,d)=>s+(d.sum||0),0); const paid=ds.reduce((s,d)=>s+dealPaid(d),0);
  const dealRows=ds.map(d=>{const st=stageById(d.stage);
    return `<div class="stat-line"><span><span class="dot-i" style="background:${st.color}"></span> ${st.name} · ${dateStr(d.createdAt)} <span class="muted2">${d.note||''}</span></span><span style="font-weight:700">${d.sum?money(d.sum):'—'}</span></div>`;}).join('')||'<div class="muted">Сделок нет</div>';
  openModal(`
    <div class="modal-h">
      <span class="av" style="width:42px;height:42px;border-radius:11px;display:grid;place-items:center;background:${colorFor(cl.id)};color:#fff;font-weight:700">${initials(cl.name)}</span>
      <div><h3>${cl.name}</h3><div class="mh-sub">${cl.type} · ${cl.phone}</div></div>
      <button class="x" data-act="close-modal">${icon('x')}</button>
    </div>
    <div class="modal-b">
      <div class="cards-row" style="grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">
        <div class="kpi" style="padding:12px"><div class="k-lbl">Сделок</div><div class="k-val" style="font-size:19px">${ds.length}</div></div>
        <div class="kpi" style="padding:12px"><div class="k-lbl">Сумма</div><div class="k-val" style="font-size:19px">${moneyK(total)}</div></div>
        <div class="kpi" style="padding:12px"><div class="k-lbl">Оплачено</div><div class="k-val" style="font-size:19px;color:#4ade80">${moneyK(paid)}</div></div>
      </div>
      <div class="fld full" style="margin-bottom:6px"><label>${icon('pin','sm')} Адрес</label><div style="font-size:13.5px">${cl.address}</div></div>
      <div class="panel" style="margin-top:14px"><div class="panel-h" style="padding:12px 14px">${icon('funnel','sm')}<h3 style="font-size:13.5px">История сделок</h3></div><div class="panel-b" style="padding:12px 14px">${dealRows}</div></div>
    </div>
    <div class="modal-f"><button class="btn" data-act="close-modal">Закрыть</button>
      <button class="btn" data-act="wa-client" data-id="${cl.id}">${icon('send','sm')} Сообщение</button>
      <button class="btn green" data-act="wa-chat" data-id="${cl.id}">${icon('wa','sm')} Чат WhatsApp</button></div>
  `);
}
