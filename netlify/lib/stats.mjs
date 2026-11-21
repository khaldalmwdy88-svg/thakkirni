// 📊 إحصائيات لوحة الأدمن
// نحفظ عدّاد لكل يوم (بتوقيت السعودية) + عدّاد لكل مستخدم
import { store, keyOf } from './util.mjs';

export const dayKey = (t = Date.now()) => new Date(t + 3 * 3600e3).toISOString().slice(0, 10);
const st = () => store('stats');

// يزيد عدّادات اليوم: bump({ quiz: 1, tin: 2000 })
export async function bump(fields, day = dayKey(), prefix = 'd_') {
  try {
    const k = prefix + day;
    const d = (await st().get(k, { type: 'json' })) || {};
    for (const [f, n] of Object.entries(fields)) d[f] = (d[f] || 0) + (Number(n) || 0);
    await st().setJSON(k, d);
  } catch (e) { console.error('stats bump', e); }
}

// عملية سوّاها مستخدم: تنحسب في اليوم وفي حسابه
export async function track(email, kind, n = 1) {
  await bump({ [kind]: n });
  if (!email) return;
  try {
    const users = store('users');
    const k = keyOf(email);
    const u = await users.get(k, { type: 'json' });
    if (!u) return;
    u.n = u.n || {};
    u.n[kind] = (u.n[kind] || 0) + n;
    await users.setJSON(k, u);
  } catch (e) { console.error('stats track', e); }
}

// استهلاك الذكاء الاصطناعي (عشان نقدّر التكلفة). ينحفظ لحاله عشان الطلبات المتزامنة
// ما تمسح عدّادات اليوم الثانية
export async function aiUsage(usage) {
  const tin = Number(usage?.input_tokens) || 0;
  const tout = Number(usage?.output_tokens) || 0;
  if (tin || tout) await bump({ tin, tout, ai: 1 }, dayKey(), 'ai_');
}

// أول نشاط للمستخدم في اليوم: يتعلّم "فعّال اليوم". يرجع true لو تغيّر شي يستاهل الحفظ
export function touch(u) {
  const now = Date.now();
  const today = dayKey(now);
  const firstToday = u.day !== today;
  if (firstToday) { u.day = today; u.days = (u.days || 0) + 1; }
  const stale = !u.last || now - u.last > 3600e3;
  if (firstToday || stale) u.last = now;
  return { changed: firstToday || stale, firstToday };
}
