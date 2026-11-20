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

// رسالة واتساب جاهزة: kind = 'group' للقروب، 'friend' لصاحبك
function waLink(t, now, kind) {
  const site = env('URL') || 'https://thakkirni-kau.netlify.app';
  const type = TYPES[t.type] || 'تاسك';
  const icon = ICONS[t.type] || '✅';
  const lines = kind === 'friend'
    ? ['هلا 👋 تذكير سريع:', `ترى عندنا ${type} ${t.subject} ${icon}`, t.title ? `📝 ${t.title}` : null,
       `🗓️ ${fmtDate(t.due)}`, `⏳ باقي: ${leftText(t.due - now)}`, 'لا تنساه 😉', '', `ذكّرني: ${site}`]
    : ['🔔 تذكير للشعبة', `${icon} ${type} — ${t.subject}`, t.title ? `📝 ${t.title}` : null,
       `🗓️ الموعد: ${fmtDate(t.due)}`, `⏳ باقي: ${leftText(t.due - now)}`, '', `من موقع ذكّرني: ${site}`];
  return 'https://wa.me/?text=' + encodeURIComponent(lines.filter(l => l !== null).join('\n'));
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
        <div>
          <a href="${waLink(t, now, 'group')}" style="display:inline-block;margin:12px 0 0 6px;font-weight:800;text-decoration:none;padding:10px 14px;border-radius:12px;font-size:14px;background:#25D366;color:#06301a">👥 أرسلها لقروب الشعبة</a>
          <a href="${waLink(t, now, 'friend')}" style="display:inline-block;margin:12px 0 0 6px;font-weight:800;text-decoration:none;padding:10px 14px;border-radius:12px;font-size:14px;background:#1f3a2b;color:#7ef0a8;border:1px solid #25D366">💬 أرسلها لصاحبك</a>
        </div>
      </div>`).join('');

    try {
      const first = due[0];
      await sendMail(
        email,
        `🔔 تذكير: ${TYPES[first.type] || 'تاسك'} ${first.subject}${due.length > 1 ? ` (+${due.length - 1})` : ''}`,
        layout('عندك مواعيد قريبة 👇', rows + '<p style="color:#a19cb8;margin-top:14px">تبي تذكّر أصحابك؟ اضغط الزر الأخضر وتنفتح لك رسالة واتساب جاهزة 💚<br>بالتوفيق! 🍀</p>')
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
