const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function* streamClaude(
  apiKey: string,
  messages: AIMessage[],
  system: string,
  maxTokens = 1024,
): AsyncGenerator<string> {
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages, stream: true }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `API error ${res.status}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') return;
      try {
        const json = JSON.parse(data) as { type: string; delta?: { text?: string } };
        if (json.type === 'content_block_delta' && json.delta?.text) yield json.delta.text;
      } catch { /* skip malformed SSE lines */ }
    }
  }
}

export async function callClaude(
  apiKey: string,
  messages: AIMessage[],
  system: string,
  maxTokens = 2048,
): Promise<string> {
  let out = '';
  for await (const chunk of streamClaude(apiKey, messages, system, maxTokens)) out += chunk;
  return out;
}
