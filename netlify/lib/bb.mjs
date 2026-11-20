// قراءة تقويمات الجامعة (Blackboard / Google Classroom) وإضافة الواجبات كتذكيرات
import crypto from 'node:crypto';
import { store, keyOf } from './util.mjs';

const DAY = 86400000;
const TZ_OFFSET_H = 3; // توقيت السعودية (UTC+3) للمواعيد اللي ما فيها منطقة زمنية
export const MAX_LINKS = 3;

// ---------- قراءة ملف ICS ----------
export function parseCalendar(text) {
  const lines = text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const events = [];
  let cur = null, calName = '';
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (line === 'END:VEVENT') { if (cur) events.push(cur); cur = null; continue; }
    const i = line.indexOf(':');
    if (i < 0) continue;
    const [name, ...params] = line.slice(0, i).split(';');
    if (!cur) {
      if (name.toUpperCase() === 'X-WR-CALNAME') calName = unesc(line.slice(i + 1));
      continue;
    }
    const p = {};
    params.forEach(x => { const [k, v] = x.split('='); if (k) p[k.toUpperCase()] = v; });
    cur[name.toUpperCase()] = { value: line.slice(i + 1), params: p };
  }
  return { events, calName };
}
export const parseICS = text => parseCalendar(text).events;

function unesc(v) {
  return String(v ?? '').replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1').trim();
}

function parseDate(prop) {
  if (!prop) return null;
  const m = prop.value.trim().match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, Y, M, D, h, mi, se, z] = m;
  if (!h) return Date.UTC(+Y, +M - 1, +D, 23 - TZ_OFFSET_H, 59); // يوم كامل → 11:59 م
  if (z) return Date.UTC(+Y, +M - 1, +D, +h, +mi, +(se || 0));
  return Date.UTC(+Y, +M - 1, +D, +h - TZ_OFFSET_H, +mi, +(se || 0));
}

// مواعيد مو واجبات: محاضرات، ساعات مكتبية...
const EXCLUDE = /office hours?|lecture|class session|meeting|ساعات مكتبية|محاضرة|اجتماع|لقاء/i;

function guessType(t) {
  if (/quiz|كويز|اختبار قصير/i.test(t)) return 'quiz';
  if (/exam|midterm|final|test|اختبار|امتحان|ميد|فاينل/i.test(t)) return 'exam';
  if (/lab|معمل/i.test(t)) return 'lab';
  if (/project|مشروع/i.test(t)) return 'project';
  if (/assignment|homework|hw|due|واجب|تكليف|تسليم/i.test(t)) return 'hw';
  return 'task';
}

function courseCode(text) {
  const m = String(text).toUpperCase().match(/(?:^|[^A-Z])([A-Z]{2,5})\s?(\d{3})(?!\d)/);
  return m ? m[1] + m[2] : '';
}

// يحوّل حدث من التقويم إلى تذكير، أو يرجع سبب التجاهل
export function toItem(ev, calName = '') {
  if (ev.RRULE) return { skip: 'recurring' };
  const summary = unesc(ev.SUMMARY?.value);
  if (!summary) return { skip: 'empty' };
  const start = parseDate(ev.DTSTART);
  if (!start) return { skip: 'date' };
  const endRaw = parseDate(ev.DTEND);
  const allDay = ev.DTSTART.params.VALUE === 'DATE' || !/T/.test(ev.DTSTART.value);
  const extra = [unesc(ev.DESCRIPTION?.value), unesc(ev.LOCATION?.value), unesc(ev.CATEGORIES?.value)].join(' ');
  if (EXCLUDE.test(summary)) return { skip: 'class' };

  const code = courseCode(summary) || courseCode(extra) || courseCode(calName);
  const title = summary.replace(/\b\d{6}_[A-Z0-9_]+:?\s*/gi, '').trim().slice(0, 200) || summary.slice(0, 200);
  // الموعد: نهاية الحدث للأحداث المؤقتة، وآخر اليوم للأحداث اليومية
  const due = allDay ? start : Math.max(start, endRaw ?? start);
  return {
    uid: unesc(ev.UID?.value) || crypto.createHash('sha1').update(summary + start).digest('hex'),
    due,
    type: guessType(summary + ' ' + extra),
    subject: code || (calName ? calName.slice(0, 60) : title.slice(0, 60)),
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

// نوع التقويم من الرابط
export const kindOf = url => /(^|\.)google\.com$/i.test(new URL(url).hostname) ? 'gc' : 'bb';
export const LABELS = { bb: 'Blackboard', gc: 'Classroom' };

// ---------- المزامنة لرابط واحد ----------
export async function syncLink(email, link) {
  const res = await fetch(link.url, {
    headers: { 'user-agent': 'Thakkirni/1.0 (+calendar sync)', accept: 'text/calendar,*/*' },
    redirect: 'follow',
    signal: AbortSignal.timeout(8000)
  });
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  const text = (await res.text()).slice(0, 3_000_000);
  if (!text.includes('BEGIN:VCALENDAR')) throw new Error('NOT_ICS');

  const now = Date.now();
  const { events, calName } = parseCalendar(text);
  const skipped = { past: 0, recurring: 0, class: 0, other: 0 };
  const items = [];
  for (const ev of events) {
    const it = toItem(ev, calName);
    if (it.skip) { skipped[it.skip in skipped ? it.skip : 'other']++; continue; }
    if (it.due < now - DAY || it.due > now + 150 * DAY) { skipped.past++; continue; }
    items.push(it);
    if (items.length >= 300) break;
  }

  const kind = link.kind || 'bb';
  const pre = kind === 'bb' ? '' : kind + ':'; // Blackboard بدون بادئة (متوافق مع الربط القديم)
  const st = store('tasks');
  const k = keyOf(email);
  const list = (await st.get(k, { type: 'json' })) || [];
  const byUid = new Map(list.filter(t => t.src === 'bb').map(t => [t.bbUid, t]));
  let added = 0, updated = 0;

  for (const it of items) {
    const uid = pre + it.uid;
    const ex = byUid.get(uid);
    if (ex) {
      if (ex.due !== it.due || ex.title !== it.title) {
        ex.due = it.due;
        ex.title = it.title;
        ex.e1 = ex.n1 = ex.n2 = false; // الموعد تغيّر → نذكّره من جديد
        updated++;
      }
    } else {
      list.push({
        id: kind + crypto.createHash('sha1').update(uid).digest('hex').slice(0, 16),
        type: it.type, subject: it.subject, title: it.title, due: it.due,
        remind: 1440, done: false, created: now, n1: false, n2: false, e1: false,
        note: '', grade: '', src: 'bb', cal: kind, bbUid: uid, hidden: false
      });
      added++;
    }
  }
  if (added || updated) await st.setJSON(k, list.slice(-500));
  return { added, updated, found: items.length, total: events.length, skipped };
}

// ---------- سجل الروابط ----------
export const bbStore = () => store('userdata');
export const bbKey = email => `${keyOf(email)}_bb`;

// يقرأ السجل (ويحوّل الشكل القديم: رابط واحد → قائمة روابط)
export async function readLinks(st, key) {
  const r = await st.get(key, { type: 'json' });
  if (!r) return [];
  if (Array.isArray(r.links)) return r.links;
  if (r.url) return [{ id: 'l1', kind: 'bb', url: r.url, linkedAt: r.linkedAt, lastSync: r.lastSync, result: r.result, error: r.error }];
  return [];
}

export function errorText(e) {
  const m = String(e?.message || e);
  if (m === 'NOT_ICS') return 'الرابط ما فيه تقويم. تأكد إنك نسخت الرابط الصحيح';
  if (m.startsWith('HTTP_4')) return 'الرابط مرفوض. يمكن انتهت صلاحيته، سوّ رابط جديد';
  if (m.includes('timeout') || m.includes('abort')) return 'التقويم تأخر في الرد، بنحاول مرة ثانية بعدين';
  return 'ما قدرنا نقرأ التقويم الحين، بنحاول مرة ثانية بعدين';
}
