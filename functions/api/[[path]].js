// functions/api/[[path]].js — REST API ОКНА CRM на Cloudflare Pages Functions.
// Бэкенд работает с D1 (env.DB) и R2 (env.BUCKET). Ответы — JSON.
//
// Клиент-независимость: никаких данных конкретного клиента в коде — только
// доступ к таблицам и справочникам, заданным схемой schema.sql.
// Авторизация (Слой 3): JWT в заголовке Authorization, защита эндпоинтов, роли.

'use strict';

import { hashPassword, verifyPassword, signJWT, verifyJWT, bearerToken } from './_auth.js';

/* ============ ХЕЛПЕРЫ ОТВЕТОВ ============ */
const HEADERS = { 'content-type': 'application/json; charset=utf-8' };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: HEADERS });
const ok = (data) => json(data, 200);
const created = (data) => json(data, 201);
const fail = (status, message) => json({ error: message }, status);

/* ============ РЕЕСТР ТАБЛИЦ (whitelist для generic CRUD) ============ */
// Для каждого ресурса: имя таблицы, первичный ключ и разрешённые колонки.
// Запись идёт только по этим колонкам — защита от инъекций и лишних полей.
const TABLES = {
  company:          { table: 'company',          pk: 'id', cols: ['id','name','legal','city','phone','workshop','revenue_year','doc_settings'] },
  roles:            { table: 'roles',            pk: 'id', cols: ['id','name','sort'] },
  modules:          { table: 'modules',          pk: 'id', cols: ['id','name','sort'] },
  module_roles:     { table: 'module_roles',     pk: null, cols: ['module_id','role_id'], composite: ['module_id','role_id'] },
  client_types:     { table: 'client_types',     pk: 'id', cols: ['id','name'] },
  lead_sources:     { table: 'lead_sources',     pk: 'id', cols: ['id','name','sort'] },
  deal_stages:      { table: 'deal_stages',      pk: 'id', cols: ['id','name','color','sort'] },
  prod_stages:      { table: 'prod_stages',      pk: 'id', cols: ['id','name','color','sort'] },
  material_types:   { table: 'material_types',   pk: 'id', cols: ['id','name'] },
  material_series:  { table: 'material_series',  pk: 'id', cols: ['id','name','sort'] },
  glass_types:      { table: 'glass_types',      pk: 'id', cols: ['id','name','rate','sort'] },
  openings:         { table: 'openings',         pk: 'id', cols: ['id','name','rate','sort'] },
  extras:           { table: 'extras',           pk: 'id', cols: ['id','name','price','per','sort'] },
  payment_types:    { table: 'payment_types',    pk: 'id', cols: ['id','name'] },
  payable_statuses: { table: 'payable_statuses', pk: 'id', cols: ['id','name'] },
  activity_kinds:   { table: 'activity_kinds',   pk: 'id', cols: ['id','name'] },
  // password_hash намеренно НЕ в cols — пароль выставляется отдельно (Слой 3),
  // и наружу через generic CRUD не отдаётся/не принимается.
  users:            { table: 'users',            pk: 'id', cols: ['id','name','email','role_id','title','is_primary','is_active'], prefix: 'u' },
  clients:          { table: 'clients',          pk: 'id', cols: ['id','name','phone','address','type_id'], prefix: 'cl' },
  materials:        { table: 'materials',         pk: 'id', cols: ['id','name','type_id','series_id','rate','stock','min_stock','unit','supplier'], prefix: 'm' },
  components:       { table: 'components',        pk: 'id', cols: ['id','name','stock','min_stock','unit'], prefix: 'c' },
  warehouse_movements: { table: 'warehouse_movements', pk: 'id', cols: ['id','kind','item_id','name','unit','dir','type','qty','reason','balance_after','deal_id','user_id','at'], prefix: 'wm' },
  deals:            { table: 'deals',             pk: 'id', cols: ['id','client_id','stage_id','manager_id','source_id','prod_stage_id','sum','note','hot','discount','prepay_pct','consumed_profile','consumed_glass','consumed_fittings','ready_date','install_date','contract_no','contract_date','stage_since'], prefix: 'd' },
  deal_items:       { table: 'deal_items',        pk: 'id', cols: ['id','deal_id','profile_id','glass_id','opening_id','w','h','sashes','sashes_json','price_override','qty','sort'], prefix: 'cn' },
  deal_item_extras: { table: 'deal_item_extras',  pk: null, cols: ['item_id','extra_id'], composite: ['item_id','extra_id'] },
  payments:         { table: 'payments',          pk: 'id', cols: ['id','deal_id','type_id','amount','date'], prefix: 'p' },
  payables:         { table: 'payables',          pk: 'id', cols: ['id','supplier','for_what','amount','due','status_id'], prefix: 'pay' },
  activity:         { table: 'activity',          pk: 'id', cols: ['id','user_id','text','kind_id','at'], prefix: 'a' },
  tasks:            { table: 'tasks',             pk: 'id', cols: ['id','deal_id','title','due','assignee_id','done'], prefix: 't' },
};

// Какие ресурсы считаются справочниками (для /api/catalogs)
const CATALOGS = ['roles','modules','module_roles','client_types','lead_sources',
  'deal_stages','prod_stages','material_types','material_series','glass_types',
  'openings','extras','payment_types','payable_statuses','activity_kinds'];

// Изменять эти ресурсы (справочники, пользователи, компания, права) может только директор.
// Чтение доступно любому авторизованному пользователю.
const ADMIN_WRITE = new Set(['users','company','module_roles','roles','modules',
  'client_types','lead_sources','deal_stages','prod_stages','material_types',
  'material_series','glass_types','openings','extras','payment_types',
  'payable_statuses','activity_kinds']);
const isWrite = (m) => m === 'POST' || m === 'PUT' || m === 'PATCH' || m === 'DELETE';

/* ============ РОЛЕВОЙ ДОСТУП К ДАННЫМ (RBAC) ============ */
// Зеркалит матрицу прав фронта (MODULE_ROLES). Раньше права жили только в UI —
// бэкенд пускал любого авторизованного к деньгам и чужим данным. Теперь гейтим тут.
const FINANCE_ROLES   = new Set(['director', 'manager']);                          // видят/правят деньги (finance, clients)
const DEAL_WRITE_ROLES = new Set(['director', 'manager', 'surveyor']);            // позиции замера и задачи
const DEAL_OPS_ROLES  = new Set(['director', 'manager', 'surveyor', 'production', 'warehouse']); // сама сделка: стадии цеха двигают цех и склад
const WAREHOUSE_ROLES = new Set(['director', 'manager', 'warehouse', 'production']); // правят склад
const isFinance = (role) => FINANCE_ROLES.has(role);

// Политика по ресурсам: read/write/del — наборы ролей; null = любой авторизованный.
// Денежные ресурсы (payments/payables) и денежные поля сделки — только finance-роли.
const RESOURCE_POLICY = {
  clients:             { read: null,          write: FINANCE_ROLES,    del: FINANCE_ROLES },
  deals:               { read: null,          write: DEAL_OPS_ROLES,   del: FINANCE_ROLES },
  deal_items:          { read: null,          write: DEAL_WRITE_ROLES },
  deal_item_extras:    { read: null,          write: DEAL_WRITE_ROLES },
  tasks:               { read: null,          write: DEAL_WRITE_ROLES },
  activity:            { read: null,          write: null },
  materials:           { read: null,          write: WAREHOUSE_ROLES, del: FINANCE_ROLES },
  components:          { read: null,          write: WAREHOUSE_ROLES, del: FINANCE_ROLES },
  warehouse_movements: { read: null,          write: WAREHOUSE_ROLES },
  payments:            { read: FINANCE_ROLES, write: FINANCE_ROLES, money: true },
  payables:            { read: FINANCE_ROLES, write: FINANCE_ROLES, money: true },
};
// Денежные поля сделки: не отдаём и не принимаем от не-finance ролей (иначе сборщик
// и склад видят/затирают суммы; редактируя стадию производства, обнулили бы sum).
const MONEY_DEAL_FIELDS = ['sum', 'discount', 'prepay_pct'];
// Поля сделки, которые не-finance роли НЕ вправе писать через generic CRUD:
// деньги + номер/дата договора (их выдаёт только атомарный finance-эндпоинт).
const PROTECTED_DEAL_WRITE_FIELDS = [...MONEY_DEAL_FIELDS, 'contract_no', 'contract_date'];
function redactDealMoney(d) {
  if (!d) return d;
  for (const f of MONEY_DEAL_FIELDS) delete d[f];
  if ('payments' in d) d.payments = [];
  return d;
}
// Не отдаём хэши паролей наружу ни одним путём.
function stripSecrets(rows) {
  for (const r of (Array.isArray(rows) ? rows : [rows])) { if (r) delete r.password_hash; }
  return rows;
}
// Проверка политики для generic-ресурса; возвращает текст ошибки или null (ок).
function policyDeny(resource, method, role) {
  const pol = RESOURCE_POLICY[resource];
  if (!pol) return null;
  if (method === 'GET') {
    if (pol.read && !pol.read.has(role)) return 'Нет доступа к этим данным';
  } else if (method === 'DELETE') {
    const set = pol.del || pol.write;
    if (set && !set.has(role)) return 'Недостаточно прав для удаления';
  } else if (isWrite(method)) {
    if (pol.write && !pol.write.has(role)) return 'Недостаточно прав для изменения';
  }
  return null;
}

// Серверная валидация записи (бэкстоп к фронту: защита от мусора/переполнения/
// отрицательных значений). Проверяем только присутствующие поля (PUT частичный).
// Возвращает текст ошибки или null.
function validateWrite(resource, body) {
  const n = (v) => (v === undefined || v === null || v === '') ? null : Number(v);
  const isNum = (v) => v !== null && Number.isFinite(v);
  if (resource === 'deal_items') {
    const w = n(body.w), h = n(body.h), s = n(body.sashes), q = n(body.qty);
    if (w !== null && (!isNum(w) || w < 0 || w > 20000)) return 'Ширина: 0–20000 мм';
    if (h !== null && (!isNum(h) || h < 0 || h > 20000)) return 'Высота: 0–20000 мм';
    if (s !== null && (!isNum(s) || s < 1 || s > 5)) return 'Створок: 1–5';
    if (q !== null && (!isNum(q) || q < 1 || q > 10000)) return 'Количество: 1–10000';
  } else if (resource === 'deals') {
    const disc = n(body.discount), pp = n(body.prepay_pct);
    if (disc !== null && (!isNum(disc) || disc < 0 || disc > 30)) return 'Скидка: 0–30%';
    if (pp !== null && (!isNum(pp) || pp < 0 || pp > 100)) return 'Предоплата: 0–100%';
  } else if (resource === 'payments') {
    const amt = n(body.amount);
    if (!isNum(amt) || amt <= 0 || amt > 1e12) return 'Сумма оплаты должна быть больше 0';
  } else if (resource === 'payables') {
    const amt = n(body.amount);
    if (amt !== null && (!isNum(amt) || amt < 0 || amt > 1e12)) return 'Некорректная сумма';
  } else if (resource === 'materials' || resource === 'components') {
    for (const f of ['rate', 'stock', 'min_stock']) {
      const v = n(body[f]);
      if (v !== null && (!isNum(v) || v < 0 || v > 1e9)) return `Некорректное значение поля «${f}»`;
    }
  }
  return null;
}

const uid = (p = 'id') => `${p}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;

/* ============ DB-ХЕЛПЕРЫ (generic) ============ */
async function listRows(env, def) {
  const { results } = await env.DB.prepare(`SELECT * FROM ${def.table}`).all();
  return results || [];
}
async function getRow(env, def, id) {
  return await env.DB.prepare(`SELECT * FROM ${def.table} WHERE ${def.pk} = ?`).bind(id).first();
}
async function insertRow(env, def, body) {
  const data = {};
  for (const c of def.cols) if (body[c] !== undefined) data[c] = body[c];
  // автогенерация PK, если не передан
  if (def.pk && (data[def.pk] === undefined || data[def.pk] === null || data[def.pk] === '')) {
    data[def.pk] = uid(def.prefix || 'id');
  }
  const keys = Object.keys(data);
  if (!keys.length) throw new Error('Нет полей для вставки');
  const placeholders = keys.map(() => '?').join(', ');
  const sql = `INSERT INTO ${def.table} (${keys.join(', ')}) VALUES (${placeholders})`;
  await env.DB.prepare(sql).bind(...keys.map(k => data[k])).run();
  return data;
}
async function updateRow(env, def, id, body) {
  const sets = [];
  const vals = [];
  for (const c of def.cols) {
    if (c === def.pk) continue;
    if (body[c] !== undefined) { sets.push(`${c} = ?`); vals.push(body[c]); }
  }
  if (!sets.length) return await getRow(env, def, id);
  vals.push(id);
  await env.DB.prepare(`UPDATE ${def.table} SET ${sets.join(', ')} WHERE ${def.pk} = ?`).bind(...vals).run();
  return await getRow(env, def, id);
}
async function deleteRow(env, def, id) {
  const r = await env.DB.prepare(`DELETE FROM ${def.table} WHERE ${def.pk} = ?`).bind(id).run();
  return r.meta;
}

/* ============ АГРЕГАТЫ ============ */
// Все справочники одним ответом
async function getCatalogs(env) {
  const out = {};
  for (const name of CATALOGS) out[name] = await listRows(env, TABLES[name]);
  return out;
}
// Сделка целиком: позиции (+опции) и оплаты. auth — для редакции денег.
async function getDealFull(env, id, auth) {
  const deal = await getRow(env, TABLES.deals, id);
  if (!deal) return null;
  const items = (await env.DB.prepare(`SELECT * FROM deal_items WHERE deal_id = ? ORDER BY sort`).bind(id).all()).results || [];
  for (const it of items) {
    const ex = (await env.DB.prepare(`SELECT extra_id FROM deal_item_extras WHERE item_id = ?`).bind(it.id).all()).results || [];
    it.extras = ex.map(r => r.extra_id);
  }
  const payments = (await env.DB.prepare(`SELECT * FROM payments WHERE deal_id = ? ORDER BY date`).bind(id).all()).results || [];
  deal.items = items;
  deal.payments = payments;
  if (auth && !isFinance(auth.role)) redactDealMoney(deal);
  return deal;
}
// Полный снимок для фронта (заменит buildSeed/localStorage на Слое 4).
// auth — текущий пользователь; не-finance роли не получают деньги (payables,
// оплаты, денежные поля сделок).
async function getBootstrap(env, auth) {
  const company = await env.DB.prepare(`SELECT * FROM company LIMIT 1`).first();
  const [users, clients, materials, components, payables, activity, dealsRaw, movements, tasks] = await Promise.all([
    listRows(env, TABLES.users),
    listRows(env, TABLES.clients),
    listRows(env, TABLES.materials),
    listRows(env, TABLES.components),
    listRows(env, TABLES.payables),
    listRows(env, TABLES.activity),
    listRows(env, TABLES.deals),
    listRows(env, TABLES.warehouse_movements),
    listRows(env, TABLES.tasks),
  ]);
  // password_hash не отдаём наружу
  for (const u of users) delete u.password_hash;
  const allItems = (await env.DB.prepare(`SELECT * FROM deal_items ORDER BY sort`).all()).results || [];
  const allExtras = (await env.DB.prepare(`SELECT * FROM deal_item_extras`).all()).results || [];
  const allPayments = (await env.DB.prepare(`SELECT * FROM payments ORDER BY date`).all()).results || [];
  const extrasByItem = {};
  for (const e of allExtras) (extrasByItem[e.item_id] ||= []).push(e.extra_id);
  for (const it of allItems) it.extras = extrasByItem[it.id] || [];
  const itemsByDeal = {};
  for (const it of allItems) (itemsByDeal[it.deal_id] ||= []).push(it);
  const paymentsByDeal = {};
  for (const p of allPayments) (paymentsByDeal[p.deal_id] ||= []).push(p);
  const deals = dealsRaw.map(d => ({ ...d, items: itemsByDeal[d.id] || [], payments: paymentsByDeal[d.id] || [] }));
  // редакция денег для не-finance ролей
  const finance = !auth || isFinance(auth.role);
  const dealsOut = finance ? deals : deals.map(d => redactDealMoney({ ...d }));
  const payablesOut = finance ? payables : [];
  // лента активности типа «money» содержит суммы оплат — прячем от не-finance
  const activityOut = finance ? activity : activity.filter(a => a.kind_id !== 'money');
  return { company, catalogs: await getCatalogs(env), users, clients, materials, components, deals: dealsOut, payables: payablesOut, activity: activityOut, movements, tasks };
}

/* ============ WHATSAPP ============ */
// номер → только цифры, 8→7
function waDigits(s) { let d = String(s || '').replace(/\D/g, ''); if (d.length === 11 && d[0] === '8') d = '7' + d.slice(1); return d; }
// найти клиента по номеру (сравниваем по цифрам)
async function waResolveClient(env, chatId) {
  const target = waDigits(String(chatId).split('@')[0]);
  if (!target) return null;
  const rows = (await env.DB.prepare(`SELECT id, phone FROM clients`).all()).results || [];
  for (const c of rows) if (waDigits(c.phone) === target) return c.id;
  return null;
}
// может ли роль писать в WhatsApp (право 'wa' в матрице; директор — всегда;
// если право не сконфигурировано — не ломаем, разрешаем)
async function waRoleAllowed(env, role) {
  if (role === 'director') return true;
  const rows = (await env.DB.prepare(`SELECT role_id FROM module_roles WHERE module_id = 'wa'`).all()).results || [];
  if (!rows.length) return true;
  return rows.some(r => r.role_id === role);
}
// сохранить сообщение (идемпотентно по id)
async function waStoreMessage(env, m) {
  await env.DB.prepare(`INSERT INTO wa_messages (id, chat_id, client_id, direction, text, sender_name, status, ts, at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET status = COALESCE(excluded.status, wa_messages.status)`)
    .bind(m.id, m.chat_id, m.client_id || null, m.direction, m.text || '', m.sender_name || null, m.status || null,
          m.ts || null, m.at || new Date().toISOString()).run();
}
// разбор уведомления Green API
async function handleWaWebhook(env, body) {
  const type = body && body.typeWebhook;
  if (!type) return;
  const idMessage = body.idMessage || (body.timestamp ? 'wm_' + body.timestamp + Math.random().toString(36).slice(2, 6) : uid('wm'));
  const sd = body.senderData || {};
  const chatId = sd.chatId || (body.instanceData && body.instanceData.wid) || '';
  const md = body.messageData || {};
  const text = (md.textMessageData && md.textMessageData.textMessage)
    || (md.extendedTextMessageData && md.extendedTextMessageData.text)
    || (md.typeMessage && md.typeMessage !== 'textMessage' ? '[' + md.typeMessage + ']' : '');
  if (type === 'incomingMessageReceived') {
    let clientId = await waResolveClient(env, chatId);
    // имя из карточки WhatsApp; убираем угловые скобки (защита от внедрения HTML) и ограничиваем длину
    const waName = (sd.senderName || sd.chatName || '').replace(/[<>]/g, '').trim().slice(0, 80);
    // новый номер → заводим клиента с именем из карточки WhatsApp
    if (!clientId) {
      const digits = waDigits(String(chatId).split('@')[0]);
      if (digits) {
        clientId = uid('cl');
        const name = waName || ('+' + digits);
        const city = (await env.DB.prepare(`SELECT city FROM company WHERE id = 'main'`).first())?.city || '';
        await env.DB.prepare(`INSERT INTO clients (id, name, phone, address, type_id, created_at) VALUES (?, ?, ?, ?, 'individual', ?)`)
          .bind(clientId, name, '+' + digits, city, new Date().toISOString()).run();
        await env.DB.prepare(`INSERT INTO activity (id, user_id, text, kind_id, at, created_at) VALUES (?, NULL, ?, 'lead', ?, ?)`)
          .bind(uid('a'), 'Новый лид из WhatsApp — ' + name, new Date().toISOString(), new Date().toISOString()).run();
        // авто-создание сделки в воронке (стадия «Новый лид», источник WhatsApp),
        // чтобы заявка сразу попадала в пайплайн менеджеру
        const nowIso = new Date().toISOString();
        try {
          await env.DB.prepare(`INSERT INTO deals (id, client_id, stage_id, source_id, sum, note, hot, discount, prepay_pct, created_at, stage_since) VALUES (?, ?, 'lead', 'whatsapp', 0, 'Заявка из WhatsApp', 0, 0, 30, ?, ?)`)
            .bind(uid('d'), clientId, nowIso, nowIso).run();
        } catch (e) { /* источник/таблица могут отсутствовать на старой схеме — не роняем вебхук */ }
      }
    }
    await waStoreMessage(env, { id: idMessage, chat_id: chatId, client_id: clientId, direction: 'in',
      text, sender_name: waName, ts: body.timestamp, at: body.timestamp ? new Date(body.timestamp * 1000).toISOString() : null });
  } else if (type === 'outgoingMessageReceived' || type === 'outgoingAPIMessageReceived') {
    const clientId = await waResolveClient(env, chatId);
    await waStoreMessage(env, { id: idMessage, chat_id: chatId, client_id: clientId, direction: 'out',
      text, status: 'sent', ts: body.timestamp, at: body.timestamp ? new Date(body.timestamp * 1000).toISOString() : null });
  } else if (type === 'outgoingMessageStatus' && body.idMessage) {
    await env.DB.prepare(`UPDATE wa_messages SET status = ? WHERE id = ?`).bind(body.status || 'sent', body.idMessage).run();
  }
}

/* ============ INSTAGRAM (провайдеро-независимо) ============ */
// Любой сервис (ManyChat/реклама IG/кастомный форвардер) шлёт нормализованный
// вебхук → создаём клиента + сделку (источник instagram) + историю сообщений.
async function igStoreMessage(env, m){
  await env.DB.prepare(`INSERT INTO ig_messages (id, chat_id, client_id, direction, text, sender_name, status, at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET status = COALESCE(excluded.status, ig_messages.status)`)
    .bind(m.id, m.chat_id, m.client_id || null, m.direction, m.text || '', m.sender_name || null, m.status || null, m.at || new Date().toISOString()).run();
}
async function igResolveClient(env, handle){
  if(!handle) return null;
  const row = await env.DB.prepare(`SELECT client_id FROM ig_messages WHERE chat_id = ? AND client_id IS NOT NULL ORDER BY created_at DESC LIMIT 1`).bind(handle).first();
  return row ? row.client_id : null;
}
// нормализуем разные shapes: {username|from|sender.username, name, text|message, adLead}
async function handleIgWebhook(env, body){
  if(!body) return;
  const uname = String(body.username || body.from || (body.sender && (body.sender.username || body.sender.id)) || '').replace(/[<>@\s]/g,'').slice(0,80);
  if(!uname) return;
  const name = String(body.name || (body.sender && body.sender.name) || uname).replace(/[<>]/g,'').trim().slice(0,80);
  const adLead = !!(body.adLead || body.ad || body.source==='ad');
  let text = String(body.text || body.message || (body.message && body.message.text) || '').slice(0,500);
  if(!text && adLead) text='Заявка с рекламы Instagram';
  const handle = '@'+uname;
  const idMessage = body.idMessage || ('ig_'+Date.now()+Math.random().toString(36).slice(2,6));
  let clientId = await igResolveClient(env, handle);
  if(!clientId){
    clientId = uid('cl');
    const city = (await env.DB.prepare(`SELECT city FROM company WHERE id='main'`).first())?.city || '';
    await env.DB.prepare(`INSERT INTO clients (id, name, phone, address, type_id, created_at) VALUES (?, ?, ?, ?, 'individual', ?)`)
      .bind(clientId, name+' (Instagram)', handle, city, new Date().toISOString()).run();
    await env.DB.prepare(`INSERT INTO activity (id, user_id, text, kind_id, at, created_at) VALUES (?, NULL, ?, 'lead', ?, ?)`)
      .bind(uid('a'), 'Новый лид из Instagram — '+name, new Date().toISOString(), new Date().toISOString()).run();
    const nowIso = new Date().toISOString();
    const note = adLead ? 'Заявка с рекламы Instagram' : ('Заявка из Instagram' + (text ? (': '+text.slice(0,160)) : ''));
    try{ await env.DB.prepare(`INSERT INTO deals (id, client_id, stage_id, source_id, sum, note, hot, discount, prepay_pct, created_at, stage_since) VALUES (?, ?, 'lead', 'instagram', 0, ?, ?, 0, 30, ?, ?)`)
      .bind(uid('d'), clientId, note, adLead?1:0, nowIso, nowIso).run(); }catch(e){}
  }
  if(text) await igStoreMessage(env, { id:idMessage, chat_id:handle, client_id:clientId, direction:'in', text, sender_name:name, at:new Date().toISOString() });
}

/* ============ R2-ФАЙЛЫ ============ */
async function putFile(env, request, name) {
  // ключ — криптослучайный (не угадать перебором), не Math.random
  const rand = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID().replace(/-/g, '') : uid('f');
  const key = `${rand}${name ? '-' + name.replace(/[^\w.\-]+/g, '_') : ''}`;
  const body = await request.arrayBuffer();
  await env.BUCKET.put(key, body, {
    httpMetadata: { contentType: request.headers.get('content-type') || 'application/octet-stream' },
  });
  return { key, url: `/api/files/${key}` };
}
async function getFile(env, key) {
  const obj = await env.BUCKET.get(key);
  if (!obj) return fail(404, 'Файл не найден');
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  return new Response(obj.body, { headers });
}

/* ============ ЧТЕНИЕ ТЕЛА ============ */
async function readBody(request) {
  if (request.method === 'GET' || request.method === 'DELETE') return {};
  try { return await request.json(); } catch (_) { return {}; }
}

/* ============ СТАТИСТИКА ХРАНИЛИЩА (D1 + R2) ============ */
// D1: размер БД = page_count × page_size; число строк по основным таблицам.
// R2: суммарный размер и количество объектов (постранично через list).
// Лимиты — ориентир Cloudflare free (D1 5 ГБ, R2 10 ГБ).
async function getStorageStats(env) {
  const out = { d1: null, r2: null };
  // ---- D1 ----
  try {
    // размер БД: D1 отдаёт его в meta.size_after любого запроса (PRAGMA page_count
    // в D1 не работает). Подстраховка — dbstat, если доступен.
    let bytes = 0;
    try { const r = await env.DB.prepare('SELECT 1').run(); bytes = Number(r && r.meta && r.meta.size_after) || 0; } catch (_) {}
    if (!bytes) { try { const r = await env.DB.prepare('SELECT SUM(pgsize) AS b FROM dbstat').first(); bytes = Number(r && r.b) || 0; } catch (_) {} }
    const tables = ['clients', 'deals', 'deal_items', 'payments', 'payables', 'materials',
      'components', 'warehouse_movements', 'activity', 'tasks', 'users'];
    let rows = 0; const byTable = {};
    for (const t of tables) {
      try { const r = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${t}`).first(); const n = Number(r && r.n) || 0; byTable[t] = n; rows += n; } catch (_) {}
    }
    out.d1 = { bytes, rows, byTable, limit: 5 * 1024 * 1024 * 1024 };
  } catch (e) { out.d1 = { error: true, limit: 5 * 1024 * 1024 * 1024 }; }
  // ---- R2 ----
  try {
    if (env.BUCKET) {
      let bytes = 0, count = 0, cursor, pages = 0;
      do {
        const lst = await env.BUCKET.list({ cursor, limit: 1000 });
        for (const o of (lst.objects || [])) { bytes += (o.size || 0); count++; }
        cursor = lst.truncated ? lst.cursor : undefined; pages++;
      } while (cursor && pages < 20);
      out.r2 = { bytes, count, limit: 10 * 1024 * 1024 * 1024 };
    } else { out.r2 = { error: true, limit: 10 * 1024 * 1024 * 1024 }; }
  } catch (e) { out.r2 = { error: true, limit: 10 * 1024 * 1024 * 1024 }; }
  return out;
}

/* ============ ТОЧКА ВХОДА ============ */
export async function onRequest(context) {
  const { request, env, params } = context;
  const segs = (params.path || []).filter(Boolean); // напр. ['deals','d1','full']
  const method = request.method.toUpperCase();
  const url = new URL(request.url);

  try {
    if (!segs.length) return ok({ name: 'okna-crm API', version: 1 });

    // health (публичный)
    if (segs[0] === 'health') return ok({ status: 'ok', time: new Date().toISOString() });

    // вход (публичный): email + password → JWT
    if (segs[0] === 'login') {
      if (method !== 'POST') return fail(405, 'Только POST');
      const { email, password } = await readBody(request);
      if (!email || !password) return fail(400, 'Нужны email и password');
      if (!env.JWT_SECRET) return fail(500, 'JWT_SECRET не задан (wrangler secret put JWT_SECRET)');
      // защита от перебора: не более LIMIT неудачных попыток за окно по IP/email
      const LIMIT = 10, WINDOW_MIN = 15;
      const ip = request.headers.get('cf-connecting-ip') || 'unknown';
      const now = Date.now();
      try { await env.DB.prepare(`DELETE FROM login_attempts WHERE at < ?`).bind(new Date(now - 60 * 60 * 1000).toISOString()).run(); } catch (_) {}
      const since = new Date(now - WINDOW_MIN * 60 * 1000).toISOString();
      const cnt = await env.DB.prepare(`SELECT COUNT(*) AS n FROM login_attempts WHERE (ip = ? OR email = ?) AND at > ?`).bind(ip, email, since).first();
      if (cnt && cnt.n >= LIMIT) {
        return new Response(JSON.stringify({ error: `Слишком много попыток входа. Повторите через ${WINDOW_MIN} минут.` }),
          { status: 429, headers: { ...HEADERS, 'Retry-After': String(WINDOW_MIN * 60) } });
      }
      const user = await env.DB.prepare(`SELECT * FROM users WHERE email = ? AND is_active = 1`).bind(email).first();
      if (!user || !(await verifyPassword(password, user.password_hash))) {
        try { await env.DB.prepare(`INSERT INTO login_attempts (ip, email, at) VALUES (?, ?, ?)`).bind(ip, email, new Date(now).toISOString()).run(); } catch (_) {}
        return fail(401, 'Неверный логин или пароль');
      }
      // успех — сбрасываем счётчик попыток для этого ip/email
      try { await env.DB.prepare(`DELETE FROM login_attempts WHERE ip = ? OR email = ?`).bind(ip, email).run(); } catch (_) {}
      const token = await signJWT({ sub: user.id, role: user.role_id, name: user.name, email: user.email }, env.JWT_SECRET);
      return ok({ token, user: { id: user.id, name: user.name, email: user.email, role_id: user.role_id, title: user.title } });
    }

    // вебхук WhatsApp (ПУБЛИЧНЫЙ — Green API не присылает наш JWT; защищён секретом)
    if (segs[0] === 'wa' && segs[1] === 'webhook') {
      if (method !== 'POST') return ok({ ok: true }); // Green API проверяет URL и GET-ом
      const cfg = await env.DB.prepare(`SELECT * FROM wa_config WHERE id = 'main'`).first();
      // секрет приходит в заголовке Authorization (webhookUrlToken у Green API);
      // ?key= оставлен как запасной вариант для совместимости
      const key = bearerToken(request) || url.searchParams.get('key');
      if (!cfg || !cfg.webhook_secret || key !== cfg.webhook_secret) return fail(401, 'bad webhook key');
      const body = await readBody(request);
      try { await handleWaWebhook(env, body); } catch (e) { /* не роняем вебхук — Green API иначе зашлёт ретраи */ }
      return ok({ received: true });
    }

    // вебхук Instagram (ПУБЛИЧНЫЙ — сервис-форвардер шлёт без нашего JWT; защищён секретом)
    if (segs[0] === 'ig' && segs[1] === 'webhook') {
      // верификация подписки (Meta шлёт GET hub.challenge) — отдаём как есть
      if (method === 'GET') { const ch = url.searchParams.get('hub.challenge'); return ch ? new Response(ch, { status: 200 }) : ok({ ok: true }); }
      const cfg = await env.DB.prepare(`SELECT * FROM ig_config WHERE id = 'main'`).first();
      const key = url.searchParams.get('key') || bearerToken(request);
      if (!cfg || !cfg.webhook_secret || key !== cfg.webhook_secret) return fail(401, 'bad webhook key');
      const body = await readBody(request);
      try { await handleIgWebhook(env, body); } catch (e) { /* не роняем вебхук */ }
      return ok({ received: true });
    }

    // ---- GUARD: всё остальное требует валидный JWT (включая файлы) ----
    // Раньше GET /api/files/:key был публичным «чтобы встраивать как ресурсы» —
    // но это давало неавторизованный доступ к загруженным файлам. UI файлы как
    // <img src> не встраивает, поэтому просто требуем токен. Понадобится встраивание —
    // делать через подписанные URL (HMAC ключа+exp), а не открытый доступ.
    if (!env.JWT_SECRET) return fail(500, 'JWT_SECRET не задан (wrangler secret put JWT_SECRET)');
    {
      const auth = await verifyJWT(bearerToken(request), env.JWT_SECRET);
      if (!auth) return fail(401, 'Требуется авторизация');
      context.auth = auth;
    }

    // текущий пользователь
    if (segs[0] === 'me') {
      const u = await getRow(env, TABLES.users, context.auth.sub);
      if (u) delete u.password_hash;
      return u ? ok(u) : ok({ id: context.auth.sub, role_id: context.auth.role, name: context.auth.name, email: context.auth.email });
    }

    // полный снимок данных (с редакцией денег по роли)
    if (segs[0] === 'bootstrap') return ok(await getBootstrap(env, context.auth));

    // все справочники
    if (segs[0] === 'catalogs') return ok(await getCatalogs(env));

    // файлы (R2)
    if (segs[0] === 'files') {
      if (method === 'POST') return created(await putFile(env, request, url.searchParams.get('name')));
      if (method === 'GET' && segs[1]) return await getFile(env, segs.slice(1).join('/'));
      return fail(405, 'Метод не поддерживается для /files');
    }

    // сделка целиком
    if (segs[0] === 'deals' && segs[1] && segs[2] === 'full') {
      if (method !== 'GET') return fail(405, 'Только GET');
      const d = await getDealFull(env, segs[1], context.auth);
      return d ? ok(d) : fail(404, 'Сделка не найдена');
    }

    // атомная выдача номера договора: POST /api/deals/:id/contract-number
    // (раньше номер считался в браузере → гонка/дубли при многопользовательской работе)
    if (segs[0] === 'deals' && segs[1] && segs[2] === 'contract-number') {
      if (method !== 'POST') return fail(405, 'Только POST');
      if (!FINANCE_ROLES.has(context.auth.role)) return fail(403, 'Недостаточно прав');
      const dealId = segs[1];
      const deal = await env.DB.prepare(`SELECT id, contract_no, contract_date FROM deals WHERE id = ?`).bind(dealId).first();
      if (!deal) return fail(404, 'Сделка не найдена');
      if (deal.contract_no) return ok({ contractNo: deal.contract_no, contractDate: deal.contract_date }); // идемпотентно
      const year = new Date().getFullYear();
      // атомарный инкремент счётчика года (RETURNING поддерживается D1)
      const row = await env.DB.prepare(
        `INSERT INTO counters (name, val) VALUES (?, 1) ON CONFLICT(name) DO UPDATE SET val = val + 1 RETURNING val`
      ).bind('contract-' + year).first();
      const no = 'Д-' + year + '-' + String(row.val).padStart(3, '0');
      const date = new Date().toISOString().slice(0, 10);
      // присваиваем только если ещё не присвоено — защита от гонки по одной сделке
      await env.DB.prepare(`UPDATE deals SET contract_no = COALESCE(contract_no, ?), contract_date = COALESCE(contract_date, ?) WHERE id = ?`)
        .bind(no, date, dealId).run();
      const fresh = await env.DB.prepare(`SELECT contract_no, contract_date FROM deals WHERE id = ?`).bind(dealId).first();
      return ok({ contractNo: fresh.contract_no, contractDate: fresh.contract_date });
    }

    // ---- SIP / WebRTC софтфон («звонки из браузера») ----
    // GET  /api/sip/token — выдаёт браузеру SIP-креды для подключения к Asterisk.
    // POST /api/sip/log   — лог завершённого звонка в ленту активности.
    // Пока Asterisk не поднят (нет SIP_DOMAIN/SIP_ENDPOINT_PASSWORD) → 503,
    // фронт это понимает и тихо прячет софтфон. Голос через бэкенд НЕ идёт.
    if (segs[0] === 'sip') {
      if (!env.SIP_DOMAIN || !env.SIP_ENDPOINT_PASSWORD) return fail(503, 'sip_not_configured');
      const auth = context.auth;
      if (segs[1] === 'token' && method === 'GET') {
        const domain = env.SIP_DOMAIN;
        const iceServers = [{ urls: `stun:${domain}:3478` }, { urls: 'stun:stun.l.google.com:19302' }];
        if (env.SIP_TURN_URL && env.SIP_TURN_USERNAME && env.SIP_TURN_PASSWORD) {
          iceServers.push({ urls: [env.SIP_TURN_URL, env.SIP_TURN_URL + '?transport=tcp'], username: env.SIP_TURN_USERNAME, credential: env.SIP_TURN_PASSWORD });
        }
        return ok({
          user: env.SIP_USER || '100',
          password: env.SIP_ENDPOINT_PASSWORD,
          domain,
          wss: `wss://${domain}:8089/ws`,
          iceServers,
          display_name: auth.name || auth.email || '',
          user_id: auth.sub,
          role: auth.role,
        });
      }
      if (segs[1] === 'log' && method === 'POST') {
        const body = await readBody(request);
        const phone = String(body && (body.phone || body.external_number) || '').replace(/[^\d]/g, '');
        const durationSec = Math.max(0, Number(body && (body.duration_sec ?? body.durationSec)) || 0);
        const incoming = !!(body && (body.incoming || body.direction === 'in'));
        const mmss = `${Math.floor(durationSec / 60)}:${String(durationSec % 60).padStart(2, '0')}`;
        const text = `${incoming ? '📞 Входящий' : '📞 Исходящий'} звонок · ${mmss}${phone ? ` · +${phone}` : ''}`;
        // лог в ленту активности; FK на activity_kinds('call') — добавлен в seed.
        try {
          await env.DB.prepare(`INSERT INTO activity (id, user_id, text, kind_id, at) VALUES (?,?,?,?,?)`)
            .bind('a_' + (crypto.randomUUID ? crypto.randomUUID() : Date.now()), auth.sub, text, 'call', new Date().toISOString()).run();
        } catch (e) { /* не блокируем звонок из-за лога */ }
        return ok({ ok: true });
      }
      return fail(404, 'Неизвестный SIP-эндпоинт');
    }

    // ---- Хранилище данных: размер D1 (база) + R2 (файлы), только директор ----
    if (segs[0] === 'storage') {
      if (method !== 'GET') return fail(405, 'Только GET');
      if (context.auth.role !== 'director') return fail(403, 'Недостаточно прав');
      return ok(await getStorageStats(env));
    }

    // ---- WhatsApp / Green API ----
    if (segs[0] === 'wa') {
      const getCfg = async () => await env.DB.prepare(`SELECT * FROM wa_config WHERE id = 'main'`).first();

      // GET /api/wa/config — НИКОГДА не отдаёт api_token (только факт, что он задан)
      if (segs[1] === 'config' && method === 'GET') {
        const c = await getCfg();
        const out = { idInstance: (c && c.id_instance) || '', enabled: !!(c && c.enabled), configured: !!(c && c.id_instance && c.api_token) };
        // URL вебхука показываем только директору (содержит секрет)
        if (context.auth.role === 'director' && c && c.webhook_secret) {
          out.webhookUrl = url.origin + '/api/wa/webhook'; // секрет идёт в заголовке, не в URL
        }
        return ok(out);
      }
      // PUT /api/wa/config — только директор. Пустой apiToken = не менять токен.
      if (segs[1] === 'config' && (method === 'PUT' || method === 'POST')) {
        if (context.auth.role !== 'director') return fail(403, 'Изменять может только директор');
        const b = await readBody(request);
        const cur = await getCfg();
        const idInstance = (b.idInstance != null ? String(b.idInstance).trim() : (cur && cur.id_instance) || '');
        const token = (b.apiToken != null && String(b.apiToken).trim() !== '') ? String(b.apiToken).trim() : ((cur && cur.api_token) || '');
        const enabled = b.enabled ? 1 : 0;
        const secret = (cur && cur.webhook_secret) || (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : uid('wh') + uid('s'));
        await env.DB.prepare(`INSERT INTO wa_config (id, id_instance, api_token, enabled, webhook_secret, updated_at) VALUES ('main', ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(id) DO UPDATE SET id_instance = excluded.id_instance, api_token = excluded.api_token, enabled = excluded.enabled, webhook_secret = excluded.webhook_secret, updated_at = excluded.updated_at`)
          .bind(idInstance, token, enabled, secret).run();
        return ok({ idInstance, enabled: !!enabled, configured: !!(idInstance && token), webhookUrl: url.origin + '/api/wa/webhook' });
      }
      // GET /api/wa/messages?clientId=|chatId= — история чата (любой авторизованный)
      if (segs[1] === 'messages' && method === 'GET') {
        if (!(await waRoleAllowed(env, context.auth.role))) return fail(403, 'Нет доступа к WhatsApp');
        const clientId = url.searchParams.get('clientId');
        let chatId = url.searchParams.get('chatId');
        let rows;
        if (clientId) {
          const cl = await env.DB.prepare(`SELECT phone FROM clients WHERE id = ?`).bind(clientId).first();
          const digits = cl ? waDigits(cl.phone) : '';
          const cid = digits ? digits + '@c.us' : '';
          rows = (await env.DB.prepare(`SELECT * FROM wa_messages WHERE client_id = ? OR chat_id = ? ORDER BY COALESCE(ts,0), created_at`).bind(clientId, cid).all()).results || [];
        } else if (chatId) {
          rows = (await env.DB.prepare(`SELECT * FROM wa_messages WHERE chat_id = ? ORDER BY COALESCE(ts,0), created_at`).bind(chatId).all()).results || [];
        } else {
          rows = (await env.DB.prepare(`SELECT * FROM wa_messages ORDER BY COALESCE(ts,0) DESC, created_at DESC LIMIT 100`).all()).results || [];
        }
        return ok({ messages: rows });
      }
      // POST /api/wa/setup-webhook — зарегистрировать наш вебхук в Green API (только директор)
      if (segs[1] === 'setup-webhook' && method === 'POST') {
        if (context.auth.role !== 'director') return fail(403, 'Только директор');
        const c = await getCfg();
        if (!c || !c.id_instance || !c.api_token) return fail(400, 'Сначала задайте инстанс');
        let secret = c.webhook_secret;
        if (!secret) { secret = (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : uid('wh')); await env.DB.prepare(`UPDATE wa_config SET webhook_secret = ? WHERE id = 'main'`).bind(secret).run(); }
        const webhookUrl = url.origin + '/api/wa/webhook'; // секрет передаётся как webhookUrlToken (заголовок)
        try {
          const r = await fetch(`https://api.green-api.com/waInstance${c.id_instance}/setSettings/${c.api_token}`, {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ webhookUrl, webhookUrlToken: secret, incomingWebhook: 'yes', outgoingMessageWebhook: 'yes', outgoingAPIMessageWebhook: 'yes', stateWebhook: 'yes' }),
          });
          const d = await r.json().catch(() => null);
          if (!r.ok) return fail(502, 'Green API setSettings: ' + (d && d.message ? d.message : 'ошибка'));
          return ok({ ok: true, webhookUrl, result: d });
        } catch (e) { return fail(502, 'Green API недоступен: ' + ((e && e.message) || '')); }
      }
      // GET /api/wa/status — состояние инстанса в Green API
      if (segs[1] === 'status' && method === 'GET') {
        const c = await getCfg();
        if (!c || !c.id_instance || !c.api_token) return ok({ configured: false });
        try {
          const r = await fetch(`https://api.green-api.com/waInstance${c.id_instance}/getStateInstance/${c.api_token}`);
          const d = await r.json().catch(() => null);
          return ok({ configured: true, ok: r.ok, stateInstance: d && d.stateInstance });
        } catch (e) { return ok({ configured: true, ok: false, error: (e && e.message) || 'нет связи' }); }
      }
      // POST /api/wa/send — отправка сообщения (любой авторизованный)
      if (segs[1] === 'send' && method === 'POST') {
        if (!(await waRoleAllowed(env, context.auth.role))) return fail(403, 'Нет доступа к WhatsApp');
        const c = await getCfg();
        if (!c || !c.enabled) return fail(400, 'WhatsApp-интеграция выключена');
        if (!c.id_instance || !c.api_token) return fail(400, 'Не заданы данные инстанса Green API');
        const b = await readBody(request);
        const message = String(b.message || '').trim();
        if (!message) return fail(400, 'Пустое сообщение');
        let chatId = b.chatId ? String(b.chatId) : '';
        if (!chatId) {
          let digits = String(b.phone || '').replace(/\D/g, '');
          if (digits.length === 11 && digits[0] === '8') digits = '7' + digits.slice(1);
          if (!digits) return fail(400, 'Не указан номер получателя');
          chatId = digits + '@c.us';
        }
        let res;
        try {
          res = await fetch(`https://api.green-api.com/waInstance${c.id_instance}/sendMessage/${c.api_token}`, {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chatId, message }),
          });
        } catch (e) { return fail(502, 'Green API недоступен: ' + ((e && e.message) || '')); }
        const txt = await res.text();
        let data = null; try { data = JSON.parse(txt); } catch (_) { data = txt; }
        if (!res.ok) return fail(502, 'Green API: ' + (data && data.message ? data.message : (typeof data === 'string' ? data : JSON.stringify(data))));
        // сохраняем исходящее в историю чата
        const idMessage = (data && data.idMessage) || uid('wm');
        const clientId = b.clientId || await waResolveClient(env, chatId);
        try { await waStoreMessage(env, { id: idMessage, chat_id: chatId, client_id: clientId, direction: 'out', text: message, status: 'sent', ts: Math.floor(Date.now() / 1000), at: new Date().toISOString() }); } catch (e) {}
        return ok({ sent: true, chatId, idMessage });
      }
      return fail(404, 'Неизвестный метод wa');
    }

    // ---- Instagram ----
    if (segs[0] === 'ig') {
      const getCfg = async () => await env.DB.prepare(`SELECT * FROM ig_config WHERE id = 'main'`).first();
      // GET /api/ig/config — токен наружу не отдаём; webhookUrl (с секретом) — только директору
      if (segs[1] === 'config' && method === 'GET') {
        const c = await getCfg();
        const out = { username: (c && c.username) || '', enabled: !!(c && c.enabled), configured: !!(c && c.username) };
        if (context.auth.role === 'director' && c && c.webhook_secret) out.webhookUrl = url.origin + '/api/ig/webhook?key=' + c.webhook_secret;
        return ok(out);
      }
      // PUT /api/ig/config — только директор. Пустой token = не менять.
      if (segs[1] === 'config' && (method === 'PUT' || method === 'POST')) {
        if (context.auth.role !== 'director') return fail(403, 'Изменять может только директор');
        const b = await readBody(request); const cur = await getCfg();
        const username = (b.username != null ? String(b.username).trim().replace(/^@/, '') : (cur && cur.username) || '');
        const token = (b.token != null && String(b.token).trim() !== '') ? String(b.token).trim() : ((cur && cur.token) || '');
        const enabled = b.enabled ? 1 : 0;
        const secret = (cur && cur.webhook_secret) || (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : uid('igs') + uid('s'));
        await env.DB.prepare(`INSERT INTO ig_config (id, username, token, enabled, webhook_secret, updated_at) VALUES ('main', ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(id) DO UPDATE SET username = excluded.username, token = excluded.token, enabled = excluded.enabled, webhook_secret = excluded.webhook_secret, updated_at = excluded.updated_at`)
          .bind(username, token, enabled, secret).run();
        return ok({ username, enabled: !!enabled, configured: !!username, webhookUrl: url.origin + '/api/ig/webhook?key=' + secret });
      }
      // GET /api/ig/messages?clientId= — история переписки
      if (segs[1] === 'messages' && method === 'GET') {
        const clientId = url.searchParams.get('clientId');
        let rows;
        if (clientId) {
          const cl = await env.DB.prepare(`SELECT phone FROM clients WHERE id = ?`).bind(clientId).first();
          rows = (await env.DB.prepare(`SELECT * FROM ig_messages WHERE client_id = ? OR chat_id = ? ORDER BY created_at`).bind(clientId, (cl && cl.phone) || '').all()).results || [];
        } else {
          rows = (await env.DB.prepare(`SELECT * FROM ig_messages ORDER BY created_at DESC LIMIT 100`).all()).results || [];
        }
        return ok({ messages: rows });
      }
      // POST /api/ig/send — исходящее. Доставка зависит от подключённого сервиса;
      // здесь сохраняем в историю (на боевой — пробрасываем в API провайдера).
      if (segs[1] === 'send' && method === 'POST') {
        const b = await readBody(request); const text = String(b.text || '').trim(); const handle = String(b.handle || b.chatId || '').trim();
        if (!text || !handle) return fail(400, 'Нужны handle и text');
        const id = 'ig_' + Date.now() + Math.random().toString(36).slice(2, 6);
        await igStoreMessage(env, { id, chat_id: handle, client_id: b.clientId || await igResolveClient(env, handle), direction: 'out', text, status: 'sent', at: new Date().toISOString() });
        return ok({ sent: true, id, note: 'Сохранено в историю. Реальная доставка — через подключённый сервис Instagram.' });
      }
      return fail(404, 'Неизвестный метод ig');
    }

    // generic CRUD по реестру таблиц
    const resource = segs[0];
    const def = TABLES[resource];
    if (!def) return fail(404, `Неизвестный ресурс: ${resource}`);
    const id = segs[1];

    // ---- РОЛЕВОЙ ГЕЙТ по ресурсу (до спец-обработчиков и generic CRUD) ----
    const deny = policyDeny(resource, method, context.auth.role);
    if (deny) return fail(403, deny);

    // удаление профиля: блок, если используется в позициях сделок (FK)
    if (resource === 'materials' && method === 'DELETE' && id) {
      const cnt = await env.DB.prepare(`SELECT COUNT(*) AS n FROM deal_items WHERE profile_id = ?`).bind(id).first();
      if (cnt && cnt.n > 0) return fail(409, `Профиль используется в сделках (${cnt.n}) — удалить нельзя`);
      await env.DB.prepare(`DELETE FROM materials WHERE id = ?`).bind(id).run();
      return ok({ deleted: true });
    }

    // удаление сделки: явная чистка детей (позиции, опции, оплаты) — не полагаемся на каскад
    if (resource === 'deals' && method === 'DELETE' && id) {
      await env.DB.prepare(`DELETE FROM deal_item_extras WHERE item_id IN (SELECT id FROM deal_items WHERE deal_id = ?)`).bind(id).run();
      await env.DB.prepare(`DELETE FROM deal_items WHERE deal_id = ?`).bind(id).run();
      await env.DB.prepare(`DELETE FROM payments WHERE deal_id = ?`).bind(id).run();
      await env.DB.prepare(`DELETE FROM tasks WHERE deal_id = ?`).bind(id).run();
      await env.DB.prepare(`DELETE FROM deals WHERE id = ?`).bind(id).run();
      return ok({ deleted: true });
    }

    // удаление клиента: блок при наличии сделок (FK) + чистка переписки
    if (resource === 'clients' && method === 'DELETE' && id) {
      const cnt = await env.DB.prepare(`SELECT COUNT(*) AS n FROM deals WHERE client_id = ?`).bind(id).first();
      if (cnt && cnt.n > 0) return fail(409, `У клиента есть сделки (${cnt.n}) — удалите их сначала`);
      await env.DB.prepare(`DELETE FROM wa_messages WHERE client_id = ?`).bind(id).run();
      await env.DB.prepare(`DELETE FROM clients WHERE id = ?`).bind(id).run();
      return ok({ deleted: true });
    }

    // удаление роли (только директор): блок если назначена сотрудникам + чистка прав
    if (resource === 'roles' && method === 'DELETE' && id) {
      if (context.auth.role !== 'director') return fail(403, 'Недостаточно прав: изменять может только директор');
      const cnt = await env.DB.prepare(`SELECT COUNT(*) AS n FROM users WHERE role_id = ?`).bind(id).first();
      if (cnt && cnt.n > 0) return fail(409, `Роль назначена сотрудникам (${cnt.n}) — сначала смените им роль`);
      await env.DB.prepare(`DELETE FROM module_roles WHERE role_id = ?`).bind(id).run();
      await env.DB.prepare(`DELETE FROM roles WHERE id = ?`).bind(id).run();
      return ok({ deleted: true });
    }

    // установка/смена пароля: POST /api/users/:id/password { password }
    // разрешено директору или самому пользователю
    if (resource === 'users' && id && segs[2] === 'password') {
      if (method !== 'POST' && method !== 'PUT') return fail(405, 'Только POST/PUT');
      if (context.auth.role !== 'director' && context.auth.sub !== id) return fail(403, 'Недостаточно прав');
      const { password } = await readBody(request);
      if (!password || String(password).length < 6) return fail(400, 'Пароль минимум 6 символов');
      const hash = await hashPassword(String(password));
      const r = await env.DB.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).bind(hash, id).run();
      if (!r.meta || r.meta.changes === 0) return fail(404, 'Пользователь не найден');
      return ok({ updated: true });
    }

    // guard: изменение справочников/пользователей/компании/прав — только директор
    if (ADMIN_WRITE.has(resource) && isWrite(method) && context.auth.role !== 'director') {
      return fail(403, 'Недостаточно прав: изменять может только директор');
    }

    // составной ключ (deal_item_extras, module_roles)
    if (def.composite) {
      if (method === 'GET') return ok(await listRows(env, def));
      const body = await readBody(request);
      if (method === 'POST') {
        const data = {};
        for (const c of def.cols) data[c] = body[c];
        await env.DB.prepare(`INSERT OR IGNORE INTO ${def.table} (${def.cols.join(', ')}) VALUES (${def.cols.map(() => '?').join(', ')})`)
          .bind(...def.cols.map(c => data[c])).run();
        return created(data);
      }
      if (method === 'DELETE') {
        const where = def.composite.map(c => `${c} = ?`).join(' AND ');
        const vals = def.composite.map(c => body[c] ?? url.searchParams.get(c));
        await env.DB.prepare(`DELETE FROM ${def.table} WHERE ${where}`).bind(...vals).run();
        return ok({ deleted: true });
      }
      return fail(405, 'Метод не поддерживается');
    }

    // для не-finance ролей денежные поля сделки не отдаём и не принимаем;
    // номер/дату договора им тоже писать нельзя (только finance-эндпоинт).
    const redactMoney = resource === 'deals' && !isFinance(context.auth.role);
    if (method === 'GET') {
      if (id) { const row = await getRow(env, def, id); if (redactMoney) redactDealMoney(row); if (resource === 'users') stripSecrets(row); return row ? ok(row) : fail(404, 'Не найдено'); }
      let rows = await listRows(env, def);
      if (redactMoney) rows.forEach(redactDealMoney);
      if (resource === 'users') stripSecrets(rows);
      // лента «money» содержит суммы оплат — прячем от не-finance
      if (resource === 'activity' && !isFinance(context.auth.role)) rows = rows.filter(a => a.kind_id !== 'money');
      return ok(rows);
    }
    if (method === 'POST') {
      const body = await readBody(request);
      if (redactMoney) for (const f of PROTECTED_DEAL_WRITE_FIELDS) delete body[f];
      const vErr = validateWrite(resource, body);
      if (vErr) return fail(400, vErr);
      return created(await insertRow(env, def, body));
    }
    if (method === 'PUT' || method === 'PATCH') {
      if (!id) return fail(400, 'Нужен id в пути');
      const body = await readBody(request);
      if (redactMoney) for (const f of PROTECTED_DEAL_WRITE_FIELDS) delete body[f];
      const vErr = validateWrite(resource, body);
      if (vErr) return fail(400, vErr);
      const row = await updateRow(env, def, id, body);
      if (redactMoney) redactDealMoney(row);
      if (resource === 'users') stripSecrets(row);
      return row ? ok(row) : fail(404, 'Не найдено');
    }
    if (method === 'DELETE') {
      if (!id) return fail(400, 'Нужен id в пути');
      await deleteRow(env, def, id);
      return ok({ deleted: true });
    }
    return fail(405, `Метод ${method} не поддерживается`);
  } catch (e) {
    // не светим внутренности (SQL/стек) наружу — пишем в лог, отдаём общий текст
    try { console.error('API error:', e && e.stack ? e.stack : e); } catch (_) {}
    return fail(500, 'Внутренняя ошибка сервера');
  }
}
