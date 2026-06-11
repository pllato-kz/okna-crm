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
  company:          { table: 'company',          pk: 'id', cols: ['id','name','legal','city','phone','workshop','revenue_year'] },
  roles:            { table: 'roles',            pk: 'id', cols: ['id','name','sort'] },
  modules:          { table: 'modules',          pk: 'id', cols: ['id','name','sort'] },
  module_roles:     { table: 'module_roles',     pk: null, cols: ['module_id','role_id'], composite: ['module_id','role_id'] },
  client_types:     { table: 'client_types',     pk: 'id', cols: ['id','name'] },
  lead_sources:     { table: 'lead_sources',     pk: 'id', cols: ['id','name','sort'] },
  deal_stages:      { table: 'deal_stages',      pk: 'id', cols: ['id','name','color','sort'] },
  prod_stages:      { table: 'prod_stages',      pk: 'id', cols: ['id','name','sort'] },
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
  deals:            { table: 'deals',             pk: 'id', cols: ['id','client_id','stage_id','manager_id','source_id','prod_stage_id','sum','note','hot','discount','prepay_pct','consumed_profile','consumed_glass','consumed_fittings','stage_since'], prefix: 'd' },
  deal_items:       { table: 'deal_items',        pk: 'id', cols: ['id','deal_id','profile_id','glass_id','opening_id','w','h','sashes','qty','sort'], prefix: 'cn' },
  deal_item_extras: { table: 'deal_item_extras',  pk: null, cols: ['item_id','extra_id'], composite: ['item_id','extra_id'] },
  payments:         { table: 'payments',          pk: 'id', cols: ['id','deal_id','type_id','amount','date'], prefix: 'p' },
  payables:         { table: 'payables',          pk: 'id', cols: ['id','supplier','for_what','amount','due','status_id'], prefix: 'pay' },
  activity:         { table: 'activity',          pk: 'id', cols: ['id','user_id','text','kind_id','at'], prefix: 'a' },
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
// Сделка целиком: позиции (+опции) и оплаты
async function getDealFull(env, id) {
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
  return deal;
}
// Полный снимок для фронта (заменит buildSeed/localStorage на Слое 4)
async function getBootstrap(env) {
  const company = await env.DB.prepare(`SELECT * FROM company LIMIT 1`).first();
  const [users, clients, materials, components, payables, activity, dealsRaw, movements] = await Promise.all([
    listRows(env, TABLES.users),
    listRows(env, TABLES.clients),
    listRows(env, TABLES.materials),
    listRows(env, TABLES.components),
    listRows(env, TABLES.payables),
    listRows(env, TABLES.activity),
    listRows(env, TABLES.deals),
    listRows(env, TABLES.warehouse_movements),
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
  return { company, catalogs: await getCatalogs(env), users, clients, materials, components, deals, payables, activity, movements };
}

/* ============ R2-ФАЙЛЫ ============ */
async function putFile(env, request, name) {
  const key = `${uid('f')}${name ? '-' + name.replace(/[^\w.\-]+/g, '_') : ''}`;
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
      const user = await env.DB.prepare(`SELECT * FROM users WHERE email = ? AND is_active = 1`).bind(email).first();
      if (!user || !(await verifyPassword(password, user.password_hash))) return fail(401, 'Неверный логин или пароль');
      const token = await signJWT({ sub: user.id, role: user.role_id, name: user.name, email: user.email }, env.JWT_SECRET);
      return ok({ token, user: { id: user.id, name: user.name, email: user.email, role_id: user.role_id, title: user.title } });
    }

    // ---- GUARD: всё остальное требует валидный JWT ----
    // Исключение: GET /api/files/:key открыт (чтобы файлы можно было встраивать как ресурсы).
    const publicFileGet = (segs[0] === 'files' && method === 'GET');
    if (!publicFileGet) {
      if (!env.JWT_SECRET) return fail(500, 'JWT_SECRET не задан (wrangler secret put JWT_SECRET)');
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

    // полный снимок данных
    if (segs[0] === 'bootstrap') return ok(await getBootstrap(env));

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
      const d = await getDealFull(env, segs[1]);
      return d ? ok(d) : fail(404, 'Сделка не найдена');
    }

    // ---- WhatsApp / Green API ----
    if (segs[0] === 'wa') {
      const getCfg = async () => await env.DB.prepare(`SELECT * FROM wa_config WHERE id = 'main'`).first();

      // GET /api/wa/config — НИКОГДА не отдаёт api_token (только факт, что он задан)
      if (segs[1] === 'config' && method === 'GET') {
        const c = await getCfg();
        return ok({ idInstance: (c && c.id_instance) || '', enabled: !!(c && c.enabled), configured: !!(c && c.id_instance && c.api_token) });
      }
      // PUT /api/wa/config — только директор. Пустой apiToken = не менять токен.
      if (segs[1] === 'config' && (method === 'PUT' || method === 'POST')) {
        if (context.auth.role !== 'director') return fail(403, 'Изменять может только директор');
        const b = await readBody(request);
        const cur = await getCfg();
        const idInstance = (b.idInstance != null ? String(b.idInstance).trim() : (cur && cur.id_instance) || '');
        const token = (b.apiToken != null && String(b.apiToken).trim() !== '') ? String(b.apiToken).trim() : ((cur && cur.api_token) || '');
        const enabled = b.enabled ? 1 : 0;
        await env.DB.prepare(`INSERT INTO wa_config (id, id_instance, api_token, enabled, updated_at) VALUES ('main', ?, ?, ?, datetime('now'))
          ON CONFLICT(id) DO UPDATE SET id_instance = excluded.id_instance, api_token = excluded.api_token, enabled = excluded.enabled, updated_at = excluded.updated_at`)
          .bind(idInstance, token, enabled).run();
        return ok({ idInstance, enabled: !!enabled, configured: !!(idInstance && token) });
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
        return ok({ sent: true, chatId, idMessage: data && data.idMessage });
      }
      return fail(404, 'Неизвестный метод wa');
    }

    // generic CRUD по реестру таблиц
    const resource = segs[0];
    const def = TABLES[resource];
    if (!def) return fail(404, `Неизвестный ресурс: ${resource}`);
    const id = segs[1];

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

    if (method === 'GET') {
      if (id) { const row = await getRow(env, def, id); return row ? ok(row) : fail(404, 'Не найдено'); }
      return ok(await listRows(env, def));
    }
    if (method === 'POST') {
      const body = await readBody(request);
      return created(await insertRow(env, def, body));
    }
    if (method === 'PUT' || method === 'PATCH') {
      if (!id) return fail(400, 'Нужен id в пути');
      const body = await readBody(request);
      const row = await updateRow(env, def, id, body);
      return row ? ok(row) : fail(404, 'Не найдено');
    }
    if (method === 'DELETE') {
      if (!id) return fail(400, 'Нужен id в пути');
      await deleteRow(env, def, id);
      return ok({ deleted: true });
    }
    return fail(405, `Метод ${method} не поддерживается`);
  } catch (e) {
    return fail(500, e && e.message ? e.message : 'Внутренняя ошибка');
  }
}
