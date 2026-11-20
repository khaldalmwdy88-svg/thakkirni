// GET /api/tasks   → { tasks }
// PUT /api/tasks   { tasks: [...] }
import { store, keyOf, json, err, readToken, TYPES } from '../lib/util.mjs';

const MAX = 500;
const str = (v, n) => String(v ?? '').slice(0, n);

function clean(t, old) {
  const due = Number(t.due);
  if (!t || typeof t !== 'object' || !Number.isFinite(due)) return null;
  return {
    id: str(t.id, 40),
    type: TYPES[t.type] ? t.type : 'task',
    subject: str(t.subject, 80),
    title: str(t.title, 200),
    due,
    remind: Math.min(Math.max(Number(t.remind) || 1440, 0), 43200),
    done: !!t.done,
    created: Number(t.created) || Date.now(),
    n1: !!t.n1,
    n2: !!t.n2,
    e1: !!old?.e1 && old.due === due, // علامة "انرسل إيميل" يحددها السيرفر بس
    note: str(t.note, 500),           // ملاحظة اختيارية
    grade: str(t.grade, 30),          // الدرجة (اختياري)
    src: t.src === 'bb' ? 'bb' : '',  // جاي من Blackboard؟
    cal: t.cal === 'gc' ? 'gc' : t.src === 'bb' ? 'bb' : '', // bb = Blackboard، gc = Classroom
    bbUid: str(t.bbUid, 200),
    hidden: !!t.hidden                // تذكير Blackboard حذفه الطالب (عشان ما يرجع)
  };
}

export default async req => {
  const email = readToken(req);
  if (!email) return err('سجّل دخول من جديد', 401);

  const tasks = store('tasks');
  const k = keyOf(email);

  if (req.method === 'GET') {
    return json({ tasks: (await tasks.get(k, { type: 'json' })) || [] });
  }

  if (req.method === 'PUT') {
    let body;
    try { body = await req.json(); } catch { return err('طلب غير صالح'); }
    if (!Array.isArray(body.tasks) || body.tasks.length > MAX) return err('بيانات غير صالحة');

    const old = new Map(((await tasks.get(k, { type: 'json' })) || []).map(t => [t.id, t]));
    const list = body.tasks.map(t => clean(t, old.get(t?.id))).filter(t => t && t.id && t.subject);
    await tasks.setJSON(k, list);
    return json({ ok: true });
  }

  return err('Method not allowed', 405);
};

export const config = { path: '/api/tasks' };
