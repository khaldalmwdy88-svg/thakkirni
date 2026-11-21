// أدوات المكتبة المشتركة (library.mjs + upload.mjs)
import { store, keyOf, isAdmin } from './util.mjs';
import { ns, isUni } from './unis.mjs';

export const lib = () => store('library');
export const str = (v, n) => String(v ?? '').trim().slice(0, n);

// أقسام كل مادة
export const SECS = { quiz: 'كويزات وتست بانك', sum: 'ملخصات', slides: 'سلايدات', links: 'شروحات وروابط' };

// رمز المادة: حروف (إنجليزي أو عربي) + أرقام. "101 فيز" تصير "فيز101"
export function normCode(c) {
  let s = String(c ?? '').toUpperCase().replace(/[\s_\-.]/g, '').slice(0, 14);
  const m = s.match(/^(\d{2,4})([A-Zء-ي]{2,8})$/);
  if (m) s = m[2] + m[1];
  return s;
}
export const validCode = c => /^[A-Zء-ي]{2,8}\d{2,4}[A-Z]?$/.test(c);

export const mask = email => {
  const n = email.split('@')[0];
  return n.length > 4 ? n.slice(0, 3) + '***' + n.slice(-1) : n.slice(0, 2) + '***';
};

// جامعة الطالب. الأدمن يقدر يتصفح أي جامعة
export async function uniOf(email, asked) {
  if (isAdmin(email) && isUni(asked)) return asked;
  const u = await store('users').get(keyOf(email), { type: 'json' });
  return u?.uni || null;
}

export const K = {
  courses: uni => ns(uni, 'courses'),
  quizzes: (uni, code) => ns(uni, `c_${code}`),
  res: (uni, code) => ns(uni, `r_${code}`)
};

// يحدّث عدد المحتوى في بطاقة المادة
export async function refreshCourse(st, uni, code) {
  const courses = (await st.get(K.courses(uni), { type: 'json' })) || [];
  const c = courses.find(x => x.code === code);
  if (!c) return;
  const quizzes = (await st.get(K.quizzes(uni, code), { type: 'json' })) || [];
  const res = (await st.get(K.res(uni, code), { type: 'json' })) || [];
  const n = { quiz: 0, sum: 0, slides: 0, links: 0 };
  quizzes.forEach(q => { if (!q.hidden) n.quiz++; });
  res.forEach(r => { if (!r.hidden && n[r.sec] !== undefined) n[r.sec]++; });
  c.n = n;
  c.count = n.quiz + n.sum + n.slides + n.links;
  c.updated = Date.now();
  await st.setJSON(K.courses(uni), courses);
}

// قائمة البلاغات للأدمن
export async function addReport(st, item) {
  const list = (await st.get('reports', { type: 'json' })) || [];
  const old = list.find(r => r.id === item.id);
  if (old) { old.n = item.n; old.at = Date.now(); old.hidden = item.hidden; }
  else list.unshift({ ...item, at: Date.now() });
  await st.setJSON('reports', list.slice(0, 200));
}
export async function dropReport(st, id) {
  const list = (await st.get('reports', { type: 'json' })) || [];
  const rest = list.filter(r => r.id !== id);
  if (rest.length !== list.length) await st.setJSON('reports', rest);
}
