// GET /api/data?k=mistakes|plan   → { value }
// PUT /api/data?k=mistakes|plan   { value }
// تخزين بيانات الطالب: بنك الأخطاء وخطة المذاكرة
import { store, keyOf, json, err, readToken } from '../lib/util.mjs';

const KEYS = { mistakes: 400_000, plan: 400_000 }; // أقصى حجم لكل نوع (حروف)

export default async req => {
  const email = readToken(req);
  if (!email) return err('سجّل دخول من جديد', 401);

  const k = new URL(req.url).searchParams.get('k');
  if (!KEYS[k]) return err('نوع بيانات غير معروف');

  const st = store('userdata');
  const id = `${keyOf(email)}_${k}`;

  if (req.method === 'GET') {
    return json({ value: (await st.get(id, { type: 'json' })) ?? null });
  }

  if (req.method === 'PUT') {
    let body;
    try { body = await req.json(); } catch { return err('طلب غير صالح'); }
    const raw = JSON.stringify(body.value ?? null);
    if (raw.length > KEYS[k]) return err('البيانات كبيرة جداً', 413);
    await st.setJSON(id, body.value ?? null);
    return json({ ok: true });
  }

  return err('Method not allowed', 405);
};

export const config = { path: '/api/data' };
