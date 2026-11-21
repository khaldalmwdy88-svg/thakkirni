// POST /api/verify-code  { email, code }  →  { token, email, admin }
import { store, keyOf, isEmail, json, err, configured, hashCode, safeEq, signToken, isAdmin, sessionCookie } from '../lib/util.mjs';
import { touch, bump } from '../lib/stats.mjs';

const MAX_TRIES = 5;

export default async req => {
  if (req.method !== 'POST') return err('Method not allowed', 405);
  if (!configured()) return err('السيرفر غير مهيأ', 500);

  let body;
  try { body = await req.json(); } catch { return err('طلب غير صالح'); }
  const email = String(body.email || '').trim().toLowerCase();
  const code = String(body.code || '').trim();
  if (!isEmail(email) || !/^\d{6}$/.test(code)) return err('البيانات غير صحيحة');

  const otp = store('otp');
  const k = keyOf(email);
  const o = await otp.get(k, { type: 'json' });

  if (!o) return err('اطلب رمز جديد');
  if (Date.now() > o.exp) { await otp.delete(k); return err('الرمز انتهت صلاحيته، اطلب واحد جديد'); }
  if (o.tries >= MAX_TRIES) { await otp.delete(k); return err('محاولات كثيرة، اطلب رمز جديد', 429); }

  if (!safeEq(hashCode(email, code), o.hash)) {
    o.tries++;
    await otp.setJSON(k, o);
    return err(`الرمز غلط (باقي ${MAX_TRIES - o.tries} محاولات)`);
  }

  await otp.delete(k);

  // تسجيل / تحديث المستخدم
  const users = store('users');
  const old = await users.get(k, { type: 'json' });
  const u = old || { email, joined: Date.now() };
  const t = touch(u);
  u.last = Date.now();
  await users.setJSON(k, u);
  await bump({ login: 1, ...(old ? {} : { signup: 1 }), ...(t.firstToday ? { active: 1 } : {}) });

  const token = signToken(email);
  return json({ token, email, admin: isAdmin(email) }, 200, { 'set-cookie': sessionCookie(token) });
};

export const config = { path: '/api/verify-code' };
