// POST /api/send-code  { email }
import crypto from 'node:crypto';
import { store, keyOf, isEmail, json, err, configured, hashCode } from '../lib/util.mjs';
import { sendMail, layout } from '../lib/mail.mjs';

const TTL_MIN = 5;
const RESEND_SEC = 30;

export default async req => {
  if (req.method !== 'POST') return err('Method not allowed', 405);
  if (!configured()) return err('السيرفر غير مهيأ (متغيرات البيئة ناقصة)', 500);

  let body;
  try { body = await req.json(); } catch { return err('طلب غير صالح'); }
  const email = String(body.email || '').trim().toLowerCase();
  if (!isEmail(email)) return err('اكتب إيميل صحيح');

  const otp = store('otp');
  const k = keyOf(email);
  const prev = await otp.get(k, { type: 'json' });
  if (prev && Date.now() - prev.sent < RESEND_SEC * 1000) {
    return err('انتظر شوي قبل ما تطلب رمز جديد', 429);
  }

  const code = String(crypto.randomInt(100000, 1000000));
  await otp.setJSON(k, {
    hash: hashCode(email, code),
    exp: Date.now() + TTL_MIN * 60000,
    sent: Date.now(),
    tries: 0
  });

  try {
    await sendMail(email, `رمز الدخول: ${code}`, layout('رمز الدخول حقك', `
      <p style="color:#a19cb8;margin:0 0 18px">استخدم الرمز هذا عشان تدخل. صالح لمدة ${TTL_MIN} دقائق.</p>
      <div dir="ltr" style="text-align:center;font-size:38px;font-weight:900;letter-spacing:10px;color:#f5c76b;background:#0b0918;border:1px solid #3a3266;border-radius:16px;padding:18px">${code}</div>
      <p style="color:#6d6885;font-size:13px;margin-top:18px">إذا ما طلبت الرمز، تجاهل الإيميل.</p>`));
  } catch (e) {
    console.error('mail error', e);
    await otp.delete(k);
    return err('ما قدرنا نرسل الإيميل، جرّب بعد شوي', 502);
  }

  return json({ ok: true });
};

export const config = { path: '/api/send-code' };
