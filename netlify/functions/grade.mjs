// POST /api/grade  { items: [{ question, model, answer }] }  →  { results: [{ score, feedback }] }
// يصحح الأسئلة المقالية والقصيرة
import { json, err, readToken } from '../lib/util.mjs';
import { askClaude, extractJSON, useQuota } from '../lib/ai.mjs';
import { track } from '../lib/stats.mjs';

const MAX_ITEMS = 10;
const DAILY_LIMIT = 150;

const SYSTEM = `You are a fair university grader. For each item compare the student's answer with the model answer.
Judge by meaning, not exact wording. Ignore spelling mistakes. An empty answer scores 0.
Return ONLY JSON, no prose:
{"results":[{"score":1,"feedback":"..."}]}
- score: 1 = correct, 0.5 = partially correct, 0 = wrong.
- feedback: one short sentence in the same language as the question, telling what was missing or confirming it is right.
- Keep the results in the same order as the items.`;

const str = (v, n) => String(v ?? '').trim().slice(0, n);

export default async req => {
  if (req.method !== 'POST') return err('Method not allowed', 405);
  const email = readToken(req);
  if (!email) return err('سجّل دخول من جديد', 401);

  let body;
  try { body = await req.json(); } catch { return err('طلب غير صالح'); }
  const items = (Array.isArray(body.items) ? body.items : []).slice(0, MAX_ITEMS).map(i => ({
    question: str(i?.question, 1500),
    model: str(i?.model, 2000),
    answer: str(i?.answer, 3000)
  }));
  if (!items.length) return err('ما فيه إجابات للتصحيح');

  if (!(await useQuota(email, 'grade', DAILY_LIMIT))) {
    return err('وصلت الحد اليومي للتصحيح، جرّب بكرة 🙏', 429);
  }

  await track(email, 'grade');
  try {
    const reply = await askClaude(SYSTEM, JSON.stringify({ items }), 1500);
    const data = extractJSON(reply);
    const raw = Array.isArray(data.results) ? data.results : [];
    const results = items.map((_, i) => {
      const r = raw[i] || {};
      const s = Number(r.score);
      return { score: s >= 1 ? 1 : s >= 0.5 ? 0.5 : 0, feedback: str(r.feedback, 400) };
    });
    return json({ results });
  } catch (e) {
    console.error('grade error', e);
    if (e.message === 'NO_KEY') return err('ميزة الذكاء الاصطناعي غير مفعّلة في السيرفر', 500);
    return err('ما قدرنا نصحح الحين، جرّب مرة ثانية', 502);
  }
};

export const config = { path: '/api/grade' };
