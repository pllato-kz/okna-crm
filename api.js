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
    name: boot.company.name, legal: boot.company.legal, city: boot.company.city,
    phone: boot.company.phone, workshop: boot.company.workshop, revenueYear: boot.company.revenue_year,
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

  // справочники-константы фронта (раньше хардкод в data.js)
  const STAGES      = apiSortByOrder(cat.deal_stages).map(s => ({ id: s.id, name: s.name, color: s.color }));
  const PROD_STAGES = apiSortByOrder(cat.prod_stages).map(s => ({ id: s.id, name: s.name }));
  const GLASS       = apiSortByOrder(cat.glass_types).map(g => ({ id: g.id, name: g.name, rate: g.rate }));
  const OPENINGS    = apiSortByOrder(cat.openings).map(o => ({ id: o.id, name: o.name, rate: o.rate }));
  const EXTRAS      = apiSortByOrder(cat.extras).map(e => ({ id: e.id, name: e.name, price: e.price, per: e.per }));
  const MODULE_ROLES = {};
  for (const mr of (cat.module_roles || [])) (MODULE_ROLES[mr.module_id] = MODULE_ROLES[mr.module_id] || []).push(mr.role_id);

  return {
    DB: { v: 1, company, users, materials, components, clients, deals, payables, activity },
    catalogs: { STAGES, PROD_STAGES, GLASS, OPENINGS, EXTRAS, MODULE_ROLES },
  };
}

/* Загружает полный снимок с сервера и возвращает {DB, catalogs}. */
async function apiLoadBootstrap(){
  const boot = await apiFetch('bootstrap');
  return apiMapBootstrap(boot);
}

const API = {
  TOKEN_KEY: API_TOKEN_KEY,
  getToken: apiGetToken,
  setToken: apiSetToken,
  fetch: apiFetch,
  login: apiLogin,
  logout: apiLogout,
  me: apiMe,
  loadBootstrap: apiLoadBootstrap,
  mapBootstrap: apiMapBootstrap,
  isAuthed: () => !!apiGetToken(),
};
try { globalThis.API = API; } catch (e) {}
