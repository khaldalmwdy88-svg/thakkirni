// ☀️ ملخص الصباح — كل يوم الساعة 7 الصبح (بتوقيت السعودية)
// يرسل لكل طالب: مذاكرة اليوم من خطته + المواعيد القريبة والمتأخرة
// ما يرسل شي إذا ما عنده شي اليوم
import { store, TYPES, getSettings } from '../lib/util.mjs';
import { sendMail, layout, escHtml, fmtDate } from '../lib/mail.mjs';
import { waConfigured, sendDigest } from '../lib/wa.mjs';
import { track, dayKey } from '../lib/stats.mjs';

const ICONS = { quiz: '📝', exam: '🎯', task: '✅', hw: '📚', project: '🚀', lab: '🧪' };
const H = 3600e3;

function leftText(ms) {
  const h = Math.max(1, Math.round(ms / H));
  if (h < 24) return h === 1 ? 'ساعة' : h === 2 ? 'ساعتين' : h <= 10 ? `${h} ساعات` : `${h} ساعة`;
  const d = Math.round(h / 24);
  return d === 1 ? 'يوم' : d === 2 ? 'يومين' : `${d} أيام`;
}

// يجمع محتوى الملخص لطالب واحد
function buildDigest(tasks, plan, now = Date.now()) {
  const today = dayKey(now);
  const day = plan?.days?.find(d => d.date === today);
  const study = (day?.items || []).filter(it => !it.done);
  const open = tasks.filter(t => !t.done && !t.hidden);
  const late = open.filter(t => t.due <= now && now - t.due < 7 * 24 * H).sort((a, b) => a.due - b.due);
  const soon = open.filter(t => t.due > now && t.due - now <= 72 * H).sort((a, b) => a.due - b.due);
  return { study, late, soon, empty: !study.length && !late.length && !soon.length };
}

function mailHTML({ study, late, soon }, now) {
  const box = (title, inner) => `<div style="background:#0b0918;border:1px solid #3a3266;border-radius:14px;padding:14px 16px;margin-bottom:12px">
    <div style="font-size:16px;font-weight:800;margin-bottom:8px">${title}</div>${inner}</div>`;
  const task = t => `<div style="padding:6px 0;border-top:1px solid #241f40">${ICONS[t.type] || '✅'} <b>${TYPES[t.type] || 'تاسك'} — ${escHtml(t.subject)}</b>${t.title ? ` · ${escHtml(t.title)}` : ''}
    <div style="color:#f5c76b;font-size:13px">🗓️ ${fmtDate(t.due)} — ${t.due > now ? 'باقي ' + leftText(t.due - now) : 'متأخر ' + leftText(now - t.due)}</div></div>`;
  let html = '';
  if (study.length) {
    const mins = study.reduce((s, it) => s + (Number(it.minutes) || 0), 0);
    html += box(`📚 مذاكرة اليوم ${mins ? `<span style="color:#a19cb8;font-weight:500;font-size:13px">(تقريباً ${Math.round(mins / 6) / 10} ساعة)</span>` : ''}`,
      study.map(it => `<div style="padding:6px 0;border-top:1px solid #241f40">☐ <span style="color:#f5c76b;font-weight:700">${escHtml(it.subject)}</span> ${escHtml(it.task)}${it.minutes ? ` <span style="color:#a19cb8">· ${it.minutes} د</span>` : ''}</div>`).join(''));
  }
  if (soon.length) html += box('⏰ مواعيد قريبة (3 أيام)', soon.map(task).join(''));
  if (late.length) html += box('⚠️ متأخرة', late.map(task).join(''));
  return html;
}

// نص قصير لمتغيرات قالب الواتساب (سطر واحد)
function waParams({ study, late, soon }, now) {
  const s = study.length ? study.slice(0, 5).map(it => `${it.subject} ${it.task}`).join('، ') + (study.length > 5 ? ` (+${study.length - 5})` : '') : 'ما عندك مذاكرة مجدولة اليوم';
  const all = [...late, ...soon];
  const t = all.length
    ? all.slice(0, 5).map(x => `${TYPES[x.type] || 'تاسك'} ${x.subject} (${x.due > now ? 'باقي ' + leftText(x.due - now) : 'متأخر'})`).join('، ') + (all.length > 5 ? ` (+${all.length - 5})` : '')
    : 'ما عندك مواعيد قريبة';
  return [s, t];
}

export default async () => {
  const users = store('users');
  const tasksSt = store('tasks');
  const udata = store('userdata');
  const settings = await getSettings();
  const waOn = waConfigured() && settings.wa !== false;
  const now = Date.now();
  const today = dayKey(now);
  const started = Date.now();
  let waStop = false, sent = 0;

  const { blobs } = await users.list();
  for (const { key } of blobs) {
    if (Date.now() - started > 24000) { console.warn('digest: time budget hit'); break; }
    const u = await users.get(key, { type: 'json' });
    if (!u || u.digestDay === today) continue; // ما نرسل مرتين في نفس اليوم
    const wantMail = u.digest?.mail !== false;
    const wantWa = waOn && !waStop && u.digest?.wa && u.wa?.verified && u.wa.on;
    if (!wantMail && !wantWa) continue;

    const [tasks, plan] = await Promise.all([
      tasksSt.get(key, { type: 'json' }),
      udata.get(`${key}_plan`, { type: 'json' })
    ]);
    const d = buildDigest(tasks || [], plan?.plan, now);
    if (d.empty) continue;

    const email = u.email || decodeURIComponent(key);
    let ok = false;
    if (wantMail) {
      try {
        await sendMail(email, `☀️ ملخص يومك${d.study.length ? ` — ${d.study.length === 1 ? 'مهمة مذاكرة' : d.study.length + ' مهام مذاكرة'}` : ''}${d.soon.length ? ` · ${d.soon.length === 1 ? 'موعد قريب' : d.soon.length + ' مواعيد قريبة'}` : ''}`,
          layout('صباح الخير ☀️ هذا يومك', mailHTML(d, now) + '<p style="color:#a19cb8;margin-top:10px">تقدر توقف ملخص الصباح من صفحة <b>حسابي</b> في الموقع. بالتوفيق 🍀</p>'));
        ok = true;
      } catch (e) { console.error('digest mail', email, e); }
    }
    if (wantWa) {
      try {
        await sendDigest(u.wa.phone, waParams(d, now));
        await track(email, 'wa');
        ok = true;
      } catch (e) {
        console.error('digest wa', email, e.message);
        if (e.code === 'LIMIT' || e.code === 190) waStop = true;
      }
    }
    if (ok) {
      sent++;
      const fresh = (await users.get(key, { type: 'json' })) || u;
      fresh.digestDay = today;
      await users.setJSON(key, fresh);
    }
  }
  if (sent) await track(null, 'digest', sent);
  return new Response('ok');
};

// 7:00 الصبح بتوقيت السعودية = 4:00 UTC
export const config = { schedule: '0 4 * * *' };
