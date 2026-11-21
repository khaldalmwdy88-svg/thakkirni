// 📚 مكتبة المواد — كل جامعة لها مكتبة لحالها
// GET  /api/library?action=courses
// GET  /api/library?action=course&code=IE200
// GET  /api/library?action=quiz&code=IE200&id=...
// POST /api/library { action: 'course' | 'share' | 'link' | 'score' | 'report' | 'delete' | 'restore', ... }
// (رفع الملفات والصور في upload.mjs)
import crypto from 'node:crypto';
import { store, json, err, readToken, isAdmin } from '../lib/util.mjs';
import { useQuota } from '../lib/ai.mjs';
import { track } from '../lib/stats.mjs';
import { UNI_NAME } from '../lib/unis.mjs';
import { lib, str, SECS, normCode, validCode, mask, uniOf, K, refreshCourse, addReport, dropReport } from '../lib/library.mjs';

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

const publicRes = (r, email) => ({
  id: r.id, sec: r.sec, kind: r.kind, title: r.title, url: r.kind === 'link' ? r.url : `/api/file?id=${r.fid}`,
  fname: r.fname || '', size: r.size || 0, mime: r.mime || '', by: r.byName, at: r.at,
  mine: r.by === email, hidden: !!r.hidden, reports: (r.reports || []).length
});

const safeUrl = u => {
  try {
    const x = new URL(String(u).trim());
    return /^https?:$/.test(x.protocol) ? x.href.slice(0, 600) : null;
  } catch { return null; }
};

// ينشئ المادة إذا ما كانت موجودة
async function ensureCourse(st, uni, code, b, email) {
  const courses = (await st.get(K.courses(uni), { type: 'json' })) || [];
  let course = courses.find(c => c.code === code);
  if (course) {
    if (!course.info && b.info) { course.info = str(b.info, 300); await st.setJSON(K.courses(uni), courses); }
    return { course, created: false };
  }
  const name = str(b.name, 80);
  if (!name) throw new Error('اكتب اسم المادة');
  if (courses.length >= 1500) throw new Error('المكتبة ممتلئة');
  course = { code, name, info: str(b.info, 300), by: mask(email), count: 0, n: { quiz: 0, sum: 0, slides: 0, links: 0 }, updated: Date.now() };
  courses.push(course);
  await st.setJSON(K.courses(uni), courses);
  return { course, created: true };
}

export default async req => {
  const email = readToken(req);
  if (!email) return err('سجّل دخول من جديد', 401);
  const st = lib();
  const admin = isAdmin(email);
  const url = new URL(req.url);

  let b = {};
  if (req.method === 'POST') {
    try { b = await req.json(); } catch { return err('طلب غير صالح'); }
  } else if (req.method !== 'GET') return err('Method not allowed', 405);

  const uni = await uniOf(email, url.searchParams.get('uni') || b.uni);
  if (!uni) return err('اختر جامعتك أول من صفحة حسابي', 409);

  // ================= القراءة =================
  if (req.method === 'GET') {
    const p = url.searchParams;
    const action = p.get('action');

    if (action === 'courses') {
      const courses = (await st.get(K.courses(uni), { type: 'json' })) || [];
      return json({ uni, uniName: UNI_NAME[uni], courses: courses.sort((a, b2) => b2.updated - a.updated) });
    }

    const code = normCode(p.get('code'));
    if (!validCode(code)) return err('رمز المادة غير صحيح');
    const quizzes = (await st.get(K.quizzes(uni, code), { type: 'json' })) || [];

    if (action === 'course') {
      const courses = (await st.get(K.courses(uni), { type: 'json' })) || [];
      const course = courses.find(c => c.code === code);
      if (!course) return err('المادة مو موجودة', 404);
      const res = (await st.get(K.res(uni, code), { type: 'json' })) || [];
      const see = x => !x.hidden || admin || x.by === email;
      return json({
        course,
        quizzes: quizzes.filter(see).sort((a, b2) => b2.at - a.at).map(q => publicQuiz(q, email)),
        res: res.filter(see).sort((a, b2) => b2.at - a.at).map(r => publicRes(r, email))
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

  // ================= الكتابة =================
  const code = normCode(b.code);
  if (!validCode(code)) return err('اكتب رمز المادة صح، مثل IE200 أو PHYS202');

  // ---------- إضافة مادة ----------
  if (b.action === 'course') {
    if (!(await useQuota(email, 'course', 10))) return err('أضفت مواد كثير اليوم، جرّب بكرة 🙏', 429);
    try {
      const { course, created } = await ensureCourse(st, uni, code, b, email);
      if (created) await track(email, 'course');
      return json({ ok: true, course, created });
    } catch (e) { return err(e.message); }
  }

  // ---------- مشاركة كويز ----------
  if (b.action === 'share') {
    const questions = (Array.isArray(b.questions) ? b.questions : []).map(cleanQ).filter(Boolean).slice(0, 80);
    if (questions.length < 3) return err('الكويز لازم يكون فيه 3 أسئلة على الأقل');
    const title = str(b.title, 120) || `كويز ${code}`;
    const quizzes = (await st.get(K.quizzes(uni, code), { type: 'json' })) || [];
    if (quizzes.length >= 200) return err('مكتبة هالمادة ممتلئة', 409);
    if (!(await useQuota(email, 'share', 15))) return err('شاركت كثير اليوم، جرّب بكرة 🙏', 429);
    try { await ensureCourse(st, uni, code, b, email); } catch (e) { return err(e.message); }

    const id = crypto.randomBytes(6).toString('hex');
    await st.setJSON(`q_${id}`, { questions });
    quizzes.push({ id, title, by: email, byName: mask(email), n: questions.length, at: Date.now(), plays: 0, top: [], reports: [] });
    await st.setJSON(K.quizzes(uni, code), quizzes);
    await refreshCourse(st, uni, code);
    await track(email, 'lib');
    return json({ ok: true, id, code });
  }

  // ---------- إضافة رابط ----------
  if (b.action === 'link') {
    const sec = SECS[b.sec] ? b.sec : 'links';
    const link = safeUrl(b.url);
    if (!link) return err('الرابط لازم يبدأ بـ https://');
    const title = str(b.title, 120);
    if (!title) return err('اكتب عنوان للرابط');
    const res = (await st.get(K.res(uni, code), { type: 'json' })) || [];
    if (res.length >= 400) return err('هالمادة ممتلئة', 409);
    if (res.some(r => r.kind === 'link' && r.url === link && !r.hidden)) return err('الرابط هذا موجود من قبل في المادة');
    if (!(await useQuota(email, 'lib', 30))) return err('أضفت كثير اليوم، جرّب بكرة 🙏', 429);
    try { await ensureCourse(st, uni, code, b, email); } catch (e) { return err(e.message); }
    res.push({ id: crypto.randomBytes(6).toString('hex'), sec, kind: 'link', title, url: link, by: email, byName: mask(email), at: Date.now(), reports: [] });
    await st.setJSON(K.res(uni, code), res);
    await refreshCourse(st, uni, code);
    await track(email, 'lib');
    return json({ ok: true });
  }

  // ---------- العمليات على عنصر موجود (كويز أو ملف/رابط) ----------
  const isRes = b.kind === 'res';
  const key = isRes ? K.res(uni, code) : K.quizzes(uni, code);
  const items = (await st.get(key, { type: 'json' })) || [];
  const it = items.find(x => x.id === b.id);
  if (!it) return err('العنصر مو موجود', 404);

  if (b.action === 'score' && !isRes) {
    const score = Math.round(Math.min(Math.max(Number(b.score) || 0, 0), 100));
    it.plays = (it.plays || 0) + 1;
    const top = it.top || [];
    const me = top.find(t => t.by === email);
    if (me) { if (score > me.score) { me.score = score; me.at = Date.now(); } }
    else top.push({ by: email, name: mask(email), score, at: Date.now() });
    top.sort((a, b2) => b2.score - a.score || a.at - b2.at);
    it.top = top.slice(0, 20);
    await st.setJSON(key, items);
    const rank = it.top.findIndex(t => t.by === email) + 1;
    return json({ rank: rank || null, top: it.top.slice(0, 5).map(t => ({ name: t.name, score: t.score, me: t.by === email })) });
  }

  if (b.action === 'report') {
    it.reports = it.reports || [];
    if (!it.reports.includes(email)) it.reports.push(email);
    if (it.reports.length >= REPORT_HIDE) it.hidden = true;
    await st.setJSON(key, items);
    await refreshCourse(st, uni, code);
    await addReport(st, { uni, code, kind: isRes ? 'res' : 'quiz', id: it.id, title: it.title, n: it.reports.length, hidden: !!it.hidden });
    return json({ ok: true, hidden: !!it.hidden });
  }

  if (b.action === 'delete') {
    if (it.by !== email && !admin) return err('ما تقدر تحذف شي أضافه غيرك', 403);
    await st.setJSON(key, items.filter(x => x.id !== it.id));
    if (isRes && it.fid) await store('files').delete(it.fid);
    if (!isRes) await st.delete(`q_${it.id}`);
    await refreshCourse(st, uni, code);
    await dropReport(st, it.id);
    return json({ ok: true });
  }

  if (b.action === 'restore' && admin) {
    it.hidden = false;
    it.reports = [];
    await st.setJSON(key, items);
    await refreshCourse(st, uni, code);
    await dropReport(st, it.id);
    return json({ ok: true });
  }

  return err('طلب غير معروف');
};

export const config = { path: '/api/library' };
