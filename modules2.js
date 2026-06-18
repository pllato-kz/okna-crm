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
      <span class="ai"><span class="an" style="font-size:13.5px">${escA(qc.name)}</span><span class="at">${escA(qc.address.split(',').slice(1,2).join('')||qc.address)}</span></span>
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
    <div><div style="font-weight:700;font-size:15px">${escA(cl.name)}</div><div class="muted" style="font-size:12.5px">${icon('pin','sm')} ${escA(cl.address)}</div></div>
    <div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap">
      ${canWa()?`<button class="btn green sm" data-act="wa-deal-chat" data-id="${d.id}">${icon('wa','sm')} Чат WhatsApp</button>`:''}
      <a class="btn sm" href="tel:${escA(cl.phone.replace(/\s/g,''))}">${icon('phone','sm')} ${escA(cl.phone)}</a>
    </div>
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
        <button class="btn soft" data-act="gen-kp" data-id="${d.id}" ${(d.items||[]).length?'':'disabled'}>${icon('doc','sm')} Сформировать КП</button>
        <button class="btn primary" data-act="quick-prepay" data-id="${d.id}" ${(d.items||[]).length?'':'disabled'}>${icon('money','sm')} Принять предоплату на месте</button>
      </div>
      <div class="muted2" style="font-size:11.5px;margin-top:10px;line-height:1.5">Замерщик собирает заказ на планшете, система сразу считает стоимость, формирует КП и принимает аванс — клиент не уходит «подумать».</div>
    </div>
  </div>`;
}
/* символ открывания на эскизе створки (стандартные условные обозначения):
   поворотное — треугольник с вершиной у петель; поворотно-откидное —
   треугольник поворота + нижний треугольник откида; глухое — без символа.
   flip отражает створку по горизонтали (петли с разных сторон у пары). */
function openSymbol(openId, flip){
  if(openId!=='turn' && openId!=='tilt') return '';
  const turn = `<polyline points="92,10 8,70 92,130"/>`;          // вершина слева — петли слева (поворот)
  const tilt = `<polyline points="10,12 50,132 90,12"/>`;          // вершина снизу — откид
  const body = openId==='tilt' ? turn+tilt : turn;
  return `<svg class="win-sym${flip?' flip':''}" viewBox="0 0 100 140" preserveAspectRatio="none">${body}</svg>`;
}
function constrCard(c,i){
  const m=matById(c.profileId);
  const overridden = c.priceOverride!=null && c.priceOverride!=='' && !isNaN(c.priceOverride);
  const profOpts=DB.materials.map(o=>`<option value="${o.id}" ${o.id===c.profileId?'selected':''}>${escA(o.name)} · ${escA(o.series)}</option>`).join('');
  const glassOpts=GLASS.map(g=>`<option value="${g.id}" ${g.id===c.glassId?'selected':''}>${escA(g.name)}</option>`).join('');
  const extras=EXTRAS.map(e=>`<button class="ex-toggle ${(c.extras||[]).includes(e.id)?'on':''}" data-act="m-extra" data-cid="${c.id}" data-v="${e.id}">${(c.extras||[]).includes(e.id)?icon('check','sm'):icon('plus','sm')} ${escA(e.name)}</button>`).join('');
  // створки — каждая настраивается отдельно; sashSel[cid] — выбранная для редактирования
  const list=ensureSashList(c);
  const sel=Math.min(sashSel[c.id]||0, list.length-1);
  const sashesHtml=list.map((s,si)=>`<div class="win-sash${si===sel?' sel':''}${s.active?'':' off'}" data-act="m-sash-pick" data-cid="${c.id}" data-i="${si}" title="Створка ${si+1}">${ s.active?openSymbol(s.open, s.dir==='right'):'' }<span class="sash-no">${si+1}</span></div>`).join('');
  const ss=list[sel]||{open:'deaf',dir:'left',active:true};
  const sOpenChips=OPENINGS.map(o=>`<button class="chip ${ss.open===o.id?'on':''}" data-act="m-sash-open" data-cid="${c.id}" data-i="${sel}" data-v="${o.id}">${escA(o.name)}</button>`).join('');
  const dirChips = (ss.open==='deaf'||!ss.active) ? `<span class="muted2" style="font-size:11.5px;padding:6px 0">${ss.active?'глухое — петли не нужны':'створка отключена'}</span>`
    : `<button class="chip ${ss.dir==='left'?'on':''}" data-act="m-sash-dir" data-cid="${c.id}" data-i="${sel}" data-v="left">Петли слева</button>
       <button class="chip ${ss.dir==='right'?'on':''}" data-act="m-sash-dir" data-cid="${c.id}" data-i="${sel}" data-v="right">Петли справа</button>`;
  const activeChip=`<button class="ex-toggle ${ss.active?'on':''}" data-act="m-sash-active" data-cid="${c.id}" data-i="${sel}">${ss.active?icon('check','sm'):icon('plus','sm')} ${ss.active?'Активна':'Отключена'}</button>`;
  return `<div class="constr" data-cid="${c.id}">
    <div class="constr-h">
      <span class="ci">${icon('ruler','sm')}</span>
      <span class="cn">Конструкция ${i+1} · ${escA(m?m.type:'')}</span>
      <span class="cp" id="cprice-${c.id}">${money(constrPrice(c))}</span>
      <button class="x" style="width:30px;height:30px" data-act="m-del" data-cid="${c.id}">${icon('x','sm')}</button>
    </div>
    <div class="constr-body">
      <div class="fld"><label>Ширина, мм</label><input type="number" value="${c.w}" data-mnum data-cid="${c.id}" data-field="w"></div>
      <div class="fld"><label>Высота, мм</label><input type="number" value="${c.h}" data-mnum data-cid="${c.id}" data-field="h"></div>
      <div class="fld full"><label>Профиль / серия</label><select data-act="m-profile" data-cid="${c.id}">${profOpts}</select></div>
      <div class="fld full"><label>Стеклопакет</label><select data-act="m-glass" data-cid="${c.id}">${glassOpts}</select></div>
      <div class="fld"><label>Створок</label><input type="number" min="1" max="6" value="${c.sashes||1}" data-mnum data-cid="${c.id}" data-field="sashes"></div>
      <div class="fld"><label>Площадь</label><div style="font-size:14px;font-weight:600;padding:9px 0" id="carea-${c.id}">${(constrArea(c)*(c.qty||1)).toFixed(2)} м²</div></div>
      <div class="fld full"><label>Схема — нажмите на створку, чтобы настроить</label><div class="win-preview">${sashesHtml}</div></div>
      <div class="fld full sash-edit"><label>Створка ${sel+1} из ${list.length} · открывание</label>
        <div class="chips">${sOpenChips}</div>
        <div class="chips" style="margin-top:8px">${dirChips}</div>
        <div style="margin-top:8px">${activeChip}</div>
      </div>
      <div class="fld full"><label>Доп. опции</label><div class="extras">${extras}</div></div>
      <div class="fld"><label>Количество, шт</label><input type="number" min="1" value="${c.qty||1}" data-mnum data-cid="${c.id}" data-field="qty"></div>
      <div class="fld"><label>Цена за шт, сом ${overridden?`<span class="tag amber" style="font-size:10px;margin-left:4px">вручную</span>`:''}</label>
        <div style="display:flex;gap:6px;align-items:center">
          <input type="number" min="0" value="${constrUnitPrice(c)}" data-mnum data-cid="${c.id}" data-field="priceOverride" style="flex:1">
          ${overridden?`<button class="btn sm ghost" data-act="m-price-auto" data-cid="${c.id}" title="Вернуть авторасчёт (${money(constrUnitBase(c))})">${icon('refresh','sm')}</button>`:''}
        </div></div>
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
  d.sum=k.total; // держим сумму сделки в синхроне с позициями (локально; на сервер — по дискретным действиям)
  const set=(id,v)=>{const e=document.getElementById(id); if(e) e.textContent=v;};
  set('sum-sub',money(k.subtotal)); set('sum-disc','−'+money(k.discount)); set('sum-total',money(k.total)); set('sum-prepay',money(k.prepay));
}
function initMeasureBindings(){
  document.querySelectorAll('[data-mnum]').forEach(inp=>{
    const field=inp.dataset.field;
    inp.addEventListener('input',()=>{
      const d=currentMeasureDeal(); if(!d) return;
      const c=(d.items||[]).find(x=>x.id===inp.dataset.cid); if(!c) return;
      if(field==='sashes'){
        // во время ввода НЕ форсируем значение и НЕ перерисовываем экран — иначе
        // нельзя стереть и набрать своё число. Пустое поле ждём; пересбор схемы и
        // финальную нормализацию делаем по событию change (потеря фокуса/Enter).
        if(inp.value.trim()==='') return;
        c.sashes=Math.max(1,Math.min(6,Math.round(parseFloat(inp.value)||1))); ensureSashList(c); saveDB(); patchMeasure();
        if(window.API && API.enabled) API.persist.saveItem(c).catch(()=>{});
        return;
      }
      if(field==='priceOverride'){
        // ручная цена за шт: во время ввода обновляем итог/сумму, без перерисовки
        if(inp.value.trim()==='') return;
        c.priceOverride=Math.max(0,Math.round(parseFloat(inp.value)||0)); saveDB(); patchMeasure();
        if(window.API && API.enabled) API.persist.saveItem(c).catch(()=>{});
        return;
      }
      let v=parseFloat(inp.value)||0;
      if(field==='qty'){v=Math.max(1,Math.round(v));}
      if(field==='w'||field==='h'){ v=Math.max(0,Math.min(20000,v)); } // без отрицательных габаритов
      c[field]=v; saveDB(); patchMeasure();
      if(window.API && API.enabled) API.persist.saveItem(c).catch(()=>{});
    });
    if(field==='sashes'){
      inp.addEventListener('change',()=>{
        const d=currentMeasureDeal(); if(!d) return;
        const c=(d.items||[]).find(x=>x.id===inp.dataset.cid); if(!c) return;
        c.sashes=Math.max(1,Math.min(6,Math.round(parseFloat(inp.value)||1))); inp.value=c.sashes;
        ensureSashList(c); saveDB();
        if(window.API && API.enabled) API.persist.saveItem(c).catch(()=>{});
        renderModule();
      });
    }
    if(field==='priceOverride'){
      inp.addEventListener('change',()=>{
        const d=currentMeasureDeal(); if(!d) return;
        const c=(d.items||[]).find(x=>x.id===inp.dataset.cid); if(!c) return;
        // пусто → возврат к авторасчёту; иначе фиксируем ручную цену и показываем бейдж/сброс
        if(inp.value.trim()==='') delete c.priceOverride;
        else c.priceOverride=Math.max(0,Math.round(parseFloat(inp.value)||0));
        saveDB(); if(window.API && API.enabled) API.persist.saveItem(c).catch(()=>{});
        renderModule();
      });
    }
  });
}
/* KP doc */
/* Номер документа из id сделки: 'd11'→'11-2026', 'd_a1b2'→'a1b2-2026'
   (раньше .replace('d','') ломал uid-сделки в «_a1b2-2026») */
function docNo(d){ return String(d.id).replace(/^d_?/,'') + '-' + SEED_NOW.getFullYear(); }
/* Разметка КП — общая для модалки и для окна печати */
function kpDocHtml(d){
  const cl=clientById(d.clientId); const k=computeMeasure(d);
  const rows=(d.items||[]).map((c,i)=>{const m=matById(c.profileId);
    return `<tr><td>${i+1}</td><td>${escA(m.name)} (${escA(m.series)})<br><span style="color:#64748b">${c.w}×${c.h}мм, ${escA(constrOpenLabel(c))}, ${c.sashes} ств., ${escA(glassById(c.glassId).name)}</span></td><td style="text-align:center">${c.qty||1}</td><td style="text-align:right">${money(constrPrice(c))}</td></tr>`;}).join('');
  return `<div class="kp-doc">
        <div class="kp-co"><div><h2>${escA(DB.company.name)}</h2><div style="color:#64748b;font-size:12px">${escA(DB.company.legal)} · ${escA(DB.company.city)}<br>${escA(DB.company.phone)}</div></div>
          <div style="text-align:right;font-size:12px;color:#64748b">КП №${docNo(d)}<br>${dateFull(SEED_NOW)}</div></div>
        <div style="font-size:13px;margin-bottom:6px">Заказчик: <b>${escA(cl.name)}</b>, ${escA(cl.address)}</div>
        <table><thead><tr><th>№</th><th>Наименование</th><th style="text-align:center">Кол-во</th><th style="text-align:right">Стоимость</th></tr></thead><tbody>${rows}</tbody></table>
        <div style="text-align:right;color:#64748b;font-size:12.5px">Сумма: ${money(k.subtotal)}${k.discount?` · Скидка: −${money(k.discount)}`:''}</div>
        <div class="kp-tot">Итого к оплате: ${money(k.total)}</div>
        <div class="kp-pre"><b>Предоплата ${k.prepayPct}%: ${money(k.prepay)}</b><br><span style="font-size:12px">Остальное — после монтажа. Срок изготовления 4–6 недель. Гарантия 5 лет.</span></div>
      </div>`;
}
function openKp(id){
  const d=dealById(id); if(!d) return; const cl=clientById(d.clientId); const k=computeMeasure(d);
  openModal(`
    <div class="modal-h">${icon('doc')}<div><h3>Коммерческое предложение</h3><div class="mh-sub">${escA(cl.name)} · сформировано ${dateFull(SEED_NOW)}</div></div><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b">
      ${kpDocHtml(d)}
    </div>
    <div class="modal-f">
      <button class="btn" data-act="print-kp" data-id="${d.id}">${icon('doc','sm')} Печать / PDF</button>
      ${canWa()?`<button class="btn green" data-act="wa-deal-chat" data-id="${d.id}">${icon('wa','sm')} Чат WhatsApp</button>
      <button class="btn" data-act="wa-deal" data-id="${d.id}">${icon('send','sm')} Быстрое сообщение</button>`:''}
      <button class="btn primary" data-act="confirm-prepay" data-id="${d.id}">${icon('money','sm')} Принять предоплату ${money(k.prepay)}</button>
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
  w.document.write(`<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>КП — ${escA(cl.name)}</title><style>${css}</style></head><body><div class="wrap">${kpDocHtml(d)}</div><script>window.onload=function(){window.focus();window.print();};<\/script></body></html>`);
  w.document.close();
}

/* ===== Счёт на оплату и Договор подряда (из данных сделки) ===== */
/* Разметка счёта — общая для модалки и окна печати */
function invoiceDocHtml(d){
  const cl=clientById(d.clientId); const k=computeMeasure(d); const co=DB.company;
  const no=docNo(d);
  const vr=co.vatRate||0; const vat=vr?Math.round(k.total-k.total/(1+vr/100)):0;
  const rows=(d.items||[]).map((c,i)=>{ const m=matById(c.profileId); const q=c.qty||1; const line=constrPrice(c); const unit=Math.round(line/q);
    return `<tr><td>${i+1}</td><td>${escA(m.name)} (${escA(m.series)})<br><span style="color:#64748b">${c.w}×${c.h}мм, ${escA(constrOpenLabel(c))}, ${c.sashes} ств., ${escA(glassById(c.glassId).name)}</span></td><td style="text-align:center">${q}</td><td style="text-align:right">${money(unit)}</td><td style="text-align:right">${money(line)}</td></tr>`;}).join('');
  return `<div class="kp-doc">
        <div class="kp-co"><div><h2>Счёт на оплату № ${no}</h2><div style="color:#64748b;font-size:12px">от ${dateFull(SEED_NOW)}</div></div>
          <div style="text-align:right;font-size:12px;color:#64748b">${escA(co.legal)}<br>${escA(co.address)}<br>${escA(co.phone)}</div></div>
        <div class="doc-req">
          <div><b>Поставщик:</b> ${escA(co.legal)}, ИНН ${escA(co.inn)}, ОКПО ${escA(co.okpo)}</div>
          <div><b>Банк:</b> ${escA(co.bank)} · р/с ${escA(co.account)} · БИК ${escA(co.bik)}</div>
          <div><b>Покупатель:</b> ${escA(cl.name)}, ${escA(cl.phone)}${cl.address?', '+escA(cl.address):''}</div>
        </div>
        <table><thead><tr><th>№</th><th>Наименование</th><th style="text-align:center">Кол-во</th><th style="text-align:right">Цена</th><th style="text-align:right">Сумма</th></tr></thead><tbody>${rows}</tbody></table>
        ${k.discount?`<div style="text-align:right;color:#64748b;font-size:12.5px">Сумма: ${money(k.subtotal)} · Скидка: −${money(k.discount)}</div>`:''}
        <div class="kp-tot">Всего к оплате: ${money(k.total)}</div>
        <div style="text-align:right;color:#64748b;font-size:12px">${vr?`в т.ч. НДС ${vr}%: ${money(vat)}`:'без НДС'}</div>
        <div class="doc-words">Всего наименований ${(d.items||[]).length}, на сумму <b>${money(k.total)}</b><br>${sumWords(k.total)}</div>
        <div class="doc-sign"><div>Руководитель ______________ <span style="color:#64748b">${escA(co.directorShort)}</span></div>${co.stamp?`<div class="doc-stamp">М.П.</div>`:''}</div>
      </div>`;
}
/* Разметка договора подряда */
function contractDocHtml(d){
  const cl=clientById(d.clientId); const k=computeMeasure(d); const co=DB.company;
  const no=d.contractNo||nextContractNo(); const dt=d.contractDate?new Date(d.contractDate+'T12:00:00'):SEED_NOW;
  const vr=co.vatRate||0;
  const spec=(d.items||[]).map((c,i)=>{ const m=matById(c.profileId); const q=c.qty||1;
    return `<tr><td>${i+1}</td><td>${escA(m.name)} (${escA(m.series)}), ${c.w}×${c.h}мм, ${escA(constrOpenLabel(c))}, ${c.sashes} ств., ${escA(glassById(c.glassId).name)}</td><td style="text-align:center">${q}</td><td style="text-align:right">${money(constrPrice(c))}</td></tr>`;}).join('');
  const ready=d.readyDate?dateFull(d.readyDate):'4–6 недель с даты аванса';
  const install=d.installDate?dateFull(d.installDate):'в течение 5 дней после готовности';
  // подстановка плейсхолдеров в (редактируемый) шаблон договора
  const map={
    '{company}':co.legal, '{director}':co.director, '{client}':cl.name, '{address}':cl.address||'—',
    '{total}':money(k.total), '{totalWords}':sumWords(k.total), '{vat}':vr?`, в том числе НДС ${vr}%`:'',
    '{prepayPct}':k.prepayPct, '{prepay}':money(k.prepay), '{rest}':money(k.total-k.prepay),
    '{ready}':ready, '{install}':install };
  const tpl=(co.contractTpl&&co.contractTpl.trim())?co.contractTpl:DEFAULT_CONTRACT_TPL;
  let filled=tpl; Object.keys(map).forEach(key=>{ filled=filled.split(key).join(String(map[key])); });
  // экранируем (XSS), затем включаем разметку: **жирный** и абзацы по пустой строке
  const body=filled.split(/\n\s*\n/).map(par=>
    `<p>${escA(par).replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>').replace(/\n/g,'<br>')}</p>`).join('');
  return `<div class="kp-doc doc-contract">
        <div style="text-align:center;margin-bottom:4px"><h2 style="margin:0">Договор подряда № ${escA(no)}</h2></div>
        <div style="display:flex;justify-content:space-between;color:#64748b;font-size:12px;margin-bottom:14px"><span>г. ${escA(co.city)}</span><span>${dateFull(dt)}</span></div>
        ${body}
        <div style="font-weight:700;margin:14px 0 2px">Приложение №1. Спецификация</div>
        <table><thead><tr><th>№</th><th>Наименование</th><th style="text-align:center">Кол-во</th><th style="text-align:right">Стоимость</th></tr></thead><tbody>${spec}</tbody></table>
        <div class="kp-tot">Итого: ${money(k.total)}</div>
        <div class="doc-parties">
          <div><div style="font-weight:700;margin-bottom:4px">Исполнитель</div>${escA(co.legal)}<br>ИНН ${escA(co.inn)}, ОКПО ${escA(co.okpo)}<br>${escA(co.bank)}<br>р/с ${escA(co.account)}, БИК ${escA(co.bik)}<br>${escA(co.phone)}<br><br>_____________ /${escA(co.directorShort)}/ ${co.stamp?'М.П.':''}</div>
          <div><div style="font-weight:700;margin-bottom:4px">Заказчик</div>${escA(cl.name)}<br>${escA(cl.phone)}<br>${escA(cl.address||'')}<br><br><br>_____________ /______________/</div>
        </div>
      </div>`;
}
/* общий стиль печатного окна для счёта/договора */
const DOC_PRINT_CSS=`*{box-sizing:border-box} body{margin:0;background:#fff;font-family:Inter,system-ui,-apple-system,Arial,sans-serif;color:#1a2233}
  .wrap{max-width:720px;margin:0 auto;padding:28px}
  .kp-doc h2{font-size:18px;color:#0b1220;margin:0 0 4px}
  .kp-doc .kp-co{display:flex;justify-content:space-between;border-bottom:2px solid #e5e9f0;padding-bottom:14px;margin-bottom:14px}
  .kp-doc table{width:100%;border-collapse:collapse;margin:14px 0;font-size:12.5px}
  .kp-doc th{background:#f1f4f9;text-align:left;padding:9px 10px;color:#475569;font-size:11px;text-transform:uppercase}
  .kp-doc td{padding:9px 10px;border-bottom:1px solid #eef1f6;vertical-align:top}
  .kp-doc .kp-tot{text-align:right;font-size:16px;font-weight:800;color:#0b1220;margin-top:6px}
  .doc-req{font-size:12.5px;line-height:1.7;background:#f8fafc;border:1px solid #e5e9f0;border-radius:8px;padding:10px 12px;margin-bottom:4px}
  .doc-words{margin-top:10px;font-size:12.5px}
  .doc-sign{display:flex;justify-content:space-between;align-items:flex-end;margin-top:26px;font-size:13px}
  .doc-stamp{color:#94a3b8}
  .doc-contract p{font-size:13px;line-height:1.6;margin:8px 0}
  .doc-parties{display:flex;gap:24px;margin-top:20px;font-size:12px;line-height:1.6}
  .doc-parties>div{flex:1}
  @page{margin:14mm}`;
function printDoc(html, title){
  const w=window.open('','_blank','width=840,height=960');
  if(!w){ toast('Разрешите всплывающие окна, чтобы распечатать документ','warn'); return; }
  w.document.write(`<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>${escA(title)}</title><style>${DOC_PRINT_CSS}</style></head><body><div class="wrap">${html}</div><script>window.onload=function(){window.focus();window.print();};<\/script></body></html>`);
  w.document.close();
}
function openInvoice(id){
  const d=dealById(id); if(!d) return; const cl=clientById(d.clientId);
  openModal(`
    <div class="modal-h">${icon('doc')}<div><h3>Счёт на оплату</h3><div class="mh-sub">${escA(cl.name)} · ${dateFull(SEED_NOW)}</div></div><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b">${invoiceDocHtml(d)}</div>
    <div class="modal-f">
      <button class="btn" data-act="print-invoice" data-id="${d.id}">${icon('doc','sm')} Печать / PDF</button>
      ${canWa()?`<button class="btn green" data-act="wa-deal-chat" data-id="${d.id}">${icon('wa','sm')} Чат WhatsApp</button>`:''}
    </div>
  `, true);
}
function printInvoice(id){ const d=dealById(id); if(!d) return; printDoc(invoiceDocHtml(d), 'Счёт — '+clientById(d.clientId).name); }
function openContract(id){
  const d=dealById(id); if(!d) return; const cl=clientById(d.clientId);
  openModal(`
    <div class="modal-h">${icon('doc')}<div><h3>Договор подряда${d.contractNo?' № '+escA(d.contractNo):''}</h3><div class="mh-sub">${escA(cl.name)} · ${d.contractDate?dateFull(d.contractDate):dateFull(SEED_NOW)}</div></div><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b">${contractDocHtml(d)}</div>
    <div class="modal-f">
      <button class="btn" data-act="print-contract" data-id="${d.id}">${icon('doc','sm')} Печать / PDF</button>
      ${canWa()?`<button class="btn green" data-act="wa-deal-chat" data-id="${d.id}">${icon('wa','sm')} Чат WhatsApp</button>`:''}
    </div>
  `, true);
}
function printContract(id){ const d=dealById(id); if(!d) return; printDoc(contractDocHtml(d), 'Договор — '+clientById(d.clientId).name); }

/* ============ WAREHOUSE ============ */
function renderWarehouse(){
  const showCost=seesMoney();
  const tab=state.whTab;
  const moves=(DB.movements||[]);
  const actCell=(itId,knd)=>`<td style="text-align:right;white-space:nowrap"><div class="row-acts" style="display:inline-flex;gap:6px;justify-content:flex-end">
    <button class="btn sm" data-act="wh-receive" data-id="${itId}" data-kind="${knd}">${icon('plus','sm')} Приход</button>
    <button class="btn sm danger" data-act="wh-writeoff" data-id="${itId}" data-kind="${knd}">${icon('minus','sm')} Расход</button>
    <button class="btn sm ghost" data-act="wh-edit" data-id="${itId}" data-kind="${knd}" title="Изменить">${icon('edit','sm')}</button>
    ${showCost?`<button class="btn sm ghost" data-act="wh-del" data-id="${itId}" data-kind="${knd}" title="Удалить позицию">${icon('trash','sm')}</button>`:''}</div></td>`;
  const tabs=`<div class="tabs"><button class="tab ${tab==='profile'?'on':''}" data-act="wh-tab" data-v="profile">Профиль (${DB.materials.length})</button>
    <button class="tab ${tab==='comp'?'on':''}" data-act="wh-tab" data-v="comp">Стеклопакеты и фурнитура (${DB.components.length})</button>
    <button class="tab ${tab==='moves'?'on':''}" data-act="wh-tab" data-v="moves">Движения (${moves.length})</button></div>`;
  let body;
  // фильтры остатков (поиск + только ниже минимума) — для вкладок «Профиль»/«Фурнитура»
  const q=(state.whSearch||'').trim().toLowerCase(), lowOnly=!!state.whLow;
  const whFilterBar=`<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:12px 16px;border-bottom:1px solid var(--line)">
    <div class="flt-search" style="flex:1;min-width:200px;max-width:340px">${icon('search','sm')}<input id="wh-search" data-act="wh-search" placeholder="Поиск по названию" value="${escA(state.whSearch||'')}" autocomplete="off"></div>
    <button class="chip ${lowOnly?'on':''}" data-act="wh-low">${icon('alert','sm')} только ниже минимума</button>
    ${(q||lowOnly)?`<button class="btn sm" data-act="wh-flt-reset">${icon('x','sm')} Сбросить</button>`:''}</div>`;
  if(tab==='profile'){
    const list=DB.materials.filter(m=>(!q||[m.name,m.supplier,m.series].some(v=>(v||'').toLowerCase().includes(q)))&&(!lowOnly||m.stock<m.min));
    const anyOffcut=DB.materials.some(m=>barBreakdown(m).offcut>0);
    const offcutBanner=anyOffcut?`<div style="display:flex;align-items:center;gap:8px;padding:9px 16px;background:var(--amber-soft);color:#b45309;font-size:12.5px;border-bottom:1px solid var(--line)">${icon('alert','sm')} Есть остатки-обрезки профиля — при нарезке используйте их в первую очередь (экономия материала).</div>`:'';
    const rows=list.map(m=>{const low=m.stock<m.min; const pct=Math.min(100,m.stock/(m.min*2)*100); const bb=barBreakdown(m); const cost=matCost(m); const barLen=m.barLen||6;
      return `<tr data-wh-row="${m.id}"><td><div style="font-weight:600">${escA(m.name)}</div><div class="muted2" style="font-size:11.5px">${escA(m.supplier)}</div></td>
        <td><span class="tag ${m.type==='ПВХ'?'cyan':'violet'}">${escA(m.type)}</span></td>
        <td><span class="tag ${m.series==='Премиум'?'amber':m.series==='Средняя'?'blue':''}">${escA(m.series)}</span></td>
        ${showCost?`<td class="num" style="white-space:nowrap">${money(cost)}/пог.м<div class="muted2" style="font-size:11px">${money(cost*barLen)}/хлыст</div></td>`:''}
        <td style="min-width:180px"><div style="display:flex;align-items:center;gap:10px"><div class="mini-bar"><i style="width:${pct}%;background:${low?'var(--red)':'var(--green)'}"></i></div>
          <span style="white-space:nowrap"><b>${bb.bars} хлыст.</b> <span class="muted2">(по ${barLen} м)</span> · ${m.stock} пог.м${bb.offcut>0?` <span class="tag green" style="font-size:10px">+ обрезки ${bb.offcut} м</span>`:''}</span></div></td>
        <td>${low?`<span class="tag red">${icon('alert','sm')} мало</span>`:'<span class="tag green">в норме</span>'}</td>
        ${actCell(m.id,'mat')}</tr>`;}).join('') || `<tr><td colspan="${showCost?7:6}" class="muted" style="text-align:center;padding:24px">Ничего не найдено</td></tr>`;
    body=whFilterBar+offcutBanner+`<div class="tbl-scroll"><table class="tbl"><thead><tr><th>Профиль</th><th>Тип</th><th>Серия</th>${showCost?'<th class="num">Цена</th>':''}<th>Остаток (хлысты · пог.м)</th><th>Статус</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
  } else if(tab==='comp'){
    const list=DB.components.filter(c=>(!q||(c.name||'').toLowerCase().includes(q))&&(!lowOnly||c.stock<c.min));
    const rows=list.map(c=>{const low=c.stock<c.min; const pct=Math.min(100,c.stock/(c.min*2)*100);
      return `<tr data-wh-row="${c.id}"><td style="font-weight:600">${escA(c.name)}</td>
        <td style="min-width:200px"><div style="display:flex;align-items:center;gap:10px"><div class="mini-bar"><i style="width:${pct}%;background:${low?'var(--red)':'var(--green)'}"></i></div><span style="font-weight:700;white-space:nowrap">${c.stock} ${escA(c.unit)}</span></div></td>
        <td class="muted">мин. ${c.min}</td>
        <td>${low?`<span class="tag red">${icon('alert','sm')} дозаказать</span>`:'<span class="tag green">в норме</span>'}</td>
        ${actCell(c.id,'comp')}</tr>`;}).join('') || `<tr><td colspan="5" class="muted" style="text-align:center;padding:24px">Ничего не найдено</td></tr>`;
    body=whFilterBar+`<div class="tbl-scroll"><table class="tbl"><thead><tr><th>Наименование</th><th>Остаток</th><th>Минимум</th><th>Статус</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
  } else {
    const ft=state.whMoveType||'all', fp=state.whMovePeriod||'all';
    // фильтр по типу операции
    const byType=m=> ft==='all' ? true : (ft==='out' ? moveType(m.type).dir==='out' : m.type===ft);
    // фильтр по периоду: пресеты (7/30 дней от SEED_NOW) или диапазон дат «с … по …»
    let lo=-Infinity, hi=Infinity;
    if(fp==='date'){ if(state.whMoveFrom) lo=new Date(state.whMoveFrom+'T00:00:00').getTime(); if(state.whMoveTo) hi=new Date(state.whMoveTo+'T23:59:59').getTime(); }
    else if(fp!=='all'){ lo=SEED_NOW.getTime()-parseInt(fp,10)*86400000; }
    const byPeriod=m=>{ const t=new Date(m.at).getTime(); return t>=lo && t<=hi; };
    const filtered=moves.filter(m=>byType(m)&&byPeriod(m));
    const list=filtered.slice().sort((a,b)=>String(b.at||'').localeCompare(String(a.at||''))).slice(0,120);
    const typeChips=[['all','Все'],['receipt','Приход'],['production','В производство'],['writeoff','Брак'],['return','Возврат'],['adjust','Корректировка']]
      .map(([v,l])=>`<button class="chip ${ft===v?'on':''}" data-act="wh-mv-type" data-v="${v}">${l}</button>`).join('');
    const periodChips=[['all','Всё время'],['30','30 дней'],['7','7 дней']]
      .map(([v,l])=>`<button class="chip ${fp===v?'on':''}" data-act="wh-mv-period" data-v="${v}">${l}</button>`).join('');
    const dInpSt='background:var(--bg2);border:1px solid var(--line);border-radius:8px;padding:5px 8px;color:var(--txt);font-size:12px;outline:none';
    const dateRange=`<span class="muted2" style="font-size:11.5px">с</span>
      <input type="date" data-act="wh-mv-from" value="${state.whMoveFrom||''}" style="${dInpSt}${fp==='date'?';border-color:var(--accent2)':''}">
      <span class="muted2" style="font-size:11.5px">по</span>
      <input type="date" data-act="wh-mv-to" value="${state.whMoveTo||''}" style="${dInpSt}${fp==='date'?';border-color:var(--accent2)':''}">`;
    const rows=list.map(m=>{const mt=moveType(m.type); const u=userById(m.who);
      const qcell=m.dir==='in'
        ? `<span style="color:#4ade80;font-weight:700;white-space:nowrap">+${m.qty} ${escA(m.unit||'')}</span>`
        : `<span style="color:#f87171;font-weight:700;white-space:nowrap">−${m.qty} ${escA(m.unit||'')}</span>`;
      return `<tr><td class="muted" style="white-space:nowrap">${dateStr(m.at)}</td>
        <td style="font-weight:600">${escA(m.name||m.itemId)}</td>
        <td><span class="tag ${mt.color}">${mt.dir==='in'?icon('arrow','sm'):icon('trash','sm')} ${mt.label}</span></td>
        <td class="muted">${escA(m.reason||'—')}</td>
        <td class="num">${qcell}</td>
        <td class="muted" style="white-space:nowrap">${escA(u?u.name:'—')}</td></tr>`;}).join('');
    const inSum=filtered.filter(m=>m.dir==='in').length, outSum=filtered.filter(m=>m.dir==='out').length;
    body=`<div style="padding:14px 18px;border-bottom:1px solid var(--line)">
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px"><span class="muted2" style="font-size:11.5px;min-width:64px">Операция</span><div class="chips">${typeChips}</div></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><span class="muted2" style="font-size:11.5px;min-width:64px">Период</span><div class="chips" style="align-items:center">${periodChips}${dateRange}</div></div>
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
  <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px">${tabs}
    ${tab==='profile'?`<button class="btn primary sm" data-act="wh-item-add" data-kind="mat">${icon('plus','sm')} Профиль</button>`:''}
    ${tab==='comp'?`<button class="btn primary sm" data-act="wh-item-add" data-kind="comp">${icon('plus','sm')} Комплектующее</button>`:''}
    ${(seesMoney()&&(tab==='profile'||tab==='comp'))?`<button class="btn sm" style="margin-left:auto" data-act="import-wh" data-kind="${tab==='profile'?'mat':'comp'}">${icon('arrow','sm')} Импорт</button>`:''}
    <button class="btn sm" ${(seesMoney()&&(tab==='profile'||tab==='comp'))?'':'style="margin-left:auto"'} data-act="export" data-what="warehouse">${icon('doc','sm')} Экспорт</button></div>
  <div class="panel"><div class="panel-h">${icon('warehouse')}<h3>${tab==='moves'?'Журнал движений':'Остатки на складе'}</h3><span class="ph-sub">${escA(DB.company.city)}</span></div>${body}</div>`;
}

/* ============ PRODUCTION ============ */
// статус плановой даты относительно SEED_NOW (демо-«сейчас»)
function prodDateBadge(dateStr, done){
  if(!dateStr) return null;
  const fmt=new Date(dateStr+'T12:00:00').toLocaleDateString('ru-RU',{day:'2-digit',month:'short'});
  if(done) return {txt:fmt, cls:'green'};
  const dd=Math.round((new Date(dateStr+'T12:00:00')-nowRef())/864e5);
  if(dd<0) return {txt:'просроч. '+(-dd)+'д', cls:'red'};
  if(dd===0) return {txt:'сегодня', cls:'amber'};
  if(dd<=2) return {txt:'через '+dd+'д', cls:'amber'};
  return {txt:fmt, cls:''};
}
function renderProduction(){
  const dir = state.user && state.user.role==='director';
  const editing = dir && state.prodEdit;
  const orders=DB.deals.filter(d=>['production','install'].includes(d.stage));
  const cols=PROD_STAGES.map((ps,idx)=>{
    const col=ps.color||'#db2777';
    const arr=orders.filter(d=>(d.prodStage||'queue')===ps.id);
    const cards=arr.map(d=>{const cl=clientById(d.clientId);
      const spec=(d.items||[]).map(c=>`${matById(c.profileId)?.type||''} ${c.w}×${c.h}`).slice(0,3).join(' · ');
      const winCount=(d.items||[]).reduce((s,c)=>s+(c.qty||1),0);
      const rb=prodDateBadge(d.readyDate, ['ready','installing'].includes(d.prodStage));
      const ib=prodDateBadge(d.installDate, d.stage==='done');
      const datesRow=(rb||ib)?`<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:8px">
        ${rb?`<span class="tag ${rb.cls}" style="font-size:10px">${icon('hammer','sm')} ${rb.txt}</span>`:''}
        ${ib?`<span class="tag ${ib.cls}" style="font-size:10px">${icon('pin','sm')} ${ib.txt}</span>`:''}</div>`:'';
      return `<div class="kcard" draggable="true" data-pcard="${d.id}" data-act="open-prod" data-id="${d.id}" style="border-left-color:${col}">
        <div class="kc-client">${escA(cl.name)}</div>
        <div class="kc-addr">${icon('box','sm')} ${winCount} констр.</div>
        <div class="muted2" style="font-size:11.5px;margin-top:8px">${spec||'—'}</div>
        ${datesRow}
        <div class="kc-meta"><span class="tag" style="font-size:10.5px">${escA(stageById(d.stage).name)}</span><span class="kc-days">${icon('pin','sm')} ${escA(cl.address.split(',')[0])}</span></div>
      </div>`;}).join('')||`<div class="muted2" style="font-size:12px;text-align:center;padding:14px 0">пусто</div>`;
    const locked=SYSTEM_PROD_IDS.includes(ps.id);
    const head = editing
      ? `<span class="dot-i" style="background:${col}"></span><span class="kc-name">${escA(ps.name)}</span>
         <span style="margin-left:auto;display:flex;gap:2px;align-items:center">
           <button class="x" data-act="prod-stage-move" data-id="${ps.id}" data-dir="left" title="Левее" style="width:22px;height:26px;font-size:16px${idx===0?';opacity:.25;pointer-events:none':''}">‹</button>
           <button class="x" data-act="prod-stage-move" data-id="${ps.id}" data-dir="right" title="Правее" style="width:22px;height:26px;font-size:16px${idx===PROD_STAGES.length-1?';opacity:.25;pointer-events:none':''}">›</button>
           <button class="x" style="width:26px;height:26px" data-act="prod-stage-edit" data-id="${ps.id}" title="Изменить этап">${icon('edit','sm')}</button>
           ${locked
             ? `<span class="muted2" style="display:inline-grid;place-items:center;width:26px;height:26px" title="Системный этап: списание материалов / переход на монтаж — удалить нельзя">${icon('lock','sm')}</span>`
             : `<button class="x" style="width:26px;height:26px" data-act="prod-stage-del" data-id="${ps.id}" title="Удалить этап">${icon('trash','sm')}</button>`}</span>`
      : `<span class="dot-i" style="background:${col}"></span><span class="kc-name">${escA(ps.name)}</span><span class="kc-count">${arr.length}</span>`;
    return `<div class="kcol" style="flex-basis:250px"><div class="kcol-h">${head}</div><div class="kcol-b" data-pdrop="${ps.id}">${cards}</div></div>`;
  }).join('') + (editing ? `<div class="kcol" style="flex-basis:200px;border-style:dashed;display:grid;place-items:center;min-height:120px"><button class="btn sm" data-act="prod-stage-add">${icon('plus','sm')} Этап</button></div>` : '');
  return `
  <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;align-items:center">
    <div class="tag violet">${icon('production','sm')} ${orders.length} заказов на линии</div>
    ${!seesMoney()?'<div class="tag">режим производства — финансы скрыты</div>':''}
    ${dir?`<button class="btn sm ${editing?'primary':''}" style="margin-left:auto" data-act="prod-stage-edit-toggle">${icon('edit','sm')} ${editing?'Готово':'Этапы'}</button>`:''}
  </div>
  ${editing?`<div class="muted2" style="font-size:12px;margin-bottom:12px;padding:9px 12px;background:var(--accent-soft);border-radius:9px">Режим редактирования этапов цеха: стрелками ‹ › меняйте порядок, ✎ — название и цвет, добавьте или удалите этап. При удалении укажете, куда перенести заказы. Системные этапы (списание материалов и переход на монтаж) защищены.</div>`:''}
  <div class="kanban">${cols}</div>
  <div class="muted2" style="font-size:12px;margin-top:12px">Перетаскивайте заказы по этапам цеха.</div>`;
}
function openProd(id){
  const d=dealById(id); if(!d) return; __modalKind='prod'; const cl=clientById(d.clientId);
  const items=(d.items||[]).map((c,i)=>{const m=matById(c.profileId);
    return `<tr><td>${i+1}</td><td>${escA(m.name)}</td><td>${c.w}×${c.h}мм</td><td>${escA(glassById(c.glassId).name)}</td><td>${escA(constrOpenLabel(c))}, ${c.sashes}ств</td><td style="text-align:center">${c.qty||1}</td></tr>`;}).join('');
  const stageOpts=PROD_STAGES.map(s=>`<button class="chip ${s.id===(d.prodStage||'queue')?'on':''}" data-act="move-prod" data-id="${d.id}" data-stage="${s.id}">${escA(s.name)}</button>`).join('');
  openModal(`
    <div class="modal-h">${icon('production')}<div><h3>Заказ · ${escA(cl.name)}</h3><div class="mh-sub">${icon('pin','sm')} ${escA(cl.address)}</div></div><button class="x" data-act="close-modal">${icon('x')}</button></div>
    <div class="modal-b">
      <div class="fld full" style="margin-bottom:16px"><label>Этап производства — нажмите, чтобы переключить</label><div class="chips oneline">${stageOpts}</div></div>
      ${(()=>{ const rb=prodDateBadge(d.readyDate,['ready','installing'].includes(d.prodStage)), ib=prodDateBadge(d.installDate,d.stage==='done');
        return `<div class="constr-body" style="padding:0;margin-bottom:16px">
        <div class="fld"><label>Плановая готовность ${rb?`<span class="tag ${rb.cls}" style="font-size:10px;margin-left:4px">${rb.txt}</span>`:''}</label><input type="date" value="${d.readyDate||''}" data-act="prod-date" data-id="${d.id}" data-field="readyDate"></div>
        <div class="fld"><label>Плановый монтаж ${ib?`<span class="tag ${ib.cls}" style="font-size:10px;margin-left:4px">${ib.txt}</span>`:''}</label><input type="date" value="${d.installDate||''}" data-act="prod-date" data-id="${d.id}" data-field="installDate"></div>
      </div>`; })()}
      <div class="panel" style="margin-bottom:16px"><div class="panel-h" style="padding:12px 14px">${icon('ruler','sm')}<h3 style="font-size:13.5px">Спецификация (для цеха)</h3></div>
        <table class="tbl"><thead><tr><th>№</th><th>Профиль</th><th>Размер</th><th>Стеклопакет</th><th>Открывание</th><th style="text-align:center">Шт</th></tr></thead><tbody>${items}</tbody></table></div>
      ${dealMediaBlock(d, true)}
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
  const totalPay=DB.payables.filter(p=>p.status!=='оплачено').reduce((s,p)=>s+p.amount,0);
  let body;
  if(tab==='recv'){
    const rows=debtors.map(d=>{const cl=clientById(d.clientId); const debt=dealDebt(d); const paid=dealPaid(d);
      const overdue=['done'].includes(d.stage);
      return `<tr><td><div class="cell-name">${avatarXs(cl.name,cl.id)}<span style="font-weight:600">${escA(cl.name)}</span></div></td>
        <td class="muted">${escA(stageById(d.stage).name)}</td>
        <td class="num">${money(d.sum)}</td><td class="num" style="color:#4ade80">${money(paid)}</td>
        <td class="num" style="color:#fbbf24;font-weight:700">${money(debt)}</td>
        <td>${overdue?'<span class="tag red">требует оплаты</span>':'<span class="tag amber">в графике</span>'}</td>
        <td><button class="btn green sm" data-act="add-payment" data-id="${d.id}">${icon('money','sm')} Оплата</button></td></tr>`;}).join('');
    body=`<div class="tbl-scroll"><table class="tbl"><thead><tr><th>Клиент</th><th>Стадия</th><th class="num">Заказ</th><th class="num">Оплачено</th><th class="num">Долг</th><th>Статус</th><th></th></tr></thead><tbody>${rows||'<tr><td colspan=7 class="muted" style="text-align:center;padding:30px">Дебиторки нет</td></tr>'}</tbody></table></div>`;
  } else if(tab==='pay'){
    const rows=DB.payables.map(p=>{
      const stt=p.status==='оплачено'?'<span class="tag green">оплачено</span>':(p.status==='просрочено'?'<span class="tag red">просрочено</span>':'<span class="tag amber">ожидает</span>');
      return `<tr style="${p.status==='оплачено'?'opacity:.6':''}"><td style="font-weight:600">${escA(p.supplier)}</td><td class="muted">${escA(p.forWhat||'')}</td>
      <td class="num" style="font-weight:700">${money(p.amount)}</td><td class="muted">${p.due?dateFull(p.due):'—'}</td>
      <td>${stt}</td>
      <td class="row-acts" style="white-space:nowrap;text-align:right">
        ${p.status!=='оплачено'?`<button class="btn sm green" data-act="payable-paid" data-id="${p.id}" title="Отметить оплаченным">${icon('check','sm')}</button>`:''}
        <button class="btn sm ghost" data-act="edit-payable" data-id="${p.id}" title="Изменить">${icon('edit','sm')}</button>
        <button class="btn sm ghost" data-act="del-payable" data-id="${p.id}" title="Удалить">${icon('trash','sm')}</button></td></tr>`;}).join('')
      ||'<tr><td colspan=6 class="muted" style="text-align:center;padding:30px">Кредиторки нет</td></tr>';
    body=`<div class="tbl-scroll"><table class="tbl"><thead><tr><th>Поставщик</th><th>За что</th><th class="num">Сумма</th><th>Срок</th><th>Статус</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
  } else {
    // период отчётности
    const fp=state.financePeriod||'all';
    let fromTs=-Infinity, toTs=Infinity, periodLabel='за всё время';
    if(fp==='7'){ fromTs=SEED_NOW.getTime()-7*864e5; periodLabel='за 7 дней'; }
    else if(fp==='30'){ fromTs=SEED_NOW.getTime()-30*864e5; periodLabel='за 30 дней'; }
    else if(fp==='date'){
      if(state.financeFrom) fromTs=new Date(state.financeFrom).getTime();
      if(state.financeTo) toTs=new Date(state.financeTo).getTime()+864e5-1; // включаем весь день «по»
      if(state.financeFrom && state.financeTo) periodLabel='с '+dateFull(state.financeFrom)+' по '+dateFull(state.financeTo);
      else if(state.financeFrom) periodLabel='с '+dateFull(state.financeFrom);
      else if(state.financeTo) periodLabel='по '+dateFull(state.financeTo);
    }
    const inP=ts=>ts>=fromTs && ts<=toTs;
    const revenue=DB.deals.reduce((s,d)=>s+(d.payments||[]).filter(p=>inP(new Date(p.date).getTime())).reduce((a,p)=>a+p.amount,0),0);
    const orders=DB.deals.filter(d=>d.sum>0 && inP(new Date(d.createdAt).getTime())).reduce((s,d)=>s+d.sum,0);
    const cost=Math.round(revenue*0.56); const margin=revenue-cost;
    const revenueAll=DB.deals.reduce((s,d)=>s+dealPaid(d),0);
    const won=DB.deals.filter(d=>['production','install','done'].includes(d.stage)).length;
    const conv=Math.round(won/Math.max(1,DB.deals.length)*100);
    const stageRows=STAGES.map(s=>{const cnt=DB.deals.filter(d=>stageIndex(d.stage)>=stageIndex(s.id)).length;
      return {label:s.name,value:cnt,display:cnt,color:`linear-gradient(90deg,${s.color},${s.color}cc)`};});
    const perChips=[['all','Всё время'],['30','30 дней'],['7','7 дней']].map(([v,l])=>`<button class="chip ${fp===v?'on':''}" data-act="fin-period" data-v="${v}">${l}</button>`).join('');
    const fromVal=state.financeFrom?String(state.financeFrom).slice(0,10):'';
    const toVal=state.financeTo?String(state.financeTo).slice(0,10):'';
    const dInp='background:var(--bg2);border:1px solid '+(fp==='date'?'var(--accent2)':'var(--line)')+';border-radius:9px;padding:7px 10px;color:var(--txt);font-size:13px';
    body=`<div style="padding:18px 18px 6px">
      <div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-bottom:16px">
        <span class="muted2" style="font-size:11.5px">Период:</span><div class="chips">${perChips}</div>
        <span class="muted2" style="font-size:11.5px;margin-left:4px">или диапазон:</span>
        <input type="date" data-act="fin-date" value="${fromVal}" title="с даты" style="${dInp}">
        <span class="muted2" style="font-size:12px">—</span>
        <input type="date" data-act="fin-date-to" value="${toVal}" title="по дату" style="${dInp}">
        <span class="muted2" style="font-size:11.5px;margin-left:auto">${periodLabel}</span>
      </div>
      <div class="cards-row" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr));margin-bottom:18px">
        ${kpi({icon:'money',label:'Получено (касса)',value:moneyK(revenue),color:'#16a34a',soft:'var(--green-soft)'})}
        ${kpi({icon:'doc',label:'Законтрактовано',value:moneyK(orders),color:'#2563eb'})}
        ${kpi({icon:'trend',label:'Себестоимость',value:moneyK(cost),color:'#dc2626',soft:'var(--red-soft)'})}
        ${kpi({icon:'wallet',label:'Маржа',value:moneyK(margin),color:'#7c3aed',sub:Math.round(margin/Math.max(1,revenue)*100)+'% рентабельность'})}
      </div>
      <div class="grid-2b">
        <div class="panel"><div class="panel-h">${icon('funnel','sm')}<h3>Конверсия по этапам</h3><span class="ph-sub">${conv}% доходимость</span></div><div class="panel-b">${bars(stageRows)}</div></div>
        <div class="panel"><div class="panel-h">${icon('trend','sm')}<h3>Выручка по месяцам</h3></div><div class="panel-b">${bars([['дек',3.1],['янв',3.8],['фев',4.2],['мар',3.6],['апр',4.9],['май',revenueAll/1e6]].map((r,i,a)=>({label:r[0],value:r[1],display:r[1].toFixed(1)+' млн',color:i===a.length-1?'linear-gradient(90deg,#16a34a,#4ade80)':'linear-gradient(90deg,#2563eb,#3b82f6)'})))}</div></div>
      </div></div>`;
  }
  return `
  <div class="cards-row" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr));margin-bottom:16px">
    ${kpi({icon:'wallet',label:'Нам должны (дебиторка)',value:moneyK(totalDebt),color:'#d97706',soft:'var(--amber-soft)',sub:debtors.length+' клиентов'})}
    ${kpi({icon:'doc',label:'Мы должны (кредиторка)',value:moneyK(totalPay),color:'#dc2626',soft:'var(--red-soft)',sub:DB.payables.length+' поставщиков'})}
    ${kpi({icon:'trend',label:'Сальдо',value:moneyK(totalDebt-totalPay),color:(totalDebt-totalPay)>=0?'#16a34a':'#dc2626'})}
  </div>
  <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px">${tabs}
    ${tab==='pay'?`<button class="btn primary sm" data-act="new-payable">${icon('plus','sm')} Добавить долг</button>`:''}
    <button class="btn sm" style="margin-left:auto" data-act="export" data-what="finance">${icon('doc','sm')} Экспорт</button></div>
  <div class="panel">${body}</div>`;
}

/* ============ CATALOG / PRICING ============ */
/* Отдельный раздел: каталоги и прайс (раньше был внутри Настроек). */
function renderCatalog(){
  return `<div class="panel-h" style="border:none;padding:4px 0 12px"><span class="ph-sub">Цены меняются здесь и сразу применяются в расчёте КП и стоимости конструкций.</span></div>
    ${catTable('glass')}${catTable('opening')}${catTable('extra')}`;
}

/* ============ SETTINGS ============ */
/* редактируемая таблица одного каталога (стеклопакеты / открывания / опции) */
function catTable(type){
  const cfg=CATALOGS_EDIT[type]; if(!cfg) return '';
  const perOf=p=>({'шт':'за штуку','м':'за пог.м','периметр':'по периметру'})[p]||p;
  const rows=cfg.arr().map(x=>`<tr><td style="font-weight:600">${escA(x.name)}</td>
    <td class="num"><span style="display:flex;justify-content:flex-end;white-space:nowrap"><span>${money(x[cfg.priceKey])}</span><span class="muted2" style="flex:0 0 64px;text-align:left;font-weight:400;padding-left:3px">${cfg.suffix||''}</span></span></td>
    <td class="muted">${cfg.hasPer?perOf(x.per):''}</td>
    <td class="row-acts" style="text-align:right;white-space:nowrap">
      <button class="btn sm ghost" data-act="cat-edit" data-type="${type}" data-id="${x.id}" title="Изменить">${icon('edit','sm')}</button>
      <button class="btn sm ghost" data-act="cat-del" data-type="${type}" data-id="${x.id}" title="Удалить">${icon('trash','sm')}</button></td></tr>`).join('');
  return `<div class="panel" style="margin-top:12px"><div class="panel-h" style="padding:12px 14px">${icon('money','sm')}<h3 style="font-size:13.5px">${cfg.title}</h3>
      <button class="btn sm" style="margin-left:auto" data-act="cat-add" data-type="${type}">${icon('plus','sm')} Добавить</button></div>
    <div class="tbl-scroll"><table class="tbl cat-tbl"><colgroup><col><col style="width:200px"><col style="width:160px"><col style="width:96px"></colgroup>
      <thead><tr><th>Наименование</th><th><span style="display:flex;justify-content:flex-end"><span>Цена</span><span style="flex:0 0 64px"></span></span></th><th>${cfg.hasPer?'Расчёт':''}</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}
// Быстрые сообщения WhatsApp: шаблоны по этапам (редактирование — директор)
function waTplPanelHtml(){
  const byStage={}; (WA_TEMPLATES||[]).forEach(t=>{ (byStage[t.stage]=byStage[t.stage]||[]).push(t); });
  const order=['any',...STAGES.map(s=>s.id)];
  const stageLabel=s=> s==='any'?'Любой этап':((stageById(s)||{}).name||s);
  const rows=order.filter(s=>byStage[s]&&byStage[s].length).map(s=>byStage[s].map(t=>
    `<tr><td style="white-space:nowrap"><span class="tag ${s==='any'?'':'blue'}">${stageLabel(s)}</span></td>
      <td style="font-weight:600;white-space:nowrap">${escA(t.label)}</td>
      <td class="muted" style="font-size:12px">${escA(t.text.length>90?t.text.slice(0,90)+'…':t.text)}</td>
      <td class="row-acts" style="white-space:nowrap"><button class="btn sm ghost" data-act="wa-tpl-edit" data-id="${t.id}" title="Изменить">${icon('edit','sm')}</button>
        <button class="btn sm ghost danger" data-act="wa-tpl-del" data-id="${t.id}" title="Удалить">${icon('trash','sm')}</button></td></tr>`
  ).join('')).join('');
  return `<div class="panel section-gap"><div class="panel-h">${icon('wa')}<h3>Быстрые сообщения WhatsApp</h3>
    <span class="ph-sub">шаблоны по этапам · подставляются при отправке</span>
    <div style="margin-left:auto;display:flex;gap:8px"><button class="btn sm ghost" data-act="wa-tpl-reset" title="Вернуть стандартные">${icon('refresh','sm')}</button><button class="btn sm" data-act="wa-tpl-add">${icon('plus','sm')} Шаблон</button></div></div>
    <div class="tbl-scroll"><table class="tbl"><thead><tr><th>Этап</th><th>Название</th><th>Текст</th><th></th></tr></thead><tbody>${rows||'<tr><td colspan="4" class="muted" style="text-align:center;padding:20px">Шаблонов нет</td></tr>'}</tbody></table></div></div>`;
}
// Отдельный раздел «Корзина» (директор + менеджер)
function renderTrash(){ return trashPanelHtml(); }
// Корзина: список мягко удалённых записей с восстановлением и сроком хранения
function trashPanelHtml(){
  if(typeof purgeExpiredTrash==='function') purgeExpiredTrash();
  const trash=DB.trash||[];
  const selSt='background:var(--bg2);border:1px solid var(--line);border-radius:8px;padding:6px 9px;color:var(--txt);font-size:12.5px;outline:none;cursor:pointer';
  const rows = trash.length ? trash.map(r=>{
    const meta=TRASH_META[r.type]||{label:r.type,icon:'trash'};
    const left=trashMsLeft(r);
    const leftTxt = left===null ? 'хранится бессрочно' : (left>0 ? 'осталось '+Math.max(1,Math.ceil(left/86400000))+' дн.' : 'скоро удалится');
    const retOpts=RETENTION_OPTS.map(([d,l])=>`<option value="${d}"${r.retentionDays===d?' selected':''}>${l}</option>`).join('');
    return `<tr>
      <td><div class="cell-name">${icon(meta.icon,'sm')}<div><div style="font-weight:600">${escA(r.name||'—')}</div><div class="muted2" style="font-size:11.5px">${meta.label}${r.sub?' · '+escA(r.sub):''}</div></div></div></td>
      <td class="muted" style="white-space:nowrap">${dateStr(r.deletedAt)}</td>
      <td style="white-space:nowrap"><select data-act="trash-retention" data-id="${r.id}" style="${selSt}">${retOpts}</select><div class="muted2" style="font-size:11px;margin-top:3px">${leftTxt}</div></td>
      <td class="row-acts" style="white-space:nowrap">
        <button class="btn sm" data-act="trash-restore" data-id="${r.id}">${icon('refresh','sm')} Восстановить</button>
        <button class="btn sm danger ghost" data-act="trash-purge" data-id="${r.id}" title="Удалить навсегда">${icon('trash','sm')}</button></td></tr>`;
  }).join('') : `<tr><td colspan="4" class="muted" style="text-align:center;padding:24px">Корзина пуста</td></tr>`;
  return `<div class="panel section-gap"><div class="panel-h">${icon('trash')}<h3>Корзина</h3>
    <span class="ph-sub">${trash.length?trash.length+' элем. · восстановите или задайте срок хранения':'удалённые записи можно восстановить'}</span></div>
    <div class="tbl-scroll"><table class="tbl"><thead><tr><th>Запись</th><th>Удалено</th><th>Срок хранения</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}
function renderSettings(){
  const dir = state.user && state.user.role==='director'; // редактирование — только директор
  const emps=DB.users.map(u=>{
    const self = state.user && state.user.id===u.id;
    const acts = dir ? `<td class="row-acts">
      <button class="btn sm ghost" data-act="edit-user" data-id="${u.id}" title="Изменить">${icon('edit','sm')}</button>
      <button class="btn sm ghost" data-act="user-pass" data-id="${u.id}" title="Сменить пароль">${icon('lock','sm')}</button>
      ${self?'':`<button class="btn sm ghost" data-act="del-user" data-id="${u.id}" title="Удалить">${icon('trash','sm')}</button>`}</td>` : '';
    return `<tr><td><div class="cell-name">${avatarXs(u.name,u.id)}<span style="font-weight:600">${escA(u.name)}</span></div></td>
      <td><span class="tag blue">${roleRu(u.role)}</span></td><td class="muted">${escA(u.title)}</td>${acts}</tr>`;
  }).join('');
  const mods=Object.keys(MODULE_META);
  const permHead=`<tr><th>Модуль</th>${ROLES.map(r=>`<th style="text-align:center;white-space:nowrap">${escA(r.name)}${dir&&!r.sys?`<button class="x" style="width:19px;height:19px;display:inline-grid;vertical-align:middle;margin-left:5px" data-act="del-role" data-id="${r.id}" title="Удалить роль «${escA(r.name)}»">${icon('x','sm')}</button>`:''}</th>`).join('')}</tr>`;
  const permRows=mods.map(mod=>`<tr><td>${icon(MODULE_META[mod].icon,'sm')} ${MODULE_META[mod].name}</td>${ROLES.map(r=>{
    const ok=(MODULE_ROLES[mod]||[]).includes(r.id);
    const inner = ok?`<span class="yes">${icon('check','sm')}</span>`:'<span class="no">—</span>';
    return dir && r.id!=='director'
      ? `<td style="text-align:center"><button class="perm-cell${ok?' on':''}" data-act="perm-toggle" data-mod="${mod}" data-role="${r.id}" title="${ok?'Доступ открыт — нажмите, чтобы закрыть':'Доступ закрыт — нажмите, чтобы открыть'}">${inner}</button></td>`
      : `<td style="text-align:center">${inner}</td>`;}).join('')}</tr>`).join('');
  const coEdit = dir ? `<button class="btn sm ghost" style="margin-left:auto" data-act="edit-company">${icon('edit','sm')} Изменить</button>` : '';
  const usAdd  = dir ? `<button class="btn sm" style="margin-left:auto" data-act="add-user">${icon('plus','sm')} Добавить</button>` : '';
  const wa = (typeof waConfig==='object'&&waConfig) ? waConfig : {configured:false,enabled:false,idInstance:''};
  const waOn = wa.enabled && wa.configured;
  const ig = (typeof igConfig==='object'&&igConfig) ? igConfig : {configured:false,enabled:false,username:''};
  const igOn = ig.enabled && ig.configured;
  const igPanel = dir ? `
  <div class="panel section-gap"><div class="panel-h">${icon('clients')}<h3>Instagram · директ и заявки</h3>
    <span class="ph-sub">${igOn?'<span class="tag green">подключено</span>':(ig.configured?'<span class="tag amber">выключено</span>':'<span class="tag">не настроено</span>')}</span></div>
    <div class="panel-b">
      <div class="constr-body" style="padding:0">
        <div class="fld"><label>Аккаунт Instagram</label><input id="ig-user" value="${escA(ig.username||'')}" placeholder="напр. oceanglass.kg"></div>
        <div class="fld"><label>Токен сервиса</label><input id="ig-token" type="password" placeholder="${ig.configured?'•••••••• (задан, пусто = не менять)':'токен сервиса/Meta'}"></div>
        <div class="fld full"><label style="display:flex;align-items:center;gap:9px;font-size:13px;color:var(--txt);text-transform:none"><input type="checkbox" id="ig-enabled" ${ig.enabled?'checked':''} style="width:auto"> Включить приём заявок из Instagram</label></div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;align-items:center">
        <button class="btn primary" data-act="ig-save-config">${icon('check','sm')} Сохранить</button>
      </div>
      ${ig.webhookUrl?`<div class="fld full" style="margin-top:14px"><label>URL вебхука — вставьте в сервис Instagram (ManyChat / реклама / форвардер)</label>
        <input readonly value="${escA(ig.webhookUrl)}" style="font-size:11.5px"></div>`:''}
      <div class="muted2" style="font-size:11.5px;margin-top:10px;line-height:1.5">Green API работает только с WhatsApp. Для Instagram подключите сервис (ManyChat и аналоги ~$10–20/мес) или официальный Meta API, который шлёт входящие DM на наш URL вебхука. Каждое новое сообщение/заявка из рекламы автоматически создаёт клиента и сделку (источник «Instagram»). Нужен Instagram Business-аккаунт + привязанная Facebook-страница.</div>
    </div></div>` : '';
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
      <div class="stat-line"><span>Название</span><span style="font-weight:600">${escA(DB.company.legal)}</span></div>
      <div class="stat-line"><span>Город</span><span>${escA(DB.company.city)}</span></div>
      <div class="stat-line"><span>Телефон</span><span>${escA(DB.company.phone)}</span></div>
      <div class="stat-line"><span>Производство</span><span style="text-align:right">${escA(DB.company.workshop)}</span></div>
      <div class="stat-line"><span>Оборот</span><span>${escA(DB.company.revenueYear)}</span></div>
      ${DB.company.inn?`<div class="stat-line"><span>ИНН / ОКПО</span><span>${escA(DB.company.inn)}${DB.company.okpo?' · '+escA(DB.company.okpo):''}</span></div>`:''}
      ${DB.company.bank?`<div class="stat-line"><span>Банк</span><span style="text-align:right">${escA(DB.company.bank)}</span></div>`:''}
      ${DB.company.account?`<div class="stat-line"><span>Р/с · БИК</span><span style="text-align:right">${escA(DB.company.account)}${DB.company.bik?' · '+escA(DB.company.bik):''}</span></div>`:''}
      <div class="stat-line"><span>НДС</span><span>${DB.company.vatRate?escA(DB.company.vatRate)+' %':'без НДС'}</span></div>
    </div></div>
    <div class="panel"><div class="panel-h">${icon('clients')}<h3>Сотрудники</h3><span class="ph-sub">${DB.users.length}</span>${usAdd}</div>
      <div class="tbl-scroll"><table class="tbl"><tbody>${emps}</tbody></table></div></div>
  </div>
  <div class="panel section-gap"><div class="panel-h">${icon('shield')}<h3>Права доступа</h3><span class="ph-sub">${dir?'нажмите на ячейку, чтобы открыть/закрыть доступ роли к модулю':'кто что видит — сборщики и склад не видят финансы'}</span>${dir?`<button class="btn sm" style="margin-left:auto" data-act="add-role">${icon('plus','sm')} Роль</button>`:''}</div>
    <div class="tbl-scroll"><table class="tbl perm-tbl"><thead>${permHead}</thead><tbody>${permRows}</tbody></table></div></div>
  ${waPanel}
  ${igPanel}
  ${dir?waTplPanelHtml():''}
  ${dir?`<div class="panel section-gap"><div class="panel-h">${icon('doc')}<h3>Резервная копия</h3></div><div class="panel-b">
    <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap"><span class="muted" style="font-size:13px">Выгрузить все данные в файл (JSON) или восстановить из резервной копии.</span>
    <button class="btn" data-act="backup-export">${icon('doc','sm')} Экспорт всех данных</button>
    <button class="btn" data-act="backup-import">${icon('arrow','sm')} Восстановить из файла</button></div></div></div>`:''}
  <div class="panel section-gap"><div class="panel-h">${icon('refresh')}<h3>Демо-данные</h3></div><div class="panel-b">
    <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap"><span class="muted" style="font-size:13px">Сбросить все изменения и вернуть исходные демо-данные.</span>
    <button class="btn danger" data-act="reset">${icon('refresh','sm')} Сбросить демо</button></div></div></div>`;
}
