// دالة مجدولة: مرتين في اليوم (6 الصبح و6 المغرب بتوقيت السعودية)
// تحدّث واجبات Blackboard و Classroom لكل طالب ربط تقويمه
import { bbStore, syncLink, readLinks, errorText } from '../lib/bb.mjs';

const BUDGET_MS = 24000; // نوقف قبل حد الوقت

export default async () => {
  const started = Date.now();
  const st = bbStore();
  const { blobs } = await st.list();
  const keys = blobs.map(b => b.key).filter(k => k.endsWith('_bb'));

  const users = [];
  for (const key of keys) {
    const links = await readLinks(st, key);
    if (links.length) users.push({ key, links, oldest: Math.min(...links.map(l => l.lastSync || 0)) });
  }
  users.sort((a, b) => a.oldest - b.oldest); // نبدأ بالأقدم تحديثاً

  let done = 0;
  for (const { key, links } of users) {
    if (Date.now() - started > BUDGET_MS) break;
    const email = decodeURIComponent(key.slice(0, -3));
    for (const l of links) {
      try { l.result = await syncLink(email, l); l.error = ''; }
      catch (e) { console.error('bb sync', email, e?.message); l.error = errorText(e); }
      l.lastSync = Date.now();
    }
    await st.setJSON(key, { links });
    done++;
  }
  console.log(`bbsync: ${done}/${users.length}`);
  return new Response('ok');
};

export const config = { schedule: '0 3,15 * * *' };
