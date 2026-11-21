// GET /api/file?id=...  → يفتح ملف من المكتبة
// الرابط فيه رقم عشوائي طويل، فما أحد يقدر يخمّنه.
// نخلي الـ CDN حق Netlify يحفظ نسخة، عشان ما تشتغل الدالة كل مرة
import { store } from '../lib/util.mjs';

export default async req => {
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!/^[a-f0-9]{24}$/.test(id)) return new Response('Not found', { status: 404 });

  const r = await store('files').getWithMetadata(id, { type: 'arrayBuffer' });
  if (!r?.data) return new Response('الملف انحذف', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });

  const m = r.metadata || {};
  const name = encodeURIComponent(m.name || 'file');
  return new Response(r.data, {
    headers: {
      'content-type': m.mime || 'application/octet-stream',
      'content-disposition': `inline; filename*=UTF-8''${name}`,
      'x-content-type-options': 'nosniff',
      'cache-control': 'public, max-age=86400',
      'netlify-cdn-cache-control': 'public, max-age=604800, durable'
    }
  });
};

export const config = { path: '/api/file' };
