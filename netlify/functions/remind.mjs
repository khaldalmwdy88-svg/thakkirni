// دالة مجدولة: كل 15 دقيقة تشيك على التذكيرات وترسل إيميل (وواتساب للي فعّله)
import { store, TYPES, env, getSettings } from '../lib/util.mjs';
import { sendMail, layout, escHtml, fmtDate } from '../lib/mail.mjs';
import { waConfigured, sendReminder, PER_USER_DAILY } from '../lib/wa.mjs';
import { useQuota } from '../lib/ai.mjs';
import { track } from '../lib/stats.mjs';

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
    ? ['هلا 👋 تذكير سريع:', `ترى عندنا ${type} ${t.subject} ${icon}`, t.title ? `📝 ${t.title}` : null, t.grade ? `🎯 عليه ${t.grade}` : null,
       `🗓️ ${fmtDate(t.due)}`, `⏳ باقي: ${leftText(t.due - now)}`, 'لا تنساه 😉', '', `ذكّرني: ${site}`]
    : ['🔔 تذكير للشعبة', `${icon} ${type} — ${t.subject}`, t.title ? `📝 ${t.title}` : null, t.grade ? `🎯 الدرجة: ${t.grade}` : null,
       `🗓️ الموعد: ${fmtDate(t.due)}`, `⏳ باقي: ${leftText(t.due - now)}`, '', `من موقع ذكّرني: ${site}`];
  return 'https://wa.me/?text=' + encodeURIComponent(lines.filter(l => l !== null).join('\n'));
}

// يرسل تذكيرات الواتساب لمستخدم واحد. يرجع IDs المهام اللي انتهينا منها
async function sendWhatsApp(email, u, due, now, state) {
  const done = [];
  for (const t of due.sort((a, b) => a.due - b.due)) {
    if (state.stop) break;
    // حد يومي لكل طالب: الزايد ما ينرسل (ويكفيه الإيميل)
    if (!(await useQuota(email, 'wa', PER_USER_DAILY))) { done.push(t.id); continue; }
    try {
      await sendReminder(u.wa.phone, [
        TYPES[t.type] || 'تاسك',
        t.title ? `${t.subject} — ${t.title}` : t.subject,
        fmtDate(t.due),
        leftText(t.due - now)
      ]);
      await track(email, 'wa');
      done.push(t.id);
    } catch (e) {
      console.error('wa reminder error', email, e.message);
      if (e.code === 'LIMIT' || e.code === 190) { state.stop = true; break; } // حد الشهر أو التوكن خربان: نوقف الكل
      done.push(t.id); // غير كذا نتخطاها عشان ما نعيد المحاولة كل ربع ساعة
    }
  }
  return done;
}

export default async () => {
  const tasks = store('tasks');
  const users = store('users');
  const { blobs } = await tasks.list();
  const now = Date.now();
  const settings = await getSettings();
  const waOn = waConfigured() && settings.wa !== false;
  const waState = { stop: false };

  for (const { key } of blobs) {
    const list = (await tasks.get(key, { type: 'json' })) || [];
    const email = decodeURIComponent(key);
    const open = list.filter(t => !t.done && !t.hidden && now < t.due);

    // ---------- واتساب ----------
    let waSent = [];
    if (waOn && !waState.stop) {
      const cand = open.filter(t => !t.w1 && t.due - now <= 24 * 3600e3);
      if (cand.length) {
        const u = await users.get(key, { type: 'json' });
        if (u?.wa?.verified && u.wa.on && u.wa.phone) {
          const ready = cand.filter(t => now >= t.due - (u.wa.lead || 6) * 3600e3);
          if (ready.length) waSent = await sendWhatsApp(email, u, ready, now, waState);
        }
      }
    }

    // ---------- إيميل ----------
    const due = open.filter(t => !t.e1 && now >= t.due - t.remind * 60000);
    let mailSent = [];
    if (due.length) {
      const rows = due.sort((a, b) => a.due - b.due).map(t => `
      <div style="background:#0b0918;border:1px solid #3a3266;border-radius:14px;padding:14px 16px;margin-bottom:10px">
        <div style="font-size:17px;font-weight:800">${ICONS[t.type] || '✅'} ${TYPES[t.type] || 'تاسك'} — ${escHtml(t.subject)}</div>
        ${t.title ? `<div style="color:#cfc9e6;margin-top:4px">${escHtml(t.title)}</div>` : ''}
        ${t.grade ? `<div style="color:#a78bfa;margin-top:4px;font-size:14px">🎯 الدرجة: ${escHtml(t.grade)}</div>` : ''}
        ${t.note ? `<div style="background:#1b1733;border-radius:10px;padding:8px 10px;margin-top:8px;font-size:14px;color:#e5e0ff">📌 ملاحظتك: ${escHtml(t.note)}</div>` : ''}
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
        mailSent = due.map(t => t.id);
      } catch (e) {
        console.error('remind mail error', email, e);
      }
    }

    if (!mailSent.length && !waSent.length) continue;
    // نقرأ آخر نسخة قبل الحفظ عشان ما نمسح تعديلات الطالب
    const m = new Set(mailSent), w = new Set(waSent);
    const fresh = (await tasks.get(key, { type: 'json' })) || [];
    fresh.forEach(t => { if (m.has(t.id)) t.e1 = true; if (w.has(t.id)) t.w1 = true; });
    await tasks.setJSON(key, fresh);
  }
  return new Response('ok');
};

export const config = { schedule: '*/15 * * * *' };
