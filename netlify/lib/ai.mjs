// الاتصال بـ Claude + حدود الاستخدام اليومية
import { store, keyOf, env, isAdmin } from './util.mjs';
import { aiUsage } from './stats.mjs';

export async function askClaude(system, user, maxTokens = 4000) {
  const key = env('ANTHROPIC_API_KEY');
  if (!key) throw new Error('NO_KEY');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: env('ANTHROPIC_MODEL') || 'claude-haiku-5-5',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }]
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('anthropic error', res.status, JSON.stringify(data));
    throw new Error('AI_FAIL');
  }
  await aiUsage(data.usage);
  return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
}

// يطلع أول كائن JSON من رد الذكاء الاصطناعي
export function extractJSON(s) {
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('BAD_JSON');
  return JSON.parse(s.slice(a, b + 1));
}

// يرجع true إذا المستخدم ما تعدى حده اليومي (والأدمن بدون حد)
export async function useQuota(email, kind, limit) {
  if (isAdmin(email)) return true;
  const st = store('usage');
  const day = new Date().toISOString().slice(0, 10);
  const k = `${keyOf(email)}_${day}`;
  const u = (await st.get(k, { type: 'json' })) || {};
  if ((u[kind] || 0) >= limit) return false;
  u[kind] = (u[kind] || 0) + 1;
  await st.setJSON(k, u);
  return true;
}

// يرسل طلب لـ Claude ويرجع الرد للمتصفح "أول بأول" (streaming)
// عشان ما ينقطع بسبب حد الـ 10 ثواني في Netlify
export async function streamClaude(system, content, maxTokens = 4000) {
  const key = env('ANTHROPIC_API_KEY');
  if (!key) return jsonError('ميزة الذكاء الاصطناعي غير مفعّلة في السيرفر', 500);

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: env('ANTHROPIC_MODEL') || 'claude-haiku-5-5',
      max_tokens: maxTokens,
      stream: true,
      system,
      messages: [{ role: 'user', content }]
    })
  }).catch(e => { console.error('fetch failed', e); return null; });

  if (!upstream || !upstream.ok) {
    const detail = upstream ? await upstream.text().catch(() => '') : '';
    console.error('anthropic error', upstream?.status, detail);
    return jsonError('ما قدرنا نوصل للذكاء الاصطناعي، جرّب مرة ثانية', 502);
  }

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      const usage = { input_tokens: 0, output_tokens: 0 };
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, i).trim();
            buf = buf.slice(i + 1);
            if (!line.startsWith('data:')) continue;
            try {
              const ev = JSON.parse(line.slice(5));
              if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
                controller.enqueue(enc.encode(ev.delta.text));
              } else if (ev.type === 'message_start') {
                usage.input_tokens = ev.message?.usage?.input_tokens || 0;
              } else if (ev.type === 'message_delta' && ev.usage) {
                usage.output_tokens = ev.usage.output_tokens || usage.output_tokens;
              }
            } catch { /* سطر ناقص */ }
          }
        }
      } catch (e) {
        console.error('stream error', e);
      }
      await aiUsage(usage);
      controller.close();
    }
  });

  return new Response(stream, {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
  });
}

const jsonError = (msg, status) => new Response(JSON.stringify({ error: msg }), {
  status, headers: { 'content-type': 'application/json; charset=utf-8' }
});
