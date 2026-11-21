// 💬 واتساب (WhatsApp Cloud API من Meta)
// المتغيرات في Netlify:
//   WA_TOKEN       ← رمز الوصول (Access Token)
//   WA_PHONE_ID    ← Phone Number ID
//   WA_TEMPLATE    ← اسم قالب التذكير (الافتراضي task_reminder)
//   WA_OTP_TEMPLATE← اسم قالب رمز التحقق (الافتراضي verify_code)
//   WA_DIGEST_TEMPLATE ← اسم قالب ملخص الصباح (الافتراضي daily_summary)
//   WA_LANG        ← لغة القوالب (الافتراضي ar)
//   WA_MONTHLY_LIMIT ← أقصى عدد رسائل للموقع كله في الشهر (الافتراضي 500)
import { env, store } from './util.mjs';
import { dayKey } from './stats.mjs';

export const waConfigured = () => !!(env('WA_TOKEN') && env('WA_PHONE_ID'));
export const PER_USER_DAILY = 5;
export const LEADS = [1, 3, 6, 12, 24]; // ساعات قبل الموعد

// يحوّل الرقم لصيغة دولية بدون +  (05xxxxxxxx → 9665xxxxxxxx)
export function normPhone(raw) {
  let p = String(raw ?? '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[^\d+]/g, '');
  if (p.startsWith('+')) p = p.slice(1);
  else if (p.startsWith('00')) p = p.slice(2);
  else if (/^05\d{8}$/.test(p)) p = '966' + p.slice(1);
  else if (/^5\d{8}$/.test(p)) p = '966' + p;
  if (p.startsWith('966') && !/^9665\d{8}$/.test(p)) return null; // رقم سعودي لازم يكون جوال
  return /^\d{9,15}$/.test(p) ? p : null;
}
export const maskPhone = p => p ? `+${p.slice(0, 3)} ${p.slice(3, 5)}•••${p.slice(-3)}` : '';

// واتساب ما يقبل أسطر جديدة أو مسافات كثيرة داخل المتغيرات
const clean = s => String(s ?? '').replace(/[\n\r\t]+/g, ' ').replace(/ {4,}/g, '   ').trim().slice(0, 300) || '-';

async function send(to, template, bodyParams, extra = []) {
  const v = env('WA_API_VERSION') || 'v23.0';
  const res = await fetch(`https://graph.facebook.com/${v}/${env('WA_PHONE_ID')}/messages`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env('WA_TOKEN')}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: template,
        language: { code: env('WA_LANG') || 'ar' },
        components: [
          { type: 'body', parameters: bodyParams.map(t => ({ type: 'text', text: clean(t) })) },
          ...extra
        ]
      }
    })
  }).catch(e => ({ ok: false, status: 0, json: async () => ({ error: { message: String(e) } }) }));
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('whatsapp error', res.status, JSON.stringify(data));
    const code = data?.error?.code;
    const e = new Error(
      code === 131030 ? 'الرقم هذا مو مضاف في قائمة أرقام التجربة عند Meta' :
      code === 132001 ? 'قالب الرسالة لسه ما انقبل من Meta' :
      code === 190 ? 'رمز الوصول (WA_TOKEN) منتهي أو غلط' :
      code === 131026 ? 'الرقم هذا ما عليه واتساب' :
      'ما قدرنا نرسل على الواتساب، جرّب بعد شوي');
    e.code = code;
    throw e;
  }
  return data;
}

// حد الموقع الشهري (عشان الفاتورة ما تطلع فوق المتوقع)
async function monthlyOk() {
  const k = 'wa_' + dayKey().slice(0, 7);
  const st = store('stats');
  const n = (await st.get(k, { type: 'json' })) || 0;
  if (n >= (Number(env('WA_MONTHLY_LIMIT')) || 500)) return false;
  await st.setJSON(k, n + 1);
  return true;
}

export async function sendReminder(to, params) {
  if (!(await monthlyOk())) throw Object.assign(new Error('وصلنا حد رسائل الشهر'), { code: 'LIMIT' });
  return send(to, env('WA_TEMPLATE') || 'task_reminder', params);
}

// ملخص الصباح: قالب فيه متغيرين (مذاكرة اليوم، المواعيد القريبة)
export async function sendDigest(to, params) {
  if (!(await monthlyOk())) throw Object.assign(new Error('وصلنا حد رسائل الشهر'), { code: 'LIMIT' });
  return send(to, env('WA_DIGEST_TEMPLATE') || 'daily_summary', params);
}

export async function sendOtp(to, code) {
  if (!(await monthlyOk())) throw new Error('خدمة الواتساب موقفة مؤقتاً، جرّب الشهر الجاي');
  // قالب "المصادقة" عند Meta: الرمز في النص + زر "نسخ الرمز"
  return send(to, env('WA_OTP_TEMPLATE') || 'verify_code', [code], [
    { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] }
  ]);
}
