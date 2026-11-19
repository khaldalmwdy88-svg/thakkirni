// GET /api/admin  → { users } — للأدمن فقط
import { store, json, err, readToken, isAdmin } from '../lib/util.mjs';

export default async req => {
  const email = readToken(req);
  if (!email) return err('سجّل دخول من جديد', 401);
  if (!isAdmin(email)) return err('غير مصرح', 403);

  const users = store('users');
  const tasks = store('tasks');
  const { blobs } = await users.list();

  const rows = await Promise.all(blobs.map(async ({ key }) => {
    const u = (await users.get(key, { type: 'json' })) || {};
    const t = (await tasks.get(key, { type: 'json' })) || [];
    return {
      email: u.email || decodeURIComponent(key),
      joined: u.joined,
      last: u.last,
      total: t.length,
      open: t.filter(x => !x.done).length,
      admin: isAdmin(u.email || decodeURIComponent(key))
    };
  }));

  rows.sort((a, b) => (b.last || 0) - (a.last || 0));
  return json({ users: rows });
};

export const config = { path: '/api/admin' };
