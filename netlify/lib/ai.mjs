// الاتصال بـ Claude + حدود الاستخدام اليومية
import { store, keyOf, env, isAdmin } from './util.mjs';

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
