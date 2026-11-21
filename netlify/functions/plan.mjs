// POST /api/plan  { message, history, plan, tasks, today, material }
// مساعد خطة المذاكرة: يسأل إذا ناقصه شي، أو يسوي/يعدّل الخطة
import { err, readToken } from '../lib/util.mjs';
import { useQuota, streamClaude } from '../lib/ai.mjs';
import { track } from '../lib/stats.mjs';

const DAILY_LIMIT = 40;

const SYSTEM = `You are "ذكّرني", a friendly study-planning assistant for Saudi university students. Speak Arabic in a light Saudi/Hijazi tone, short and warm.
You receive: today's date, the student's reminders (exams, quizzes, homework with due dates), optional exam material (syllabus/sections/slides text), the current plan (if any), the recent chat, and the student's new message.

Your job: build or adjust a realistic day-by-day study plan.

Before making a plan you MUST know:
1) which exam(s)/course(s) and the exam date (use the reminders if the student refers to them),
2) what content/sections to study (from the message or the attached material),
3) how many days the student wants to finish studying in, or until when (ask "كم يوم تبي تخلص فيه المذاكرة؟" if not stated),
4) busy days or constraints, if they mentioned any (don't insist on this one).
If 1–3 are missing, do NOT make a plan: ask for the missing info in ONE short message (max 2 questions), plan = null.

When planning:
- Plan only from today until the deadline the student chose (max 30 days). Never schedule study after the exam.
- Estimate each section's weight from the material (length, number of topics, math-heavy = more time) and give heavier sections more time.
- Respect busy days (lighter or empty) and include existing homework/quiz deadlines from the reminders as items on/before their due date.
- Keep daily load realistic (30–240 minutes). Split big sections across days. Add short reviews of earlier sections.
- The last day(s) before an exam: full review + practice questions (suggest using the site's quiz maker).
- When a plan already exists and the student asks for a change, keep everything else the same and only change what they asked.

Return ONLY JSON, no markdown:
{"reply":"short Arabic message to the student","plan":null | {"title":"...","days":[{"date":"YYYY-MM-DD","items":[{"subject":"...","task":"...","minutes":60}]}]}}
- "reply" explains briefly what you did or asks your question. Max 3 sentences.
- Dates must be real ISO dates starting from today.
- If you return a plan, return the FULL plan (all days), not only the changed days.`;

const str = (v, n) => String(v ?? '').slice(0, n);

export default async req => {
  if (req.method !== 'POST') return err('Method not allowed', 405);
  const email = readToken(req);
  if (!email) return err('سجّل دخول من جديد', 401);

  let b;
  try { b = await req.json(); } catch { return err('طلب غير صالح'); }

  const message = str(b.message, 2000).trim();
  if (!message) return err('اكتب رسالتك للمساعد');

  if (!(await useQuota(email, 'plan', DAILY_LIMIT))) {
    return err('وصلت الحد اليومي لرسائل المساعد، جرّب بكرة 🙏', 429);
  }

  const history = (Array.isArray(b.history) ? b.history : []).slice(-8)
    .map(m => `${m.role === 'assistant' ? 'المساعد' : 'الطالب'}: ${str(m.text, 800)}`).join('\n');
  const tasks = (Array.isArray(b.tasks) ? b.tasks : []).slice(0, 60)
    .map(t => `- ${str(t.type, 20)} | ${str(t.subject, 80)} | ${str(t.title, 150)} | ${str(t.due, 40)}`).join('\n');

  const content = [
    `Today: ${str(b.today, 40)}`,
    `Student reminders (type | subject | note | due):\n${tasks || '(none)'}`,
    b.material ? `<exam_material>\n${str(b.material, 30000)}\n</exam_material>` : 'Exam material: (none attached)',
    b.plan ? `Current plan JSON:\n${str(JSON.stringify(b.plan), 15000)}` : 'Current plan: (none yet)',
    `Recent chat:\n${history || '(start of chat)'}`,
    `Student's new message: ${message}`
  ].join('\n\n');

  await track(email, 'plan');
  return streamClaude(SYSTEM, content, 6000);
};

export const config = { path: '/api/plan' };
