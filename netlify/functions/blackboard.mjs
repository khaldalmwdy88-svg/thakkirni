// GET    /api/bb  → حالة الربط (بدون إظهار الرابط)
// POST   /api/bb  { url } لربط تقويم جديد، أو { refresh: true } لتحديث الحين
// DELETE /api/bb  { removeTasks } لإلغاء الربط
import { json, err, readToken, store, keyOf } from '../lib/util.mjs';
import { checkUrl, syncUser, bbStore, bbKey, errorText } from '../lib/bb.mjs';

const status = r => r ? {
  linked: true,
  host: (() => { try { return new URL(r.url).hostname; } catch { return ''; } })(),
  lastSync: r.lastSync || null,
  result: r.result || null,
  error: r.error || ''
} : { linked: false };

export default async req => {
  const email = readToken(req);
  if (!email) return err('سجّل دخول من جديد', 401);
  const st = bbStore();
  const key = bbKey(email);
  const rec = await st.get(key, { type: 'json' });

  if (req.method === 'GET') return json(status(rec));

  let body = {};
  try { body = await req.json(); } catch { }

  if (req.method === 'POST') {
    const url = body.refresh ? rec?.url : checkUrl(body.url);
    if (!url) return err(body.refresh ? 'ما فيه تقويم مربوط' : 'الرابط غير صحيح. لازم يبدأ بـ https');
    if (body.refresh && rec?.lastSync && Date.now() - rec.lastSync < 60000) {
      return err('حدّثناه قبل شوي، انتظر دقيقة', 429);
    }
    try {
      const result = await syncUser(email, url);
      const next = { url, linkedAt: rec?.linkedAt || Date.now(), lastSync: Date.now(), result, error: '' };
      await st.setJSON(key, next);
      return json(status(next));
    } catch (e) {
      console.error('bb sync failed', e);
      if (!rec) return err(errorText(e), 502); // ربط جديد فشل → ما نحفظه
      const next = { ...rec, lastSync: Date.now(), error: errorText(e) };
      await st.setJSON(key, next);
      return json(status(next));
    }
  }

  if (req.method === 'DELETE') {
    await st.delete(key);
    if (body.removeTasks) {
      const ts = store('tasks');
      const k = keyOf(email);
      const list = (await ts.get(k, { type: 'json' })) || [];
      await ts.setJSON(k, list.filter(t => t.src !== 'bb' || t.done));
    }
    return json({ linked: false });
  }

  return err('Method not allowed', 405);
};

export const config = { path: '/api/bb' };
