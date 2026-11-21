// POST /api/quiz  { text | image (JPEG base64), mode: 'same' | 'vary' }
// يرجع نص JSON من الذكاء الاصطناعي "أول بأول" (streaming)
// عشان ما ينقطع الطلب بسبب حد الـ 10 ثواني في Netlify
import { err, readToken, env } from '../lib/util.mjs';
import { useQuota, streamClaude } from '../lib/ai.mjs';
import { track } from '../lib/stats.mjs';

const MAX_CHARS = 4000;     // حجم الجزء الواحد
const MAX_IMAGE = 5_000_000; // حجم الصورة (base64) تقريباً 3.7MB
const DAILY_LIMIT = 80;     // عدد الأجزاء/الصور المسموحة لكل طالب في اليوم

const SYSTEM = `You convert a question bank (raw text extracted from PDF/Word, or a photo/scan of a page; Arabic or English) into a clean quiz.
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
- Fix broken symbols from PDF extraction when the meaning is clear (e.g. exponents "10-8" -> "10^-8", Greek letters, vectors).
- Skip questions that are cut off at the start or end of the text, or that depend on a figure you cannot see.
- For photos: read printed or handwritten questions carefully; ignore page headers, logos and student scribbles that are not part of a question.
- If there are no questions at all, return {"questions":[]}.
- Do not invent questions on topics that are not in the text.
- "explanation" is ONE short sentence (max 20 words). Keep the JSON compact.`;

const MODES = {
  same: 'Keep every question as written (fix only extraction glitches). Do not change numbers or meaning.',
  vary: 'For EACH question create a new version: change the numbers/values and rephrase the wording, but keep the same idea, concept and difficulty. Recalculate the correct answer for the new numbers and make wrong options plausible. Questions with no numbers: only rephrase.'
};

export default async req => {
  if (req.method !== 'POST') return err('Method not allowed', 405);
  const email = readToken(req);
  if (!email) return err('سجّل دخول من جديد', 401);

  let body;
  try { body = await req.json(); } catch { return err('طلب غير صالح'); }
  const text = String(body.text ?? '').trim().slice(0, MAX_CHARS);
  const image = typeof body.image === 'string' ? body.image : '';
  const mode = body.mode === 'vary' ? 'vary' : 'same';
  if (image) {
    if (image.length > MAX_IMAGE || !/^[A-Za-z0-9+/=]+$/.test(image.slice(0, 200))) return err('الصورة كبيرة أو غير صالحة');
  } else if (text.length < 20) {
    return err('النص قصير جداً');
  }

  const content = image
    ? [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
        { type: 'text', text: `${MODES[mode]}\n\nThe question bank is in the image above.` }
      ]
    : `${MODES[mode]}\n\n<source>\n${text}\n</source>`;

  if (!env('ANTHROPIC_API_KEY')) return err('ميزة الذكاء الاصطناعي غير مفعّلة في السيرفر', 500);
  if (!(await useQuota(email, 'quiz', DAILY_LIMIT))) {
    return err('وصلت الحد اليومي لصنع الكويزات، جرّب بكرة 🙏', 429);
  }
  if (body.first) await track(email, 'quiz'); // أول جزء = كويز جديد

  return streamClaude(SYSTEM, content, 6000);
};

export const config = { path: '/api/quiz' };
