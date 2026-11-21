// POST /api/upload?code=IE200&sec=sum&title=...&name=file.pdf
// جسم الطلب = الملف نفسه (مو JSON). الصور تنضغط في المتصفح قبل الرفع
import crypto from 'node:crypto';
import { store, json, err, readToken, getSettings } from '../lib/util.mjs';
import { useQuota } from '../lib/ai.mjs';
import { track } from '../lib/stats.mjs';
import { lib, str, SECS, normCode, validCode, mask, uniOf, K, refreshCourse } from '../lib/library.mjs';

export const MAX_FILE = 4 * 1024 * 1024;   // 4 ميقا (حد Netlify للطلب تقريباً 6)
const MAX_IMAGE = 1.5 * 1024 * 1024;
const DAILY = 5;
const TYPES = {
  'application/pdf': 'file',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'file',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'file',
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image'
};

export default async req => {
  if (req.method !== 'POST') return err('Method not allowed', 405);
  const email = readToken(req);
  if (!email) return err('سجّل دخول من جديد', 401);

  const settings = await getSettings();
  if (settings.uploads === false) return err('رفع الملفات موقف مؤقتاً، تقدر تضيف رابط بداله 🔗', 503);

  const p = new URL(req.url).searchParams;
  const uni = await uniOf(email, p.get('uni'));
  if (!uni) return err('اختر جامعتك أول من صفحة حسابي', 409);
  const code = normCode(p.get('code'));
  if (!validCode(code)) return err('رمز المادة غير صحيح');
  const sec = SECS[p.get('sec')] ? p.get('sec') : 'sum';
  const title = str(p.get('title'), 120);
  if (!title) return err('اكتب عنوان للملف');

  const mime = (req.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const kind = TYPES[mime];
  if (!kind) return err('نوع الملف غير مدعوم. المسموح: PDF، Word، PowerPoint، صور');

  const len = Number(req.headers.get('content-length') || 0);
  const limit = kind === 'image' ? MAX_IMAGE : MAX_FILE;
  if (len > limit) return err(`الملف أكبر من ${kind === 'image' ? '1.5' : '4'} ميقا. ارفعه على قوقل درايف وحط الرابط 🔗`, 413);

  const st = lib();
  const courses = (await st.get(K.courses(uni), { type: 'json' })) || [];
  if (!courses.some(c => c.code === code)) return err('المادة مو موجودة', 404);
  const res = (await st.get(K.res(uni, code), { type: 'json' })) || [];
  if (res.length >= 400) return err('هالمادة ممتلئة', 409);

  if (!(await useQuota(email, 'upload', DAILY))) return err(`ترفع ${DAILY} ملفات باليوم بالكثير. جرّب بكرة أو حط رابط 🔗`, 429);

  const buf = await req.arrayBuffer();
  if (!buf.byteLength) return err('الملف فاضي');
  if (buf.byteLength > limit) return err('الملف كبير، ارفعه على قوقل درايف وحط الرابط 🔗', 413);

  const fid = crypto.randomBytes(12).toString('hex');
  const fname = str(p.get('name'), 120).replace(/[\\/"<>]/g, '') || 'file';
  await store('files').set(fid, buf, { metadata: { mime, name: fname, size: buf.byteLength, by: email } });

  res.push({ id: crypto.randomBytes(6).toString('hex'), sec, kind, title, fid, fname, size: buf.byteLength, mime, by: email, byName: mask(email), at: Date.now(), reports: [] });
  await st.setJSON(K.res(uni, code), res);
  await refreshCourse(st, uni, code);
  await track(email, 'upload');
  return json({ ok: true });
};

export const config = { path: '/api/upload' };
