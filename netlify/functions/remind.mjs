// دالة مجدولة: كل 15 دقيقة تشيك على التذكيرات وترسل إيميل للطلاب
import { store, TYPES, env } from '../lib/util.mjs';
import { sendMail, layout, escHtml, fmtDate } from '../lib/mail.mjs';

const ICONS = { quiz: '📝', exam: '🎯', task: '✅', hw: '📚', project: '🚀', lab: '🧪' };

function leftText(ms) {
  const h = Math.max(1, Math.round(ms / 3600000));
  if (h < 24) return h === 1 ? 'ساعة' : h === 2 ? 'ساعتين' : h <= 10 ? `${h} ساعات` : `${h} ساعة`;
  const d = Math.round(h / 24);
  return d === 1 ? 'يوم' : d === 2 ? 'يومين' : d <= 10 ? `${d} أيام` : `${d} يوم`;
}

// رسالة جاهزة لقروب الشعبة على واتساب
function waLink(t, now) {
  const site = env('URL') || 'https://thakkirni-kau.netlify.app';
  const msg = [
    `🔔 تذكير للشعبة`,
    `${ICONS[t.type] || '✅'} ${TYPES[t.type] || 'تاسك'} — ${t.subject}`,
    t.title ? `📝 ${t.title}` : '',
    `🗓️ الموعد: ${fmtDate(t.due)}`,
    `⏳ باقي: ${leftText(t.due - now)}`,
    ``,
    `من موقع ذكّرني: ${site}`
  ].filter((l, i) => l !== '' || i === 5).join('\n');
  return 'https://wa.me/?text=' + encodeURIComponent(msg);
}

export default async () => {
  const tasks = store('tasks');
  const { blobs } = await tasks.list();
  const now = Date.now();

  for (const { key } of blobs) {
    const list = (await tasks.get(key, { type: 'json' })) || [];
    const due = list.filter(t => !t.done && !t.e1 && now >= t.due - t.remind * 60000 && now < t.due);
    if (!due.length) continue;

    const email = decodeURIComponent(key);
    const rows = due.sort((a, b) => a.due - b.due).map(t => `
      <div style="background:#0b0918;border:1px solid #3a3266;border-radius:14px;padding:14px 16px;margin-bottom:10px">
        <div style="font-size:17px;font-weight:800">${ICONS[t.type] || '✅'} ${TYPES[t.type] || 'تاسك'} — ${escHtml(t.subject)}</div>
        ${t.title ? `<div style="color:#cfc9e6;margin-top:4px">${escHtml(t.title)}</div>` : ''}
        <div style="color:#f5c76b;margin-top:6px;font-size:14px">🗓️ ${fmtDate(t.due)} — باقي ${leftText(t.due - now)}</div>
        <a href="${waLink(t, now)}" style="display:inline-block;margin-top:12px;background:#25D366;color:#06301a;font-weight:800;text-decoration:none;padding:10px 16px;border-radius:12px;font-size:14px">📤 أرسلها لقروب الشعبة</a>
      </div>`).join('');

    try {
      const first = due[0];
      await sendMail(
        email,
        `🔔 تذكير: ${TYPES[first.type] || 'تاسك'} ${first.subject}${due.length > 1 ? ` (+${due.length - 1})` : ''}`,
        layout('عندك مواعيد قريبة 👇', rows + '<p style="color:#a19cb8;margin-top:14px">اضغط الزر الأخضر عشان ترسل التذكير لأصحابك في واتساب 💚<br>بالتوفيق! 🍀</p>')
      );
      // نقرأ آخر نسخة قبل الحفظ عشان ما نمسح تعديلات الطالب
      const sent = new Set(due.map(t => t.id));
      const fresh = (await tasks.get(key, { type: 'json' })) || [];
      fresh.forEach(t => { if (sent.has(t.id)) t.e1 = true; });
      await tasks.setJSON(key, fresh);
    } catch (e) {
      console.error('remind mail error', email, e);
    }
  }
  return new Response('ok');
};

export const config = { schedule: '*/15 * * * *' };
