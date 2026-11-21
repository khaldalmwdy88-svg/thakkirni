// 👑 لوحة الأدمن — للأدمن فقط
// GET  /api/admin  → { users, days, settings, reports, prices, wa }
// POST /api/admin  { action: 'settings', uploads?, wa? }
import { store, json, err, readToken, isAdmin, env, getSettings } from '../lib/util.mjs';
import { dayKey } from '../lib/stats.mjs';
import { UNI_NAME } from '../lib/unis.mjs';
import { waConfigured } from '../lib/wa.mjs';

const DAYS = 30;

export default async req => {
  const email = readToken(req);
  if (!email) return err('سجّل دخول من جديد', 401);
  if (!isAdmin(email)) return err('غير مصرح', 403);

  if (req.method === 'POST') {
    let b;
    try { b = await req.json(); } catch { return err('طلب غير صالح'); }
    if (b.action !== 'settings') return err('طلب غير معروف');
    const s = await getSettings();
    if (b.uploads !== undefined) s.uploads = !!b.uploads;
    if (b.wa !== undefined) s.wa = !!b.wa;
    await store('settings').setJSON('site', s);
    return json({ settings: s });
  }

  const users = store('users');
  const tasks = store('tasks');
  const udata = store('userdata');
  const stats = store('stats');
  const { blobs } = await users.list();

  const rows = await Promise.all(blobs.map(async ({ key }) => {
    const [u, t, bb] = await Promise.all([
      users.get(key, { type: 'json' }),
      tasks.get(key, { type: 'json' }),
      udata.get(`${key}_bb`, { type: 'json' })
    ]);
    const x = u || {};
    const list = t || [];
    const mail = x.email || decodeURIComponent(key);
    return {
      email: mail,
      admin: isAdmin(mail),
      uni: x.uni || '',
      joined: x.joined || 0,
      last: x.last || 0,
      days: x.days || 0,                       // كم يوم دخل
      total: list.length,
      open: list.filter(y => !y.done && !y.hidden).length,
      n: x.n || {},                            // عدد العمليات (كويز، خطة، ...)
      wa: x.wa?.verified ? (x.wa.on ? 'on' : 'off') : '',
      bb: Array.isArray(bb?.links) ? bb.links.length : bb?.url ? 1 : 0
    };
  }));

  // آخر 30 يوم
  const now = Date.now();
  const dates = Array.from({ length: DAYS }, (_, i) => dayKey(now - (DAYS - 1 - i) * 864e5));
  const days = await Promise.all(dates.map(async d => {
    const [a, b] = await Promise.all([stats.get('d_' + d, { type: 'json' }), stats.get('ai_' + d, { type: 'json' })]);
    return { date: d, ...(a || {}), ...(b || {}) };
  }));

  const month = dayKey().slice(0, 7);
  const lib = store('library');
  const reports = ((await lib.get('reports', { type: 'json' })) || []).map(r => ({ ...r, uniName: UNI_NAME[r.uni] || r.uni }));

  return json({
    users: rows.sort((a, b) => (b.last || 0) - (a.last || 0)),
    unis: UNI_NAME,
    days,
    reports,
    settings: await getSettings(),
    wa: {
      configured: waConfigured(),
      month: (await stats.get('wa_' + month, { type: 'json' })) || 0,
      limit: Number(env('WA_MONTHLY_LIMIT')) || 500
    },
    // الأسعار بالدولار (تقديرية، تقدر تغيّرها من متغيرات Netlify)
    prices: {
      aiIn: Number(env('AI_PRICE_IN')) || 1,      // لكل مليون توكن داخل
      aiOut: Number(env('AI_PRICE_OUT')) || 5,    // لكل مليون توكن طالع
      wa: Number(env('WA_PRICE')) || 0.0123       // لكل رسالة تذكير
    }
  });
};

export const config = { path: '/api/admin' };
