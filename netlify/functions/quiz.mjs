// POST /api/quiz  { text, mode: 'same' | 'vary' }  →  { questions: [...] }
// يحوّل جزء من بنك أسئلة إلى أسئلة كويز منظمة
import { json, err, readToken } from '../lib/util.mjs';
import { askClaude, extractJSON, useQuota } from '../lib/ai.mjs';

const MAX_CHARS = 6000;     // حجم الجزء الواحد
const DAILY_LIMIT = 40;     // عدد الأجزاء المسموحة لكل طالب في اليوم

const SYSTEM = `You convert raw question-bank text (extracted from PDF/Word, may be messy, Arabic or English) into a clean quiz.
Return ONLY a JSON object, no prose, no markdown fences:
{"questions":[
 {"type":"mcq","question":"...","options":["...","..."],"answer":0,"explanation":"..."},
 {"type":"tf","question":"...","options":["صح","خطأ"],"answer":0,"explanation":"..."},
 {"type":"short","question":"...","answer":"model answer","explanation":"..."},
 {"type":"essay","question":"...","answer":"model answer / key points","explanation":"..."}
]}
Rules:
- "answer" for mcq/tf is the 0-based index of the correct option.
- Keep the SAME language as the source. For tf in English use ["True","False"].
- If the source marks the correct answer, use it. If not, solve it yourself carefully.
- Skip questions that are cut off at the start or end of the text.
- Do not invent questions on topics that are not in the text.
- "explanation" is one short sentence.`;

const MODES = {
  same: 'Keep every question exactly as written (fix only obvious extraction glitches). Do not change numbers or meaning.',
  vary: 'For EACH question create a new version: change the numbers/values and rephrase the wording, but keep the same idea, concept and difficulty. Recalculate the correct answer for the new numbers and make wrong options plausible. Questions with no numbers: only rephrase.'
};

const str = (v, n) => String(v ?? '').trim().slice(0, n);

function clean(q) {
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

export default async req => {
  if (req.method !== 'POST') return err('Method not allowed', 405);
  const email = readToken(req);
  if (!email) return err('سجّل دخول من جديد', 401);

  let body;
  try { body = await req.json(); } catch { return err('طلب غير صالح'); }
  const text = str(body.text, MAX_CHARS);
  const mode = body.mode === 'vary' ? 'vary' : 'same';
  if (text.length < 20) return err('النص قصير جداً');

  if (!(await useQuota(email, 'quiz', DAILY_LIMIT))) {
    return err('وصلت الحد اليومي لصنع الكويزات، جرّب بكرة 🙏', 429);
  }

  try {
    const reply = await askClaude(SYSTEM, `${MODES[mode]}\n\n<source>\n${text}\n</source>`, 4000);
    const data = extractJSON(reply);
    const questions = (Array.isArray(data.questions) ? data.questions : []).map(clean).filter(Boolean).slice(0, 40);
    return json({ questions });
  } catch (e) {
    console.error('quiz error', e);
    if (e.message === 'NO_KEY') return err('ميزة الذكاء الاصطناعي غير مفعّلة في السيرفر', 500);
    return err('ما قدرنا نحوّل هالجزء، جرّب مرة ثانية', 502);
  }
};

export const config = { path: '/api/quiz' };
