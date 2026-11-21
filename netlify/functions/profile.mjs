// GET  /api/profile                       → { profile }
// POST /api/profile { action: 'uni', uni }
// POST /api/profile { action: 'wa-send', phone }   ← يرسل رمز تحقق على واتساب
// POST /api/profile { action: 'wa-verify', code }
// POST /api/profile { action: 'wa-settings', on, lead }
// POST /api/profile { action: 'wa-remove' }
// POST /api/profile { action: 'digest', mail?, wa? }   ← ملخص الصباح
import crypto from 'node:crypto';
import { store, keyOf, json, err, readToken, isAdmin, hashCode, safeEq, getSettings } from '../lib/util.mjs';
import { isUni } from '../lib/unis.mjs';
import { profileOf, UNI_CHANGE_DAYS } from '../lib/profile.mjs';
import { normPhone, sendOtp, waConfigured, LEADS } from '../lib/wa.mjs';
import { useQuota } from '../lib/ai.mjs';
import { track } from '../lib/stats.mjs';

const OTP_MIN = 10;
const RESEND_SEC = 60;
const MAX_TRIES = 5;

export default async req => {
  const email = readToken(req);
  if (!email) return err('سجّل دخول من جديد', 401);
  const users = store('users');
  const k = keyOf(email);
  const u = (await users.get(k, { type: 'json' })) || { email, joined: Date.now() };
  const settings = await getSettings();
  const out = () => json({ profile: profileOf(u, settings) });

  if (req.method === 'GET') return out();
  if (req.method !== 'POST') return err('Method not allowed', 405);

  let b;
  try { b = await req.json(); } catch { return err('طلب غير صالح'); }

  // ---------- الجامعة ----------
  if (b.action === 'uni') {
    if (!isUni(b.uni)) return err('اختر جامعتك من القائمة');
    if (u.uni === b.uni) return out();
    if (u.uni && u.uniAt && !isAdmin(email)) {
      const left = Math.ceil((u.uniAt + UNI_CHANGE_DAYS * 864e5 - Date.now()) / 864e5);
      if (left > 0) return err(`تقدر تغيّر جامعتك بعد ${left} يوم`, 429);
    }
    const first = !u.uni;
    u.uni = b.uni;
    u.uniAt = first ? 0 : Date.now(); // أول اختيار ما يحسب عليه
    await users.setJSON(k, u);
    return out();
  }

  // ---------- ملخص الصباح ----------
  if (b.action === 'digest') {
    u.digest = { mail: u.digest?.mail !== false, wa: !!u.digest?.wa };
    if (b.mail !== undefined) u.digest.mail = !!b.mail;
    if (b.wa !== undefined) {
      if (b.wa && !u.wa?.verified) return err('أكّد رقم الواتساب أول');
      u.digest.wa = !!b.wa;
    }
    await users.setJSON(k, u);
    return out();
  }

  // ---------- الواتساب ----------
  if (b.action === 'wa-send' || b.action === 'wa-verify') {
    if (!waConfigured() || settings.wa === false) return err('تذكيرات الواتساب موقفة حالياً', 503);
  }

  if (b.action === 'wa-send') {
    const phone = normPhone(b.phone);
    if (!phone) return err('اكتب رقم جوال صحيح، مثل 05xxxxxxxx');
    if (u.waPending && Date.now() - u.waPending.sent < RESEND_SEC * 1000) return err('انتظر دقيقة قبل ما تطلب رمز جديد', 429);
    if (!(await useQuota(email, 'waotp', 5))) return err('طلبت رموز كثير اليوم، جرّب بكرة', 429);
    const code = String(crypto.randomInt(100000, 1000000));
    try {
      await sendOtp(phone, code);
    } catch (e) {
      return err(e.message, 502);
    }
    u.waPending = { phone, hash: hashCode('wa:' + phone, code), exp: Date.now() + OTP_MIN * 60000, sent: Date.now(), tries: 0 };
    await users.setJSON(k, u);
    await track(email, 'waOtp');
    return out();
  }

  if (b.action === 'wa-verify') {
    const p = u.waPending;
    const code = String(b.code || '').trim();
    if (!p || p.exp < Date.now()) return err('الرمز انتهى، اطلب رمز جديد');
    if (!/^\d{6}$/.test(code)) return err('الرمز 6 أرقام');
    if (p.tries >= MAX_TRIES) { delete u.waPending; await users.setJSON(k, u); return err('محاولات كثيرة، اطلب رمز جديد', 429); }
    if (!safeEq(hashCode('wa:' + p.phone, code), p.hash)) {
      p.tries++;
      await users.setJSON(k, u);
      return err(`الرمز غلط (باقي ${MAX_TRIES - p.tries} محاولات)`);
    }
    u.wa = { phone: p.phone, verified: true, on: true, lead: u.wa?.lead || 6, at: Date.now() };
    delete u.waPending;
    await users.setJSON(k, u);
    return out();
  }

  if (b.action === 'wa-settings') {
    if (!u.wa?.verified) return err('أكّد رقمك أول');
    if (b.on !== undefined) u.wa.on = !!b.on;
    if (b.lead !== undefined) {
      const lead = Number(b.lead);
      if (!LEADS.includes(lead)) return err('اختر وقت من القائمة');
      u.wa.lead = lead;
    }
    await users.setJSON(k, u);
    return out();
  }

  if (b.action === 'wa-remove') {
    delete u.wa;
    delete u.waPending;
    await users.setJSON(k, u);
    return out();
  }

  return err('طلب غير معروف');
};

export const config = { path: '/api/profile' };
