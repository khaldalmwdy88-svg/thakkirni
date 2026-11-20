// ربط تقويمات الجامعة: Blackboard و/أو Google Classroom
// GET    /api/bb                    → الروابط المربوطة (بدون إظهار الرابط نفسه)
// POST   /api/bb { url }            → إضافة رابط جديد
// POST   /api/bb { refresh: true }  → تحديث الكل الحين
// DELETE /api/bb { id, removeTasks } → إلغاء ربط رابط
import { json, err, readToken, store, keyOf } from '../lib/util.mjs';
import { checkUrl, kindOf, LABELS, MAX_LINKS, syncLink, bbStore, bbKey, readLinks, errorText } from '../lib/bb.mjs';

const view = l => ({
  id: l.id,
  kind: l.kind,
  label: LABELS[l.kind] || 'تقويم',
  host: (() => { try { return new URL(l.url).hostname; } catch { return ''; } })(),
  lastSync: l.lastSync || null,
  result: l.result || null,
  error: l.error || ''
});

export default async req => {
  const email = readToken(req);
  if (!email) return err('سجّل دخول من جديد', 401);
  const st = bbStore();
  const key = bbKey(email);
  let links = await readLinks(st, key);
  const save = () => links.length ? st.setJSON(key, { links }) : st.delete(key);
  const out = () => json({ links: links.map(view) });

  if (req.method === 'GET') return out();

  let body = {};
  try { body = await req.json(); } catch { }

  if (req.method === 'POST' && body.refresh) {
    const fresh = links.filter(l => !l.lastSync || Date.now() - l.lastSync > 60000);
    if (!fresh.length) return err('حدّثناه قبل شوي، انتظر دقيقة', 429);
    for (const l of fresh) {
      try { l.result = await syncLink(email, l); l.error = ''; }
      catch (e) { console.error('sync', e?.message); l.error = errorText(e); }
      l.lastSync = Date.now();
    }
    await save();
    return out();
  }

  if (req.method === 'POST') {
    const url = checkUrl(body.url);
    if (!url) return err('الرابط غير صحيح. لازم يبدأ بـ https');
    if (links.some(l => l.url === url)) return err('هالرابط مربوط من قبل');
    if (links.length >= MAX_LINKS) return err(`تقدر تربط ${MAX_LINKS} تقاويم بس`);
    const link = { id: 'l' + Date.now().toString(36), kind: kindOf(url), url, linkedAt: Date.now() };
    try {
      link.result = await syncLink(email, link);
      link.lastSync = Date.now();
      link.error = '';
    } catch (e) {
      console.error('link failed', e?.message);
      return err(errorText(e), 502); // ربط جديد فشل → ما نحفظه
    }
    links.push(link);
    await save();
    return out();
  }

  if (req.method === 'DELETE') {
    const link = links.find(l => l.id === body.id);
    if (!link) return err('الرابط مو موجود', 404);
    links = links.filter(l => l !== link);
    await save();
    if (body.removeTasks) {
      const ts = store('tasks');
      const k = keyOf(email);
      const list = (await ts.get(k, { type: 'json' })) || [];
      await ts.setJSON(k, list.filter(t => t.src !== 'bb' || t.done || (t.cal || 'bb') !== link.kind));
    }
    return out();
  }

  return err('Method not allowed', 405);
};

export const config = { path: '/api/bb' };
