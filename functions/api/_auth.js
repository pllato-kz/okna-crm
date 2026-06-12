// functions/api/_auth.js — крипто-хелперы авторизации (общий модуль, не маршрут).
// Файлы с префиксом «_» Pages Functions в роутинг не включает — только импорт.
//
// Пароли: PBKDF2-SHA256 (стойкий, встроен в Web Crypto — без внешних зависимостей).
// Токены: JWT HS256, подпись секретом env.JWT_SECRET (в коде секрета НЕТ).

'use strict';

const enc = new TextEncoder();
const dec = new TextDecoder();
const PBKDF2_ITERATIONS = 100000;

/* ---- base64url ---- */
function bytesToB64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlToBytes(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const strToB64url = (str) => bytesToB64url(enc.encode(str));
const b64urlToStr = (str) => dec.decode(b64urlToBytes(str));

/* ---- сравнение за постоянное время ---- */
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ---- пароли (PBKDF2) ---- */
async function deriveBitsB64(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256);
  return bytesToB64url(new Uint8Array(bits));
}
// Формат хранения: pbkdf2$<iterations>$<saltB64url>$<hashB64url>
export async function hashPassword(password, iterations = PBKDF2_ITERATIONS) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveBitsB64(password, salt, iterations);
  return `pbkdf2$${iterations}$${bytesToB64url(salt)}$${hash}`;
}
export async function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const [scheme, iterStr, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'pbkdf2' || !iterStr || !saltB64 || !hashB64) return false;
  const salt = b64urlToBytes(saltB64);
  const hash = await deriveBitsB64(password, salt, parseInt(iterStr, 10));
  return timingSafeEqual(hash, hashB64);
}

/* ---- JWT (HS256) ---- */
async function hmacB64url(secret, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return bytesToB64url(new Uint8Array(sig));
}
export async function signJWT(payload, secret, ttlSec = 28800 /* 8 часов (рабочая смена) */) {
  const now = Math.floor(Date.now() / 1000);
  const header = strToB64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = strToB64url(JSON.stringify({ ...payload, iat: now, exp: now + ttlSec }));
  const data = `${header}.${body}`;
  const sig = await hmacB64url(secret, data);
  return `${data}.${sig}`;
}
export async function verifyJWT(token, secret) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const expected = await hmacB64url(secret, `${h}.${p}`);
  if (!timingSafeEqual(s, expected)) return null;
  let body;
  try { body = JSON.parse(b64urlToStr(p)); } catch (_) { return null; }
  if (body.exp && Math.floor(Date.now() / 1000) > body.exp) return null;
  return body;
}

/* ---- извлечение токена из заголовка Authorization: Bearer <token> ---- */
export function bearerToken(request) {
  const h = request.headers.get('authorization') || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}
