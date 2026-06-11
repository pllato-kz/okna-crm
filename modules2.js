'use strict';
/* ============ MEASURE + CALCULATOR (центр «вау») ============ */
function currentMeasureDeal(){
  let d = state.measureDealId ? dealById(state.measureDealId) : null;
  if(!d){ d = DB.deals.find(x=>x.stage==='measure') || DB.deals.find(x=>x.stage==='calc'); if(d) state.measureDealId=d.id; }
  return d;
}
function computeMeasure(d){
  const items=(d.items||[]).map(c=>({c, price:constrPrice(c), area:constrArea(c)*(c.qty||1)}));
  const subtotal=items.reduce((s,i)=>s+i.price,0);
  const discPct=d.discount||0; const discount=Math.round(subtotal*discPct/100);
  const total=subtotal-discount;
  const prepayPct=d.prepayPct!=null?d.prepayPct:30;
  const prepay=Math.round(total*prepayPct/100);
  return {items, subtotal, discPct, discount, total, prepayPct, prepay};
}
function renderMeasure(){
  const queue=DB.deals.filter(d=>d.stage==='measure');
  const d=currentMeasureDeal();
  if(!d){ return `<div class="empty">${icon('ruler')}<h3>Нет заявок на замер</h3><p>Когда менеджер переведёт сделку в стадию «Замер», она появится здесь.</p></div>`; }
  const cl=clientById(d.clientId);
  const queueCards=queue.map(q=>{const qc=clientById(q.clientId);
    return `<button class="acct" style="padding:11px;min-width:230px;${q.id===d.id?'border-color:var(--accent2);background:var(--accent-soft)':''}" data-act="m-pick" data-id="${q.id}">
      <span class="av" style="width:38px;height:38px;background:${colorFor(qc.id)}">${initials(qc.name)}</span>
      <span class="ai"><span class="an" style="font-size:13.5px">${qc.name}</span><span class="at">${qc.address.split(',').slice(1,2).join('')||qc.address}</span></span>
    </button>`;}).join('');

  const calc=computeMeasure(d);
  const constrs=(d.items||[]).map((c,i)=>constrCard(c,i)).join('') || `<div class="empty" style="padding:30px">${icon('ruler')}<p>Добавьте первую конструкцию</p></div>`;

  return `
  <div style="margin-bottom:16px">
    <div class="muted" style="font-size:12px;margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">Заявки на замер (${queue.length})</div>
    <div style="display:flex;gap:10px;overflow-x:auto;padding-bottom:6px">${queueCards||'<span class="muted">нет очереди</span>'}</div>
  </div>
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap;padding:14px;background:var(--panel);border:1px solid var(--line);border-radius:var(--radius)">
    <span class="av" style="width:44px;height:44px;border-radius:11px;display:grid;place-items:center;background:${colorFor(cl.id)};color:#fff;font-weight:700">${initials(cl.name)}</span>
    <div><div style="font-weight:700;font-size:15px">${cl.name}</div><div class="muted" style="font-size:12.5px">${icon('pin','sm')} ${cl.address}</div></div>
    <a class="btn sm" style="margin-left:auto" href="tel:${cl.phone.replace(/\s/g,'')}">${icon('phone','sm')} ${cl.phone}</a>
  </div>
  <div class="measure-grid">
    <div>
      <div style="display:flex;align-items:center;margin-bottom:12px">
        <h3 style="font-size:15px">Конструкции на объекте</h3>
        <button class="btn primary sm" style="margin-left:auto" data-act="m-add">${icon('plus','sm')} Добавить конструкцию</button>
      </div>
      <div class="constr-list">${constrs}</div>
    </div>
    <div class="summary">
      <div class="panel">
        <div class="panel-h">${icon('money','sm')}<h3 style="font-size:14px">Итоговый расчёт</h3></div>
        <div class="panel-b" id="measure-summary">${summaryBlock(d)}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:14px">
        <button class="btn primary" data-act="gen-kp" data-id="${d.id}" ${(d.items||[]).length?'':'disabled'}>${icon('doc','sm')} Сформировать КП</button>
        <button class="btn green" data-act="quick-prepay" data-id="${d.id}" ${(d.items||[]).length?'':'disabled'}>${icon('money','sm')} Принять предоплату на месте</button>
      </div>
      <div class="muted2" style="font-size:11.5px;margin-top:10px;line-height:1.5">Замерщик собирает заказ на планшете, система сразу считает стоимость, формирует КП и принимает аванс — клиент не уходит «подумать».</div>
    </div>
  </div>`;
}
function constrCard(c,i){
  const m=matById(c.profileId);
  const profOpts=DB.materials.map(o=>`<option value="${o.id}" ${o.id===c.profileId?'selected':''}>${o.name} · ${o.series}</option>`).join('');
  const glassOpts=GLASS.map(g=>`<option value="${g.id}" ${g.id===c.glassId?'selected':''}>${g.name}</option>`).join('');
  const openChips=OPENINGS.map(o=>`<button class="chip ${o.id===c.openId?'on':''}" data-act="m-open" data-cid="${c.id}" data-v="${o.id}">${o.name}</button>`).join('');
  const extras=EXTRAS.map(e=>`<button class="ex-toggle ${(c.extras||[]).includes(e.id)?'on':''}" data-act="m-extra" data-cid="${c.id}" data-v="${e.id}">${(c.extras||[]).includes(e.id)?icon('check','sm'):icon('plus','sm')} ${e.name}</button>`).join('');
  const sashes=[]; for(let s=0;s<(c.sashes||1);s++){ const cls=c.openId==='tilt'?'tilt':(c.openId==='turn'?'turn':''); sashes.push(`<div class="win-sash ${cls}"></div>`); }
  return `<div class="constr" data-cid="${c.id}">
    <div class="constr-h">
      <span class="ci">${icon('ruler','sm')}</span>
      <span class="cn">Конструкция ${i+1} · ${m?m.type:''}</span>
      <span class="cp" id="cprice-${c.id}">${money(constrPrice(c))}</span>
      <button class="x" style="width:30px;height:30px" data-act="m-del" data-cid="${c.id}">${icon('x','sm')}</button>
    </div>
    <div class="constr-body">
      <div class="fld"><label>Ширина, мм</label><input type="number" value="${c.w}" data-mnum data-cid="${c.id}" data-field="w"></div>
      <div class="fld"><label>Высота, мм</label><input type="number" value="${c.h}" data-mnum data-cid="${c.id}" data-field="h"></div>
      <div class="fld full"><label>Профиль / серия</label><select data-act="m-profile" data-cid="${c.id}">${profOpts}</select></div>
      <div class="fld full"><label>Стеклопакет</label><select data-act="m-glass" data-cid="${c.id}">${glassOpts}</select></div>
      <div class="fld"><label>Открывание</label><div class="chips">${openChips}</div></div>
      <div class="fld"><label>Створок</label><input type="number" min="1" max="5" value="${c.sashes||1}" data-mnum data-cid="${c.id}" data-field="sashes"></div>
      <div class="win-preview">${sashes.join('')}</div>
      <div class="fld full"><label>Доп. опции</label><div class="extras">${extras}</div></div>
      <div class="fld"><label>Количество, шт</label><input type="number" min="1" value="${c.qty||1}" data-mnum data-cid="${c.id}" data-field="qty"></div>
      <div class="fld"><label>Площадь</label><div style="font-size:14px;font-weight:600;padding:9px 0" id="carea-${c.id}">${(constrArea(c)*(c.qty||1)).toFixed(2)} м²</div></div>
    </div>
  </div>`;
}
function summaryBlock(d){
  const k=computeMeasure(d);
  return `
    <div class="sum-line">Конструкций <span class="v">${(d.items||[]).length}</span></div>
    <div class="sum-line">Сумма по позициям <span class="v" id="sum-sub">${money(k.subtotal)}</span></div>
    <div class="sum-line">Скидка
      <span class="v" style="display:flex;align-items:center;gap:6px">
        <input type="number" min="0" max="30" value="${k.discPct}" data-act="m-discount" data-id="${d.id}" style="width:54px;background:var(--bg2);border:1px solid var(--line);border-radius:7px;padding:5px;color:var(--txt);text-align:right">%
        <span id="sum-disc" style="color:#f87171">−${money(k.discount)}</span>
      </span>
    </div>
    <div class="sum-line total">Итого <span id="sum-total">${money(k.total)}</span></div>
    <div class="sum-line" style="margin-top:8px">Предоплата
      <span class="v" style="display:flex;align-items:center;gap:6px">
        <input type="number" min="0" max="100" value="${k.prepayPct}" data-act="m-prepay" data-id="${d.id}" style="width:54px;background:var(--bg2);border:1px solid var(--line);border-radius:7px;padding:5px;color:var(--txt);text-align:right">%
        <span id="sum-prepay" style="color:#fbbf24;font-weight:700">${money(k.prepay)}</span>
      </span>
    </div>`;
}
function patchMeasure(){
  const d=currentMeasureDeal(); if(!d) return;
  (d.items||[]).forEach(c=>{
    const pe=document.getElementById('cprice-'+c.id); if(pe) pe.textContent=money(constrPrice(c));
    const ae=document.getElementById('carea-'+c.id); if(ae) ae.textContent=(constrArea(c)*(c.qty||1)).toFixed(2)+' м²';
  });
  const k=computeMeasure(d);
  const set=(id,v)=>{const e=document.getElementById(id); if(e) e.textContent=v;};
  set('sum-sub',money(k.subtotal)); set('sum-disc','−'+money(k.discount)); set('sum-total',money(k.total)); set('sum-prepay',money(k.prepay));
}
function initMeasureBindings(){
  document.querySelectorAll('[data-mnum]').forEach(inp=>{
    inp.addEventListener('input',()=>{
      const d=currentMeasureDeal(); if(!d) return;
      const c=(d.items||[]).find(x=>x.id===inp.dataset.cid); if(!c) return;
      let v=parseFloat(inp.value)||0; if(inp.dataset.field==='sashes'){v=Math.max(1,Math.min(5,Math.round(v)));} if(inp.dataset.field==='qty'){v=Math.max(1,Math.round(v));}
      c[inp.dataset.field]=v; saveDB(); patchMeasure();
      if(window.API && API.enabled) API.persist.saveItem(c).catch(()=>{});
    });
  });
}
/* KP doc */
/* Разметка КП — общая для модалки и для окна печати */
function kpDocHtml(d){
  const cl=clientById(d.clientId); const k=computeMeasure(d);
  const rows=(d.items||[]).map((c,i)=>{const m=matById(c.profileId);
    return `<tr><td>${i+1}</td><td>${m.name} (${m.series})<br><span style="color:#64748b">${c.w}×${c.h}мм, ${openById(c.openId).name}, ${c.sashes} ств., ${glassById(c.glassId).name}</span></td><td style="text-align:center">${c.qty||1}</td><td style="text-align:right">${money(constrPrice(c))}</td></tr>`;}).join('');
  return `<div class="kp-doc">
        <div class="kp-co"><div><h2>${DB.company.name}</h2><div style="color:#64748b;font-size:12px">${DB.company.legal} · ${DB.company.city}<br>${DB.company.phone}</div></div>
          <div style="text-align:right;font-size:12px;color:#64748b">КП №${d.id.replace('d','')}-${new Date().getFullYear()}<br>${dateFull(SEED_NOW)}</div></div>
        <div style="font-size:13px;margin-bottom:6px">Заказчик: <b>${cl.name}</b>, ${cl.address}</div>
        <table><thead><tr><th>№</th><th>Наименование</th><th style="text-align:center">Кол-во</th><th style="text-align:right">Стоимость</th></tr></thead><tbody>${rows}</tbody></table>
        <div style="text-align:right;color:#64748b;font-size:12.5px">Сумма: ${money(k.subtotal)}${k.discount?` · Скидка: −${money(k.discount)}`:''}</div>
        <div class="kp-tot">Итого к оплате: ${money(k.total)}</div>
        <div class="kp-pre"><b>Предоплата ${k.prepayPct}%: ${money(k.prepay)}</b><br><span style="font-size:12px">Остальное — после монтажа. Срок изготовления 4–6 недель. Гарантия 5 лет.</span></div>
      </div>`;
}
function openKp(id){
  const d=dealById(id); if(!d) return; const cl=clientById(d.clientId); const k=computeMeasure(d);
  openModal(`
    <div class="modal-h">${icon('doc')}<div><h3>Коммерческое предложение</h3><div class="mh-sub">${cl.name} · сформировано ${dateFull(SEED_NOW)}</div></div><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b">
      ${kpDocHtml(d)}
    </div>
    <div class="modal-f">
      <button class="btn" data-act="print-kp" data-id="${d.id}">${icon('doc','sm')} Печать / PDF</button>
      <button class="btn" data-act="wa-deal" data-id="${d.id}">${icon('wa','sm')} Отправить в WhatsApp</button>
      <button class="btn green" data-act="confirm-prepay" data-id="${d.id}">${icon('money','sm')} Принять предоплату ${money(k.prepay)}</button>
    </div>
  `, true);
}
/* Печать КП: открываем отдельный чистый документ и вызываем печать (можно «Сохранить как PDF») */
function printKp(id){
  const d=dealById(id); if(!d) return; const cl=clientById(d.clientId);
  const w=window.open('','_blank','width=840,height=960');
  if(!w){ toast('Разрешите всплывающие окна, чтобы распечатать КП','warn'); return; }
  const css=`*{box-sizing:border-box} body{margin:0;background:#fff;font-family:Inter,system-ui,-apple-system,Arial,sans-serif;color:#1a2233}
    .wrap{max-width:720px;margin:0 auto;padding:28px}
    .kp-doc h2{font-size:18px;color:#0b1220;margin:0 0 4px}
    .kp-doc .kp-co{display:flex;justify-content:space-between;border-bottom:2px solid #e5e9f0;padding-bottom:14px;margin-bottom:14px}
    .kp-doc table{width:100%;border-collapse:collapse;margin:14px 0;font-size:12.5px}
    .kp-doc th{background:#f1f4f9;text-align:left;padding:9px 10px;color:#475569;font-size:11px;text-transform:uppercase}
    .kp-doc td{padding:9px 10px;border-bottom:1px solid #eef1f6}
    .kp-doc .kp-tot{text-align:right;font-size:16px;font-weight:800;color:#0b1220;margin-top:6px}
    .kp-doc .kp-pre{background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 14px;margin-top:14px;color:#1e3a8a}
    @page{margin:14mm}`;
  w.document.write(`<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>КП — ${cl.name}</title><style>${css}</style></head><body><div class="wrap">${kpDocHtml(d)}</div><script>window.onload=function(){window.focus();window.print();};<\/script></body></html>`);
  w.document.close();
}

/* ============ WAREHOUSE ============ */
function renderWarehouse(){
  const showCost=seesMoney();
  const tab=state.whTab;
  const moves=(DB.movements||[]);
  const actCell=(itId,knd)=>`<td style="text-align:right;white-space:nowrap"><div class="row-acts" style="display:inline-flex;gap:6px;justify-content:flex-end">
    <button class="btn sm" data-act="wh-receive" data-id="${itId}" data-kind="${knd}">${icon('plus','sm')} Приход</button>
    <button class="btn sm danger" data-act="wh-writeoff" data-id="${itId}" data-kind="${knd}">${icon('trash','sm')} Расход</button></div></td>`;
  const tabs=`<div class="tabs"><button class="tab ${tab==='profile'?'on':''}" data-act="wh-tab" data-v="profile">Профиль (${DB.materials.length})</button>
    <button class="tab ${tab==='comp'?'on':''}" data-act="wh-tab" data-v="comp">Стеклопакеты и фурнитура (${DB.components.length})</button>
    <button class="tab ${tab==='moves'?'on':''}" data-act="wh-tab" data-v="moves">Движения (${moves.length})</button></div>`;
  let body;
  if(tab==='profile'){
    const rows=DB.materials.map(m=>{const low=m.stock<m.min; const pct=Math.min(100,m.stock/(m.min*2)*100);
      return `<tr><td><div style="font-weight:600">${m.name}</div><div class="muted2" style="font-size:11.5px">${m.supplier}</div></td>
        <td><span class="tag ${m.type==='ПВХ'?'cyan':'violet'}">${m.type}</span></td>
        <td><span class="tag ${m.series==='Премиум'?'amber':m.series==='Средняя'?'blue':''}">${m.series}</span></td>
        ${showCost?`<td class="num">${money(m.rate)}/м²</td>`:''}
        <td style="min-width:160px"><div style="display:flex;align-items:center;gap:10px"><div class="mini-bar"><i style="width:${pct}%;background:${low?'var(--red)':'var(--green)'}"></i></div><span style="font-weight:700;white-space:nowrap">${m.stock} ${m.unit}</span></div></td>
        <td>${low?`<span class="tag red">${icon('alert','sm')} мало</span>`:'<span class="tag green">в норме</span>'}</td>
        ${actCell(m.id,'mat')}</tr>`;}).join('');
    body=`<div class="tbl-scroll"><table class="tbl"><thead><tr><th>Профиль</th><th>Тип</th><th>Серия</th>${showCost?'<th class="num">Цена</th>':''}<th>Остаток</th><th>Статус</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
  } else if(tab==='comp'){
    const rows=DB.components.map(c=>{const low=c.stock<c.min; const pct=Math.min(100,c.stock/(c.min*2)*100);
      return `<tr><td style="font-weight:600">${c.name}</td>
        <td style="min-width:200px"><div style="display:flex;align-items:center;gap:10px"><div class="mini-bar"><i style="width:${pct}%;background:${low?'var(--red)':'var(--green)'}"></i></div><span style="font-weight:700;white-space:nowrap">${c.stock} ${c.unit}</span></div></td>
        <td class="muted">мин. ${c.min}</td>
        <td>${low?`<span class="tag red">${icon('alert','sm')} дозаказать</span>`:'<span class="tag green">в норме</span>'}</td>
        ${actCell(c.id,'comp')}</tr>`;}).join('');
    body=`<div class="tbl-scroll"><table class="tbl"><thead><tr><th>Наименование</th><th>Остаток</th><th>Минимум</th><th>Статус</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
  } else {
    const ft=state.whMoveType||'all', fp=state.whMovePeriod||'all';
    // фильтр по типу операции
    const byType=m=> ft==='all' ? true : (ft==='out' ? moveType(m.type).dir==='out' : m.type===ft);
    // фильтр по периоду (относительно SEED_NOW — «сейчас» демо)
    const fromTs = fp==='all' ? 0 : (SEED_NOW.getTime() - parseInt(fp,10)*86400000);
    const byPeriod=m=> fp==='all' ? true : (new Date(m.at).getTime() >= fromTs);
    const filtered=moves.filter(m=>byType(m)&&byPeriod(m));
    const list=filtered.slice().sort((a,b)=>String(b.at||'').localeCompare(String(a.at||''))).slice(0,120);
    const typeChips=[['all','Все'],['receipt','Приход'],['production','В производство'],['writeoff','Брак'],['return','Возврат'],['adjust','Корректировка']]
      .map(([v,l])=>`<button class="chip ${ft===v?'on':''}" data-act="wh-mv-type" data-v="${v}">${l}</button>`).join('');
    const periodChips=[['all','Всё время'],['30','30 дней'],['7','7 дней']]
      .map(([v,l])=>`<button class="chip ${fp===v?'on':''}" data-act="wh-mv-period" data-v="${v}">${l}</button>`).join('');
    const rows=list.map(m=>{const mt=moveType(m.type); const u=userById(m.who);
      const qcell=m.dir==='in'
        ? `<span style="color:#4ade80;font-weight:700;white-space:nowrap">+${m.qty} ${m.unit||''}</span>`
        : `<span style="color:#f87171;font-weight:700;white-space:nowrap">−${m.qty} ${m.unit||''}</span>`;
      return `<tr><td class="muted" style="white-space:nowrap">${dateStr(m.at)}</td>
        <td style="font-weight:600">${m.name||m.itemId}</td>
        <td><span class="tag ${mt.color}">${mt.dir==='in'?icon('arrow','sm'):icon('trash','sm')} ${mt.label}</span></td>
        <td class="muted">${m.reason||'—'}</td>
        <td class="num">${qcell}</td>
        <td class="muted" style="white-space:nowrap">${u?u.name:'—'}</td></tr>`;}).join('');
    const inSum=filtered.filter(m=>m.dir==='in').length, outSum=filtered.filter(m=>m.dir==='out').length;
    body=`<div style="padding:14px 18px;border-bottom:1px solid var(--line)">
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px"><span class="muted2" style="font-size:11.5px;min-width:64px">Операция</span><div class="chips">${typeChips}</div></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><span class="muted2" style="font-size:11.5px;min-width:64px">Период</span><div class="chips">${periodChips}</div></div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:12px;font-size:12.5px;color:var(--muted)">
          <span class="tag green">${inSum} прихода</span><span class="tag red">${outSum} расхода</span><span>найдено: ${filtered.length}</span></div></div>
      <div class="tbl-scroll"><table class="tbl"><thead><tr><th>Дата</th><th>Позиция</th><th>Операция</th><th>Причина</th><th class="num">Кол-во</th><th>Сотрудник</th></tr></thead>
      <tbody>${rows||'<tr><td colspan=6 class="muted" style="text-align:center;padding:30px">Нет движений по выбранным фильтрам</td></tr>'}</tbody></table></div>`;
  }
  const low=[...DB.materials,...DB.components].filter(x=>x.stock<x.min).length;
  return `
  <div class="cards-row" style="grid-template-columns:repeat(auto-fit,minmax(190px,1fr));margin-bottom:16px">
    ${kpi({icon:'box',label:'Позиций на складе',value:DB.materials.length+DB.components.length,color:'#2563eb'})}
    ${kpi({icon:'alert',label:'Ниже минимума',value:low,color:'#dc2626',soft:'var(--red-soft)',sub:low?'нужен дозаказ':'всё в норме'})}
    ${kpi({icon:'layers',label:'Движений в журнале',value:moves.length,color:'#7c3aed',sub:'приход + расход'})}
  </div>
  <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px">${tabs}<button class="btn sm" style="margin-left:auto" data-act="export" data-what="warehouse">${icon('doc','sm')} Экспорт</button></div>
  <div class="panel"><div class="panel-h">${icon('warehouse')}<h3>${tab==='moves'?'Журнал движений':'Остатки на складе'}</h3><span class="ph-sub">${DB.company.city}</span></div>${body}</div>`;
}

/* ============ PRODUCTION ============ */
function renderProduction(){
  const orders=DB.deals.filter(d=>['production','install'].includes(d.stage));
  const cols=PROD_STAGES.map(ps=>{
    const arr=orders.filter(d=>(d.prodStage||'queue')===ps.id);
    const cards=arr.map(d=>{const cl=clientById(d.clientId);
      const spec=(d.items||[]).map(c=>`${matById(c.profileId)?.type||''} ${c.w}×${c.h}`).slice(0,3).join(' · ');
      const winCount=(d.items||[]).reduce((s,c)=>s+(c.qty||1),0);
      return `<div class="kcard" draggable="true" data-pcard="${d.id}" data-act="open-prod" data-id="${d.id}" style="border-left-color:#db2777">
        <div class="kc-client">${cl.name}</div>
        <div class="kc-addr">${icon('box','sm')} ${winCount} констр.</div>
        <div class="muted2" style="font-size:11.5px;margin-top:8px">${spec||'—'}</div>
        <div class="kc-meta"><span class="tag" style="font-size:10.5px">${stageById(d.stage).name}</span><span class="kc-days">${icon('pin','sm')} ${cl.address.split(',')[0]}</span></div>
      </div>`;}).join('')||`<div class="muted2" style="font-size:12px;text-align:center;padding:14px 0">пусто</div>`;
    return `<div class="kcol" style="flex-basis:250px"><div class="kcol-h"><span class="kc-name">${ps.name}</span><span class="kc-count">${arr.length}</span></div><div class="kcol-b" data-pdrop="${ps.id}">${cards}</div></div>`;
  }).join('');
  return `
  <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap">
    <div class="tag violet">${icon('production','sm')} ${orders.length} заказов на линии</div>
    <div class="tag">Цех: ${DB.company.workshop}</div>
    ${!seesMoney()?'<div class="tag">режим производства — финансы скрыты</div>':''}
  </div>
  <div class="kanban">${cols}</div>
  <div class="muted2" style="font-size:12px;margin-top:12px">Перетаскивайте заказы по этапам: резка профиля → стеклопакет → сборка → готово → монтаж.</div>`;
}
function openProd(id){
  const d=dealById(id); if(!d) return; const cl=clientById(d.clientId);
  const items=(d.items||[]).map((c,i)=>{const m=matById(c.profileId);
    return `<tr><td>${i+1}</td><td>${m.name}</td><td>${c.w}×${c.h}мм</td><td>${glassById(c.glassId).name}</td><td>${openById(c.openId).name}, ${c.sashes}ств</td><td style="text-align:center">${c.qty||1}</td></tr>`;}).join('');
  const stageOpts=PROD_STAGES.map(s=>`<button class="chip ${s.id===(d.prodStage||'queue')?'on':''}" data-act="move-prod" data-id="${d.id}" data-stage="${s.id}">${s.name}</button>`).join('');
  openModal(`
    <div class="modal-h">${icon('production')}<div><h3>Заказ · ${cl.name}</h3><div class="mh-sub">${icon('pin','sm')} ${cl.address}</div></div><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b">
      <div class="panel" style="margin-bottom:16px"><div class="panel-h" style="padding:12px 14px">${icon('ruler','sm')}<h3 style="font-size:13.5px">Спецификация (для цеха)</h3></div>
        <table class="tbl"><thead><tr><th>№</th><th>Профиль</th><th>Размер</th><th>Стеклопакет</th><th>Открывание</th><th style="text-align:center">Шт</th></tr></thead><tbody>${items}</tbody></table></div>
      <div class="fld full"><label>Этап производства</label><div class="chips">${stageOpts}</div></div>
    </div>
    <div class="modal-f"><button class="btn" data-act="close-modal">Закрыть</button></div>
  `, true);
}

/* ============ FINANCE ============ */
function renderFinance(){
  const tab=state.financeTab;
  const tabs=`<div class="tabs">
    <button class="tab ${tab==='recv'?'on':''}" data-act="fin-tab" data-v="recv">Дебиторка</button>
    <button class="tab ${tab==='pay'?'on':''}" data-act="fin-tab" data-v="pay">Кредиторка</button>
    <button class="tab ${tab==='pl'?'on':''}" data-act="fin-tab" data-v="pl">Отчётность</button></div>`;
  const debtors=DB.deals.filter(d=>dealDebt(d)>0 && d.sum>0);
  const totalDebt=debtors.reduce((s,d)=>s+dealDebt(d),0);
  const totalPay=DB.payables.reduce((s,p)=>s+p.amount,0);
  let body;
  if(tab==='recv'){
    const rows=debtors.map(d=>{const cl=clientById(d.clientId); const debt=dealDebt(d); const paid=dealPaid(d);
      const overdue=['done'].includes(d.stage);
      return `<tr><td><div class="cell-name">${avatarXs(cl.name,cl.id)}<span style="font-weight:600">${cl.name}</span></div></td>
        <td class="muted">${stageById(d.stage).name}</td>
        <td class="num">${money(d.sum)}</td><td class="num" style="color:#4ade80">${money(paid)}</td>
        <td class="num" style="color:#fbbf24;font-weight:700">${money(debt)}</td>
        <td>${overdue?'<span class="tag red">требует оплаты</span>':'<span class="tag amber">в графике</span>'}</td>
        <td><button class="btn green sm" data-act="add-payment" data-id="${d.id}">${icon('money','sm')} Оплата</button></td></tr>`;}).join('');
    body=`<div class="tbl-scroll"><table class="tbl"><thead><tr><th>Клиент</th><th>Стадия</th><th class="num">Заказ</th><th class="num">Оплачено</th><th class="num">Долг</th><th>Статус</th><th></th></tr></thead><tbody>${rows||'<tr><td colspan=7 class="muted" style="text-align:center;padding:30px">Дебиторки нет</td></tr>'}</tbody></table></div>`;
  } else if(tab==='pay'){
    const rows=DB.payables.map(p=>`<tr><td style="font-weight:600">${p.supplier}</td><td class="muted">${p.forWhat}</td>
      <td class="num" style="font-weight:700">${money(p.amount)}</td><td class="muted">${dateFull(p.due)}</td>
      <td>${p.status==='просрочено'?'<span class="tag red">просрочено</span>':'<span class="tag amber">ожидает</span>'}</td></tr>`).join('');
    body=`<div class="tbl-scroll"><table class="tbl"><thead><tr><th>Поставщик</th><th>За что</th><th class="num">Сумма</th><th>Срок</th><th>Статус</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  } else {
    const revenue=DB.deals.reduce((s,d)=>s+dealPaid(d),0);
    const orders=DB.deals.filter(d=>d.sum>0).reduce((s,d)=>s+d.sum,0);
    const cost=Math.round(revenue*0.56); const margin=revenue-cost;
    const won=DB.deals.filter(d=>['production','install','done'].includes(d.stage)).length;
    const conv=Math.round(won/Math.max(1,DB.deals.length)*100);
    const stageRows=STAGES.map(s=>{const cnt=DB.deals.filter(d=>stageIndex(d.stage)>=stageIndex(s.id)).length;
      return {label:s.name,value:cnt,display:cnt,color:`linear-gradient(90deg,${s.color},${s.color}cc)`};});
    body=`
      <div class="cards-row" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr));margin-bottom:18px">
        ${kpi({icon:'money',label:'Получено (касса)',value:moneyK(revenue),color:'#16a34a',soft:'var(--green-soft)'})}
        ${kpi({icon:'doc',label:'Законтрактовано',value:moneyK(orders),color:'#2563eb'})}
        ${kpi({icon:'trend',label:'Себестоимость',value:moneyK(cost),color:'#dc2626',soft:'var(--red-soft)'})}
        ${kpi({icon:'wallet',label:'Маржа',value:moneyK(margin),color:'#7c3aed',sub:Math.round(margin/Math.max(1,revenue)*100)+'% рентабельность'})}
      </div>
      <div class="grid-2b">
        <div class="panel"><div class="panel-h">${icon('funnel','sm')}<h3>Конверсия по этапам</h3><span class="ph-sub">${conv}% доходимость</span></div><div class="panel-b">${bars(stageRows)}</div></div>
        <div class="panel"><div class="panel-h">${icon('trend','sm')}<h3>Выручка по месяцам</h3></div><div class="panel-b">${bars([['дек',3.1],['янв',3.8],['фев',4.2],['мар',3.6],['апр',4.9],['май',revenue/1e6]].map((r,i,a)=>({label:r[0],value:r[1],display:r[1].toFixed(1)+' млн',color:i===a.length-1?'linear-gradient(90deg,#16a34a,#4ade80)':'linear-gradient(90deg,#2563eb,#3b82f6)'})))}</div></div>
      </div>`;
  }
  return `
  <div class="cards-row" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr));margin-bottom:16px">
    ${kpi({icon:'wallet',label:'Нам должны (дебиторка)',value:moneyK(totalDebt),color:'#d97706',soft:'var(--amber-soft)',sub:debtors.length+' клиентов'})}
    ${kpi({icon:'doc',label:'Мы должны (кредиторка)',value:moneyK(totalPay),color:'#dc2626',soft:'var(--red-soft)',sub:DB.payables.length+' поставщиков'})}
    ${kpi({icon:'trend',label:'Сальдо',value:moneyK(totalDebt-totalPay),color:(totalDebt-totalPay)>=0?'#16a34a':'#dc2626'})}
  </div>
  <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px">${tabs}<button class="btn sm" style="margin-left:auto" data-act="export" data-what="finance">${icon('doc','sm')} Экспорт</button></div>
  <div class="panel">${body}</div>`;
}

/* ============ SETTINGS ============ */
function renderSettings(){
  const dir = state.user && state.user.role==='director'; // редактирование — только директор
  const emps=DB.users.map(u=>{
    const self = state.user && state.user.id===u.id;
    const acts = dir ? `<td class="row-acts">
      <button class="btn sm ghost" data-act="edit-user" data-id="${u.id}" title="Изменить">${icon('edit','sm')}</button>
      ${self?'':`<button class="btn sm ghost" data-act="del-user" data-id="${u.id}" title="Удалить">${icon('trash','sm')}</button>`}</td>` : '';
    return `<tr><td><div class="cell-name">${avatarXs(u.name,u.id)}<span style="font-weight:600">${u.name}</span></div></td>
      <td><span class="tag blue">${roleRu(u.role)}</span></td><td class="muted">${u.title}</td>${acts}</tr>`;
  }).join('');
  const mods=Object.keys(MODULE_META);
  const roles=['director','manager','surveyor','production','warehouse'];
  const permHead=`<tr><th>Модуль</th>${roles.map(r=>`<th style="text-align:center">${roleRu(r)}</th>`).join('')}</tr>`;
  const permRows=mods.map(mod=>`<tr><td>${icon(MODULE_META[mod].icon,'sm')} ${MODULE_META[mod].name}</td>${roles.map(r=>{
    const ok=(MODULE_ROLES[mod]||[]).includes(r);
    const inner = ok?`<span class="yes">${icon('check','sm')}</span>`:'<span class="no">—</span>';
    return dir
      ? `<td style="text-align:center"><button class="perm-cell${ok?' on':''}" data-act="perm-toggle" data-mod="${mod}" data-role="${r}" title="${ok?'Доступ открыт — нажмите, чтобы закрыть':'Доступ закрыт — нажмите, чтобы открыть'}">${inner}</button></td>`
      : `<td style="text-align:center">${inner}</td>`;}).join('')}</tr>`).join('');
  const coEdit = dir ? `<button class="btn sm ghost" style="margin-left:auto" data-act="edit-company">${icon('edit','sm')} Изменить</button>` : '';
  const usAdd  = dir ? `<button class="btn sm" style="margin-left:auto" data-act="add-user">${icon('plus','sm')} Добавить</button>` : '';
  const wa = (typeof waConfig==='object'&&waConfig) ? waConfig : {configured:false,enabled:false,idInstance:''};
  const waOn = wa.enabled && wa.configured;
  const waPanel = dir ? `
  <div class="panel section-gap"><div class="panel-h">${icon('wa')}<h3>WhatsApp · Green API</h3>
    <span class="ph-sub">${waOn?'<span class="tag green">подключено</span>':(wa.configured?'<span class="tag amber">выключено</span>':'<span class="tag">не настроено</span>')}</span></div>
    <div class="panel-b">
      <div class="constr-body" style="padding:0">
        <div class="fld"><label>idInstance</label><input id="wa-id" value="${escA(wa.idInstance||'')}" placeholder="напр. 1101000001"></div>
        <div class="fld"><label>apiTokenInstance</label><input id="wa-token" type="password" placeholder="${wa.configured?'•••••••• (задан, оставьте пустым чтобы не менять)':'вставьте токен'}"></div>
        <div class="fld full"><label style="display:flex;align-items:center;gap:9px;font-size:13px;color:var(--txt);text-transform:none"><input type="checkbox" id="wa-enabled" ${wa.enabled?'checked':''} style="width:auto"> Включить отправку сообщений через Green API</label></div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;align-items:center">
        <button class="btn primary" data-act="wa-save-config">${icon('check','sm')} Сохранить</button>
        <button class="btn" data-act="wa-check">${icon('refresh','sm')} Проверить подключение</button>
        <span id="wa-status" class="muted2" style="font-size:12px"></span>
      </div>
      ${wa.webhookUrl?`<div class="fld full" style="margin-top:14px"><label>URL вебхука (для приёма входящих)</label>
        <input readonly value="${escA(wa.webhookUrl)}" style="font-size:11.5px">
        <div style="margin-top:8px"><button class="btn sm" data-act="wa-setup-webhook">${icon('arrow','sm')} Подключить приём (зарегистрировать в Green API)</button></div></div>`:''}
      <div class="muted2" style="font-size:11.5px;margin-top:10px;line-height:1.5">Данные инстанса — в личном кабинете Green API (idInstance и apiTokenInstance). Токен хранится на сервере и в браузер не передаётся. Когда инстанс включён — кнопки WhatsApp шлют реально, а входящие приходят в «Чат WhatsApp» карточки клиента (двусторонний чат).</div>
    </div></div>` : '';
  return `
  <div class="grid-2b">
    <div class="panel"><div class="panel-h">${icon('settings')}<h3>Компания</h3>${coEdit}</div><div class="panel-b">
      <div class="stat-line"><span>Название</span><span style="font-weight:600">${DB.company.legal}</span></div>
      <div class="stat-line"><span>Город</span><span>${DB.company.city}</span></div>
      <div class="stat-line"><span>Телефон</span><span>${DB.company.phone}</span></div>
      <div class="stat-line"><span>Производство</span><span>${DB.company.workshop}</span></div>
      <div class="stat-line"><span>Оборот</span><span>${DB.company.revenueYear}</span></div>
    </div></div>
    <div class="panel"><div class="panel-h">${icon('clients')}<h3>Сотрудники</h3><span class="ph-sub">${DB.users.length}</span>${usAdd}</div>
      <table class="tbl"><tbody>${emps}</tbody></table></div>
  </div>
  <div class="panel section-gap"><div class="panel-h">${icon('shield')}<h3>Права доступа</h3><span class="ph-sub">${dir?'нажмите на ячейку, чтобы открыть/закрыть доступ роли к модулю':'кто что видит — сборщики и склад не видят финансы'}</span></div>
    <div class="tbl-scroll"><table class="tbl perm-tbl"><thead>${permHead}</thead><tbody>${permRows}</tbody></table></div></div>
  ${waPanel}
  <div class="panel section-gap"><div class="panel-h">${icon('refresh')}<h3>Демо-данные</h3></div><div class="panel-b">
    <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap"><span class="muted" style="font-size:13px">Сбросить все изменения и вернуть исходные демо-данные.</span>
    <button class="btn danger" data-act="reset">${icon('refresh','sm')} Сбросить демо</button></div></div></div>`;
}
