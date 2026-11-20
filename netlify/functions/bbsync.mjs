// دالة مجدولة: مرتين في اليوم (6 الصبح و6 المغرب بتوقيت السعودية)
// تحدّث واجبات Blackboard لكل طالب ربط تقويمه
import { bbStore, syncUser, errorText } from '../lib/bb.mjs';

const BUDGET_MS = 24000; // نوقف قبل حد الوقت

export default async () => {
  const started = Date.now();
  const st = bbStore();
  const { blobs } = await st.list();
  const keys = blobs.map(b => b.key).filter(k => k.endsWith('_bb'));

  // نبدأ بالأقدم تحديثاً
  const recs = [];
  for (const key of keys) {
    const r = await st.get(key, { type: 'json' });
    if (r?.url) recs.push({ key, r });
  }
  recs.sort((a, b) => (a.r.lastSync || 0) - (b.r.lastSync || 0));

  let done = 0;
  for (const { key, r } of recs) {
    if (Date.now() - started > BUDGET_MS) break;
    const email = decodeURIComponent(key.slice(0, -3));
    try {
      const result = await syncUser(email, r.url);
      await st.setJSON(key, { ...r, lastSync: Date.now(), result, error: '' });
    } catch (e) {
      console.error('bb sync', email, e?.message);
      await st.setJSON(key, { ...r, lastSync: Date.now(), error: errorText(e) });
    }
    done++;
  }
  console.log(`bbsync: ${done}/${recs.length}`);
  return new Response('ok');
};

export const config = { schedule: '0 3,15 * * *' };
