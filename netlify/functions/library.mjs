// 📚 مكتبة المواد: كويزات يشاركها الطلاب لكل مادة
// GET  /api/library?action=courses
// GET  /api/library?action=course&code=IE200
// GET  /api/library?action=quiz&code=IE200&id=...
// POST /api/library { action: 'share' | 'score' | 'report' | 'delete', ... }
import crypto from 'node:crypto';
import { store, json, err, readToken, isAdmin } from '../lib/util.mjs';
import { useQuota } from '../lib/ai.mjs';

const lib = () => store('library');
const str = (v, n) => String(v ?? '').trim().slice(0, n);
const normCode = c => String(c ?? '').toUpperCase().replace(/[\s_\-]/g, '').slice(0, 12);
const validCode = c => /^[A-Z]{2,6}\d{2,4}[A-Z]?$/.test(c);
const mask = email => { const n = email.split('@')[0]; return n.length > 4 ? n.slice(0, 3) + '***' + n.slice(-1) : n.slice(0, 2) + '***'; };
const REPORT_HIDE = 3;

function cleanQ(q) {
  const type = ['mcq', 'tf', 'short', 'essay'].includes(q?.type) ? q.type : null;
  const question = str(q?.question, 1500);
  if (!type || !question) return null;
  const out = { type, question, explanation: str(q.explanation, 500) };
  if (type === 'mcq' || type === 'tf') {
    const options = Array.isArray(q.options) ? q.options.map(o => str(o, 400)).filter(Boolean).slice(0, 8) : [];
    const answer = Number(q.answer);
    if (options.length < 2 || !Number.isInteger(answer) || answer < 0 || answer >= options.length) return null;
    out.options = options;
    out.answer = answer;
  } else {
    out.answer = str(q.answer, 2000);
  }
  return out;
}

const publicQuiz = (q, email) => ({
  id: q.id, title: q.title, by: q.byName, n: q.n, at: q.at, plays: q.plays || 0,
  top: (q.top || []).slice(0, 5).map(t => ({ name: t.name, score: t.score })),
  mine: q.by === email, hidden: !!q.hidden, reports: (q.reports || []).length
});

export default async req => {
  const email = readToken(req);
  if (!email) return err('سجّل دخول من جديد', 401);
  const st = lib();
  const admin = isAdmin(email);

  if (req.method === 'GET') {
    const p = new URL(req.url).searchParams;
    const action = p.get('action');

    if (action === 'courses') {
      const courses = (await st.get('courses', { type: 'json' })) || [];
      return json({ courses: courses.filter(c => c.count > 0 || admin).sort((a, b) => b.updated - a.updated) });
    }

    const code = normCode(p.get('code'));
    if (!validCode(code)) return err('رمز المادة غير صحيح');
    const quizzes = (await st.get(`c_${code}`, { type: 'json' })) || [];
    const courses = (await st.get('courses', { type: 'json' })) || [];
    const course = courses.find(c => c.code === code) || null;

    if (action === 'course') {
      return json({
        course,
        quizzes: quizzes.filter(q => !q.hidden || admin || q.by === email)
          .sort((a, b) => b.at - a.at).map(q => publicQuiz(q, email))
      });
    }

    if (action === 'quiz') {
      const q = quizzes.find(x => x.id === p.get('id'));
      if (!q || (q.hidden && !admin && q.by !== email)) return err('الكويز مو موجود', 404);
      const data = await st.get(`q_${q.id}`, { type: 'json' });
      return json({ quiz: publicQuiz(q, email), questions: data?.questions || [] });
    }
    return err('طلب غير معروف');
  }

  if (req.method !== 'POST') return err('Method not allowed', 405);
  let b;
  try { b = await req.json(); } catch { return err('طلب غير صالح'); }
  const code = normCode(b.code);
  if (!validCode(code)) return err('اكتب رمز المادة صح، مثل IE200 أو PHYS202');
  const key = `c_${code}`;
  const quizzes = (await st.get(key, { type: 'json' })) || [];

  // ---------- مشاركة كويز ----------
  if (b.action === 'share') {
    const questions = (Array.isArray(b.questions) ? b.questions : []).map(cleanQ).filter(Boolean).slice(0, 80);
    if (questions.length < 3) return err('الكويز لازم يكون فيه 3 أسئلة على الأقل');
    const title = str(b.title, 120) || `كويز ${code}`;
    if (!(await useQuota(email, 'share', 15))) return err('شاركت كثير اليوم، جرّب بكرة 🙏', 429);
    if (quizzes.length >= 200) return err('مكتبة هالمادة ممتلئة', 409);

    const courses = (await st.get('courses', { type: 'json' })) || [];
    let course = courses.find(c => c.code === code);
    if (!course) {
      const name = str(b.name, 80);
      if (!name) return err('اكتب اسم المادة');
      course = { code, name, info: str(b.info, 300), by: mask(email), count: 0, updated: Date.now() };
      courses.push(course);
    } else if (!course.info && b.info) {
      course.info = str(b.info, 300);
    }

    const id = crypto.randomBytes(6).toString('hex');
    await st.setJSON(`q_${id}`, { questions });
    quizzes.push({ id, title, by: email, byName: mask(email), n: questions.length, at: Date.now(), plays: 0, top: [], reports: [] });
    await st.setJSON(key, quizzes);
    course.count = quizzes.filter(q => !q.hidden).length;
    course.updated = Date.now();
    await st.setJSON('courses', courses.slice(-1000));
    return json({ ok: true, id, code });
  }

  const q = quizzes.find(x => x.id === b.id);
  if (!q) return err('الكويز مو موجود', 404);

  // ---------- تسجيل درجة ----------
  if (b.action === 'score') {
    const score = Math.round(Math.min(Math.max(Number(b.score) || 0, 0), 100));
    q.plays = (q.plays || 0) + 1;
    const top = q.top || [];
    const me = top.find(t => t.by === email);
    if (me) { if (score > me.score) { me.score = score; me.at = Date.now(); } }
    else top.push({ by: email, name: mask(email), score, at: Date.now() });
    top.sort((a, b2) => b2.score - a.score || a.at - b2.at);
    q.top = top.slice(0, 20);
    await st.setJSON(key, quizzes);
    const rank = q.top.findIndex(t => t.by === email) + 1;
    return json({ rank: rank || null, top: q.top.slice(0, 5).map(t => ({ name: t.name, score: t.score, me: t.by === email })) });
  }

  // ---------- بلاغ ----------
  if (b.action === 'report') {
    q.reports = q.reports || [];
    if (!q.reports.includes(email)) q.reports.push(email);
    if (q.reports.length >= REPORT_HIDE) q.hidden = true;
    await st.setJSON(key, quizzes);
    await updateCount(st, code, quizzes);
    return json({ ok: true, hidden: !!q.hidden });
  }

  // ---------- حذف (صاحب الكويز أو الأدمن) ----------
  if (b.action === 'delete') {
    if (q.by !== email && !admin) return err('ما تقدر تحذف كويز غيرك', 403);
    const rest = quizzes.filter(x => x.id !== q.id);
    await st.setJSON(key, rest);
    await st.delete(`q_${q.id}`);
    await updateCount(st, code, rest);
    return json({ ok: true });
  }

  // ---------- إظهار كويز مخفي (الأدمن) ----------
  if (b.action === 'restore' && admin) {
    q.hidden = false;
    q.reports = [];
    await st.setJSON(key, quizzes);
    await updateCount(st, code, quizzes);
    return json({ ok: true });
  }

  return err('طلب غير معروف');
};

async function updateCount(st, code, quizzes) {
  const courses = (await st.get('courses', { type: 'json' })) || [];
  const c = courses.find(x => x.code === code);
  if (c) { c.count = quizzes.filter(q => !q.hidden).length; await st.setJSON('courses', courses); }
}

export const config = { path: '/api/library' };
