// قراءة تقويم Blackboard (ملف .ics) وإضافة الواجبات كتذكيرات
import crypto from 'node:crypto';
import { store, keyOf } from './util.mjs';

const DAY = 86400000;
const TZ_OFFSET_H = 3; // توقيت السعودية (UTC+3) للمواعيد اللي ما فيها منطقة زمنية

// ---------- قراءة ملف ICS ----------
export function parseICS(text) {
  const lines = text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const events = [];
  let cur = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (line === 'END:VEVENT') { if (cur) events.push(cur); cur = null; continue; }
    if (!cur) continue;
    const i = line.indexOf(':');
    if (i < 0) continue;
    const [name, ...params] = line.slice(0, i).split(';');
    const p = {};
    params.forEach(x => { const [k, v] = x.split('='); if (k) p[k.toUpperCase()] = v; });
    cur[name.toUpperCase()] = { value: line.slice(i + 1), params: p };
  }
  return events;
}

const unesc = v => String(v ?? '').replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1').trim();

function parseDate(prop) {
  if (!prop) return null;
  const m = prop.value.trim().match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, Y, M, D, h, mi, se, z] = m;
  if (!h) return Date.UTC(+Y, +M - 1, +D, 23 - TZ_OFFSET_H, 59); // يوم كامل → 11:59 م
  if (z) return Date.UTC(+Y, +M - 1, +D, +h, +mi, +(se || 0));
  return Date.UTC(+Y, +M - 1, +D, +h - TZ_OFFSET_H, +mi, +(se || 0));
}

const KEYWORDS = /due|assignment|quiz|exam|test|midterm|final|homework|project|lab|submission|واجب|اختبار|امتحان|كويز|مشروع|تسليم|معمل|تكليف/i;

function guessType(t) {
  if (/quiz|كويز|اختبار قصير/i.test(t)) return 'quiz';
  if (/exam|midterm|final|test|اختبار|امتحان|ميد|فاينل/i.test(t)) return 'exam';
  if (/lab|معمل/i.test(t)) return 'lab';
  if (/project|مشروع/i.test(t)) return 'project';
  if (/assignment|homework|hw|واجب|تكليف|تسليم/i.test(t)) return 'hw';
  return 'task';
}

function courseCode(text) {
  const m = String(text).toUpperCase().match(/(?:^|[^A-Z])([A-Z]{2,5})\s?(\d{3})(?!\d)/);
  return m ? m[1] + m[2] : '';
}

// يحوّل حدث من التقويم إلى تذكير (أو null إذا مو واجب/اختبار)
export function toItem(ev) {
  if (ev.RRULE) return null; // محاضرات متكررة، مو واجبات
  const summary = unesc(ev.SUMMARY?.value);
  if (!summary) return null;
  const start = parseDate(ev.DTSTART);
  const end = parseDate(ev.DTEND) ?? start;
  if (!start) return null;
  const extra = [unesc(ev.DESCRIPTION?.value), unesc(ev.LOCATION?.value), unesc(ev.CATEGORIES?.value)].join(' ');
  const zeroLength = end - start <= 60000;
  if (!zeroLength && !KEYWORDS.test(summary + ' ' + extra)) return null;

  const code = courseCode(summary) || courseCode(extra);
  const title = summary.replace(/\b\d{6}_[A-Z0-9_]+:?\s*/gi, '').trim().slice(0, 200) || summary.slice(0, 200);
  return {
    uid: unesc(ev.UID?.value) || crypto.createHash('sha1').update(summary + start).digest('hex'),
    due: Math.max(start, end),
    type: guessType(summary + ' ' + extra),
    subject: code || title.slice(0, 60),
    title
  };
}

// ---------- التحقق من الرابط ----------
export function checkUrl(raw) {
  let u;
  try { u = new URL(String(raw).trim()); } catch { return null; }
  if (u.protocol === 'webcal:') u = new URL('https:' + u.href.slice('webcal:'.length));
  if (u.protocol !== 'https:' || u.href.length > 2000) return null;
  const h = u.hostname;
  if (h === 'localhost' || /^[\d.]+$/.test(h) || h.includes(':') || !h.includes('.')) return null;
  return u.href;
}

// ---------- المزامنة لطالب واحد ----------
export async function syncUser(email, url) {
  const res = await fetch(url, {
    headers: { 'user-agent': 'Thakkirni/1.0 (+calendar sync)', accept: 'text/calendar,*/*' },
    redirect: 'follow',
    signal: AbortSignal.timeout(8000)
  });
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  const text = (await res.text()).slice(0, 3_000_000);
  if (!text.includes('BEGIN:VCALENDAR')) throw new Error('NOT_ICS');

  const now = Date.now();
  const items = parseICS(text).map(toItem)
    .filter(x => x && x.due > now - DAY && x.due < now + 150 * DAY)
    .slice(0, 300);

  const st = store('tasks');
  const k = keyOf(email);
  const list = (await st.get(k, { type: 'json' })) || [];
  const byUid = new Map(list.filter(t => t.src === 'bb').map(t => [t.bbUid, t]));
  let added = 0, updated = 0;

  for (const it of items) {
    const ex = byUid.get(it.uid);
    if (ex) {
      if (ex.due !== it.due || ex.title !== it.title) {
        ex.due = it.due;
        ex.title = it.title;
        ex.e1 = ex.n1 = ex.n2 = false; // الموعد تغيّر → نذكّره من جديد
        updated++;
      }
    } else {
      list.push({
        id: 'bb' + crypto.createHash('sha1').update(it.uid).digest('hex').slice(0, 16),
        type: it.type, subject: it.subject, title: it.title, due: it.due,
        remind: 1440, done: false, created: now, n1: false, n2: false, e1: false,
        note: '', grade: '', src: 'bb', bbUid: it.uid, hidden: false
      });
      added++;
    }
  }
  if (added || updated) await st.setJSON(k, list.slice(-500));
  return { added, updated, found: items.length };
}

// ---------- سجل الربط ----------
export const bbStore = () => store('userdata');
export const bbKey = email => `${keyOf(email)}_bb`;

export function errorText(e) {
  const m = String(e?.message || e);
  if (m === 'NOT_ICS') return 'الرابط ما فيه تقويم. تأكد إنك نسخت رابط Share calendar';
  if (m.startsWith('HTTP_4')) return 'Blackboard رفض الرابط. يمكن انتهت صلاحيته، سوّ رابط جديد';
  if (m.includes('timeout') || m.includes('abort')) return 'Blackboard تأخر في الرد، بنحاول مرة ثانية بعدين';
  return 'ما قدرنا نقرأ التقويم الحين، بنحاول مرة ثانية بعدين';
}
