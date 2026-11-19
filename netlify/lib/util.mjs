// أدوات مشتركة بين كل الـ functions
import crypto from 'node:crypto';
import { getStore } from '@netlify/blobs';

export const env = k => process.env[k] || globalThis.Netlify?.env?.get(k) || '';

export const store = name => getStore({ name, consistency: 'strong' });
export const keyOf = email => encodeURIComponent(email.toLowerCase());

export const isEmail = e =>
  typeof e === 'string' && e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
export const err = (msg, status = 400) => json({ error: msg }, status);

export const configured = () => !!(env('AUTH_SECRET') && env('ADMIN_EMAIL'));

const hmac = s => crypto.createHmac('sha256', env('AUTH_SECRET')).update(s).digest('base64url');

export const safeEq = (a, b) =>
  typeof a === 'string' && typeof b === 'string' && a.length === b.length &&
  crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

// الرمز ما ينحفظ كنص — ينحفظ بصمته (hash) بس
export const hashCode = (email, code) => hmac(`otp:${email}:${code}`);

// توكن الجلسة: بيانات + توقيع، صالح 30 يوم
export function signToken(email, days = 30) {
  const p = Buffer.from(JSON.stringify({ email, exp: Date.now() + days * 864e5 })).toString('base64url');
  return `${p}.${hmac(p)}`;
}

export function readToken(req) {
  const h = req.headers.get('authorization') || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : '';
  const [p, s] = t.split('.');
  if (!p || !s || !safeEq(hmac(p), s)) return null;
  try {
    const d = JSON.parse(Buffer.from(p, 'base64url').toString());
    return d.exp > Date.now() ? d.email : null;
  } catch { return null; }
}

export const isAdmin = email => !!email && email.toLowerCase() === env('ADMIN_EMAIL').toLowerCase();

export const TYPES = {
  quiz: 'كويز', exam: 'اختبار', task: 'تاسك', hw: 'واجب', project: 'مشروع', lab: 'لاب'
};
