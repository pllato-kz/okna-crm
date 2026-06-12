'use strict';
/* ============ api.js — слой доступа к серверному API (Слой 4) ============
 * Вход (JWT), обёртка fetch и маппинг серверных данных (snake_case из D1)
 * в формат, который ожидает текущий фронтенд (как buildSeed/DB).
 * UI не меняется — меняется только источник данных.
 * Глобальный объект: API.*
 */
const API_TOKEN_KEY = 'okna_crm_token';

function apiGetToken(){ try { return localStorage.getItem(API_TOKEN_KEY) || null; } catch (e) { return null; } }
function apiSetToken(t){ try { t ? localStorage.setItem(API_TOKEN_KEY, t) : localStorage.removeItem(API_TOKEN_KEY); } catch (e) {} }

/* Запрос к API. path без ведущего /api. body-объект сериализуется в JSON. */
async function apiFetch(path, opts){
  opts = opts || {};
  const headers = Object.assign({}, opts.headers || {});
  const token = apiGetToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  let body = opts.body;
  if (body && typeof body !== 'string' && !(body instanceof ArrayBuffer)) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(body);
  }
  const res = await fetch('/api/' + String(path).replace(/^\/+/, ''), { method: opts.method || 'GET', headers, body });
  const txt = await res.text();
  let data = null;
  if (txt) { try { data = JSON.parse(txt); } catch (_) { data = txt; } }
  if (!res.ok) {
    const err = new Error((data && data.error) || ('HTTP ' + res.status));
    err.status = res.status; err.data = data;
    if (res.status === 401) apiSetToken(null); // протух токен — сбрасываем
    throw err;
  }
  return data;
}

/* Вход: сохраняет JWT, возвращает {token, user}. */
async function apiLogin(email, password){
  const r = await apiFetch('login', { method: 'POST', body: { email, password } });
  if (r && r.token) apiSetToken(r.token);
  return r;
}
function apiLogout(){ apiSetToken(null); }
async function apiMe(){ return await apiFetch('me'); }

/* ---- маппинг серверных строк → формат фронтенда ---- */
function apiIndexBy(arr){ const m = {}; for (const x of (arr || [])) m[x.id] = x; return m; }
function apiName(idx, id){ return (idx[id] && idx[id].name) || id || ''; }
function apiSortByOrder(arr){ return (arr || []).slice().sort((a, b) => (a.sort || 0) - (b.sort || 0)); }

/* Преобразует ответ /api/bootstrap в { DB, catalogs } в терминах фронта. */
function apiMapBootstrap(boot){
  const cat = boot.catalogs || {};
  const clientTypes = apiIndexBy(cat.client_types);
  const sources     = apiIndexBy(cat.lead_sources);
  const matTypes    = apiIndexBy(cat.material_types);
  const matSeries   = apiIndexBy(cat.material_series);
  const payTypes    = apiIndexBy(cat.payment_types);
  const payStatuses = apiIndexBy(cat.payable_statuses);

  const company = boot.company ? {
    id: boot.company.id,
    name: boot.company.name, legal: boot.company.legal, city: boot.company.city,
    phone: boot.company.phone, workshop: boot.company.workshop, revenueYear: boot.company.revenue_year,
    // реквизиты и шаблон договора лежат в одном JSON-поле doc_settings
    ...(() => { try { return boot.company.doc_settings ? JSON.parse(boot.company.doc_settings) : {}; } catch(e){ return {}; } })(),
  } : {};

  const users = (boot.users || []).map(u => ({
    id: u.id, name: u.name, email: u.email, role: u.role_id, title: u.title, primary: !!u.is_primary,
  }));
  const clients = (boot.clients || []).map(c => ({
    id: c.id, name: c.name, phone: c.phone, address: c.address, type: apiName(clientTypes, c.type_id),
  }));
  const materials = (boot.materials || []).map(m => ({
    id: m.id, name: m.name, type: apiName(matTypes, m.type_id), series: apiName(matSeries, m.series_id),
    rate: m.rate, stock: m.stock, min: m.min_stock, unit: m.unit, supplier: m.supplier,
  }));
  const components = (boot.components || []).map(c => ({
    id: c.id, name: c.name, stock: c.stock, min: c.min_stock, unit: c.unit,
  }));
  const deals = (boot.deals || []).map(d => ({
    id: d.id, clientId: d.client_id, stage: d.stage_id, manager: d.manager_id,
    source: apiName(sources, d.source_id), prodStage: d.prod_stage_id, sum: d.sum, note: d.note,
    hot: !!d.hot, discount: d.discount, prepayPct: d.prepay_pct,
    consumed: { profile: !!d.consumed_profile, glass: !!d.consumed_glass, fittings: !!d.consumed_fittings },
    createdAt: d.created_at, stageSince: d.stage_since,
    readyDate: d.ready_date || null, installDate: d.install_date || null,
    contractNo: d.contract_no || null, contractDate: d.contract_date || null,
    items: (d.items || []).map(it => ({
      id: it.id, profileId: it.profile_id, glassId: it.glass_id, openId: it.opening_id,
      w: it.w, h: it.h, sashes: it.sashes, qty: it.qty, extras: (it.extras || []).slice(),
    })),
    payments: (d.payments || []).map(p => ({ id: p.id, type: apiName(payTypes, p.type_id), amount: p.amount, date: p.date })),
    kp: null,
  }));
  const payables = (boot.payables || []).map(p => ({
    id: p.id, supplier: p.supplier, forWhat: p.for_what, amount: p.amount, due: p.due, status: apiName(payStatuses, p.status_id),
  }));
  const activity = (boot.activity || []).map(a => ({ who: a.user_id, text: a.text, at: a.at, kind: a.kind_id }));
  const movements = (boot.movements || []).map(m => ({
    id: m.id, kind: m.kind, itemId: m.item_id, name: m.name, unit: m.unit,
    dir: m.dir, type: m.type, qty: m.qty, reason: m.reason,
    balanceAfter: m.balance_after, dealId: m.deal_id, who: m.user_id, at: m.at,
  }));
  const tasks = (boot.tasks || []).map(t => ({
    id: t.id, dealId: t.deal_id, title: t.title, due: t.due, assignee: t.assignee_id, done: !!t.done,
  }));

  // справочники-константы фронта (раньше хардкод в data.js)
  const STAGES      = apiSortByOrder(cat.deal_stages).map(s => ({ id: s.id, name: s.name, color: s.color }));
  const PROD_STAGES = apiSortByOrder(cat.prod_stages).map(s => ({ id: s.id, name: s.name, color: s.color }));
  const GLASS       = apiSortByOrder(cat.glass_types).map(g => ({ id: g.id, name: g.name, rate: g.rate }));
  const OPENINGS    = apiSortByOrder(cat.openings).map(o => ({ id: o.id, name: o.name, rate: o.rate }));
  const EXTRAS      = apiSortByOrder(cat.extras).map(e => ({ id: e.id, name: e.name, price: e.price, per: e.per }));
  const MODULE_ROLES = {};
  for (const mr of (cat.module_roles || [])) (MODULE_ROLES[mr.module_id] = MODULE_ROLES[mr.module_id] || []).push(mr.role_id);
  const SYS_ROLES = ['director','manager','surveyor','production','warehouse'];
  const ROLES = apiSortByOrder(cat.roles || []).map(r => ({ id: r.id, name: r.name, sys: SYS_ROLES.includes(r.id) }));

  return {
    DB: { v: 1, company, users, materials, components, clients, deals, payables, activity, movements, tasks },
    catalogs: { STAGES, PROD_STAGES, GLASS, OPENINGS, EXTRAS, MODULE_ROLES, ROLES },
  };
}

/* Загружает полный снимок с сервера и возвращает {DB, catalogs}. */
async function apiLoadBootstrap(){
  const boot = await apiFetch('bootstrap');
  API._cat = boot.catalogs || {};   // сохраняем справочники для обратного маппинга при записи
  return apiMapBootstrap(boot);
}

/* ---- обратный маппинг (лейбл → id) для записи ---- */
function apiRevId(catArr, label){ for (const x of (catArr || [])) if (x.name === label) return x.id; return null; }
function apiDealToServer(d, withId){
  const b = {
    client_id: d.clientId, stage_id: d.stage, manager_id: d.manager || null,
    source_id: apiRevId((API._cat || {}).lead_sources, d.source),
    prod_stage_id: d.prodStage || null, sum: d.sum || 0, note: d.note || '',
    hot: d.hot ? 1 : 0, discount: d.discount || 0, prepay_pct: (d.prepayPct != null ? d.prepayPct : 30),
    consumed_profile: d.consumed && d.consumed.profile ? 1 : 0,
    consumed_glass: d.consumed && d.consumed.glass ? 1 : 0,
    consumed_fittings: d.consumed && d.consumed.fittings ? 1 : 0,
    ready_date: d.readyDate || null, install_date: d.installDate || null,
    contract_no: d.contractNo || null, contract_date: d.contractDate || null,
    stage_since: d.stageSince || null,
  };
  if (withId) b.id = d.id;
  return b;
}

/* ---- методы записи (используются фронтом в API-режиме) ---- */
const apiPersist = {
  createClient: (c) => apiFetch('clients', { method: 'POST', body: {
    id: c.id, name: c.name, phone: c.phone, address: c.address, type_id: apiRevId((API._cat || {}).client_types, c.type),
  }}),
  saveClient: (c) => apiFetch('clients/' + c.id, { method: 'PUT', body: {
    name: c.name, phone: c.phone, address: c.address, type_id: apiRevId((API._cat || {}).client_types, c.type),
  }}),
  createDeal: (d) => apiFetch('deals', { method: 'POST', body: apiDealToServer(d, true) }),
  saveDeal:   (d) => apiFetch('deals/' + d.id, { method: 'PUT', body: apiDealToServer(d, false) }),
  // атомная выдача номера договора на сервере (без гонок); идемпотентно
  allocateContract: (dealId) => apiFetch('deals/' + dealId + '/contract-number', { method: 'POST' }),
  createItem: (dealId, it) => apiFetch('deal_items', { method: 'POST', body: {
    id: it.id, deal_id: dealId, profile_id: it.profileId, glass_id: it.glassId, opening_id: it.openId,
    w: it.w, h: it.h, sashes: it.sashes, qty: it.qty,
  }}),
  saveItem:   (it) => apiFetch('deal_items/' + it.id, { method: 'PUT', body: {
    profile_id: it.profileId, glass_id: it.glassId, opening_id: it.openId, w: it.w, h: it.h, sashes: it.sashes, qty: it.qty,
  }}),
  deleteItem: (itemId) => apiFetch('deal_items/' + itemId, { method: 'DELETE' }),
  setItemExtra: (itemId, extraId, on) => on
    ? apiFetch('deal_item_extras', { method: 'POST', body: { item_id: itemId, extra_id: extraId } })
    : apiFetch('deal_item_extras?item_id=' + encodeURIComponent(itemId) + '&extra_id=' + encodeURIComponent(extraId), { method: 'DELETE' }),
  createPayment: (dealId, p) => apiFetch('payments', { method: 'POST', body: {
    id: p.id, deal_id: dealId, type_id: apiRevId((API._cat || {}).payment_types, p.type), amount: p.amount, date: p.date,
  }}),
  saveMaterial:  (m) => apiFetch('materials/' + m.id, { method: 'PUT', body: { stock: m.stock, rate: m.rate, supplier: m.supplier } }),
  saveComponent: (c) => apiFetch('components/' + c.id, { method: 'PUT', body: { stock: c.stock } }),
  // управление номенклатурой склада (карточка позиции)
  createMaterial: (m) => apiFetch('materials', { method: 'POST', body: {
    id: m.id, name: m.name, type_id: apiRevId((API._cat || {}).material_types, m.type), series_id: apiRevId((API._cat || {}).material_series, m.series),
    rate: m.rate || 0, stock: m.stock || 0, min_stock: m.min || 0, unit: m.unit, supplier: m.supplier || '',
  }}),
  saveMaterialCard: (m) => apiFetch('materials/' + m.id, { method: 'PUT', body: {
    name: m.name, type_id: apiRevId((API._cat || {}).material_types, m.type), series_id: apiRevId((API._cat || {}).material_series, m.series),
    rate: m.rate || 0, min_stock: m.min || 0, unit: m.unit, supplier: m.supplier || '',
  }}),
  deleteMaterial: (id) => apiFetch('materials/' + id, { method: 'DELETE' }),
  createComponent: (c) => apiFetch('components', { method: 'POST', body: {
    id: c.id, name: c.name, stock: c.stock || 0, min_stock: c.min || 0, unit: c.unit,
  }}),
  saveComponentCard: (c) => apiFetch('components/' + c.id, { method: 'PUT', body: { name: c.name, min_stock: c.min || 0, unit: c.unit } }),
  deleteComponent: (id) => apiFetch('components/' + id, { method: 'DELETE' }),
  createPayable: (p) => apiFetch('payables', { method: 'POST', body: {
    id: p.id, supplier: p.supplier, for_what: p.forWhat, amount: p.amount, due: p.due, status_id: apiRevId((API._cat || {}).payable_statuses, p.status),
  }}),
  savePayable: (p) => apiFetch('payables/' + p.id, { method: 'PUT', body: {
    supplier: p.supplier, for_what: p.forWhat, amount: p.amount, due: p.due, status_id: apiRevId((API._cat || {}).payable_statuses, p.status),
  }}),
  deletePayable: (id) => apiFetch('payables/' + id, { method: 'DELETE' }),
  createTask: (t) => apiFetch('tasks', { method: 'POST', body: {
    id: t.id, deal_id: t.dealId || null, title: t.title, due: t.due || null, assignee_id: t.assignee || null, done: t.done ? 1 : 0,
  }}),
  saveTask: (t) => apiFetch('tasks/' + t.id, { method: 'PUT', body: {
    title: t.title, due: t.due || null, assignee_id: t.assignee || null, done: t.done ? 1 : 0,
  }}),
  deleteTask: (id) => apiFetch('tasks/' + id, { method: 'DELETE' }),
  createMovement: (m) => apiFetch('warehouse_movements', { method: 'POST', body: {
    id: m.id, kind: m.kind, item_id: m.itemId, name: m.name, unit: m.unit,
    dir: m.dir, type: m.type, qty: m.qty, reason: m.reason || '',
    balance_after: m.balanceAfter, deal_id: m.dealId || null, user_id: m.who, at: m.at,
  }}),
  createActivity:(a) => apiFetch('activity', { method: 'POST', body: { user_id: a.who, text: a.text, kind_id: a.kind, at: a.at } }),

  /* ---- настройки (только директор; бэкенд гейтит роль) ---- */
  saveCompany: (c) => apiFetch('company/' + c.id, { method: 'PUT', body: {
    name: c.name, legal: c.legal, city: c.city, phone: c.phone, workshop: c.workshop, revenue_year: c.revenueYear,
    doc_settings: JSON.stringify({
      address: c.address || '', inn: c.inn || '', okpo: c.okpo || '', bank: c.bank || '',
      account: c.account || '', bik: c.bik || '', director: c.director || '', directorShort: c.directorShort || '',
      vatRate: c.vatRate || 0, stamp: !!c.stamp, contractTpl: c.contractTpl || '',
    }),
  }}),
  createUser: (u) => apiFetch('users', { method: 'POST', body: {
    id: u.id, name: u.name, email: u.email, role_id: u.role, title: u.title,
    is_primary: u.primary ? 1 : 0, is_active: 1,
  }}),
  saveUser: (u) => apiFetch('users/' + u.id, { method: 'PUT', body: {
    name: u.name, email: u.email, role_id: u.role, title: u.title, is_primary: u.primary ? 1 : 0,
  }}),
  deleteUser: (id) => apiFetch('users/' + id, { method: 'DELETE' }),
  setUserPassword: (id, password) => apiFetch('users/' + id + '/password', { method: 'POST', body: { password } }),
  setModuleRole: (moduleId, roleId, on) => on
    ? apiFetch('module_roles', { method: 'POST', body: { module_id: moduleId, role_id: roleId } })
    : apiFetch('module_roles?module_id=' + encodeURIComponent(moduleId) + '&role_id=' + encodeURIComponent(roleId), { method: 'DELETE' }),
  createRole: (r) => apiFetch('roles', { method: 'POST', body: { id: r.id, name: r.name } }),
  saveRole:   (r) => apiFetch('roles/' + r.id, { method: 'PUT', body: { name: r.name } }),
  deleteRole: (id) => apiFetch('roles/' + id, { method: 'DELETE' }),
};

/* ---- WhatsApp / Green API ---- */
const apiWa = {
  getConfig: () => apiFetch('wa/config'),
  saveConfig: (cfg) => apiFetch('wa/config', { method: 'PUT', body: {
    idInstance: cfg.idInstance || '', apiToken: cfg.apiToken || '', enabled: cfg.enabled ? 1 : 0,
  }}),
  status: () => apiFetch('wa/status'),
  send: (phone, message, extra) => apiFetch('wa/send', { method: 'POST', body: Object.assign({ phone, message }, extra || {}) }),
  messages: (q) => apiFetch('wa/messages' + (q && q.clientId ? '?clientId=' + encodeURIComponent(q.clientId) : (q && q.chatId ? '?chatId=' + encodeURIComponent(q.chatId) : ''))),
  setupWebhook: () => apiFetch('wa/setup-webhook', { method: 'POST' }),
};

const API = {
  TOKEN_KEY: API_TOKEN_KEY,
  enabled: false,            // включается после успешного входа/bootstrap; в демо-режиме остаётся false
  _cat: {},
  getToken: apiGetToken,
  setToken: apiSetToken,
  fetch: apiFetch,
  login: apiLogin,
  logout: apiLogout,
  me: apiMe,
  loadBootstrap: apiLoadBootstrap,
  mapBootstrap: apiMapBootstrap,
  isAuthed: () => !!apiGetToken(),
  persist: apiPersist,
  wa: apiWa,
};
try { globalThis.API = API; } catch (e) {}
