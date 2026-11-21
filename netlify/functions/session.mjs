// GET    /api/session → { email, admin, token }  يرجّع الجلسة من الكوكي ويجددها
// DELETE /api/session → تسجيل خروج (يمسح الكوكي)
import { json, err, readToken, signToken, isAdmin, sessionCookie, clearCookie } from '../lib/util.mjs';

export default async req => {
  if (req.method === 'DELETE') return json({ ok: true }, 200, { 'set-cookie': clearCookie });
  const email = readToken(req);
  if (!email) return err('ما فيه جلسة', 401);
  const token = signToken(email); // نمدد الصلاحية 180 يوم من اليوم
  return json({ email, admin: isAdmin(email), token }, 200, { 'set-cookie': sessionCookie(token) });
};

export const config = { path: '/api/session' };
