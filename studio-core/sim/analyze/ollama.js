export const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
export const DEFAULT_MODEL = 'qwen2.5-coder:3b';
export const DEFAULT_FALLBACK_MODEL = 'llama3.2:3b';

function endpoint(baseUrl) {
  const withScheme = /^https?:\/\//i.test(baseUrl) ? baseUrl : `http://${baseUrl}`;
  return new URL('/api/chat', withScheme.endsWith('/') ? withScheme : `${withScheme}/`);
}

export function createOllamaClient({
  fetch: fetchImpl = globalThis.fetch,
  baseUrl = DEFAULT_OLLAMA_URL,
  model = DEFAULT_MODEL,
  fallbackModel = DEFAULT_FALLBACK_MODEL,
  timeoutMs = 120000
} = {}) {
  const models = [...new Set([model, fallbackModel].filter(Boolean))];
  return {
    async complete(prompt) {
      let lastError = null;
      for (let index = 0; index < models.length; index += 1) {
        const name = models[index];
        const response = await fetchImpl(endpoint(baseUrl), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            model: name,
            stream: false,
            format: 'json',
            messages: [
              { role: 'system', content: 'You propose config changes. Reply with JSON only.' },
              { role: 'user', content: prompt }
            ]
          }),
          signal: AbortSignal.timeout(timeoutMs)
        });
        if (response.status === 404 && index < models.length - 1) continue;
        if (!response.ok) {
          lastError = new Error(`ollama ${response.status} for ${name}`);
          throw lastError;
        }
        const body = await response.json();
        const content = body?.message?.content ?? '';
        return { model: body?.model || name, content };
      }
      throw lastError ?? new Error('ollama returned no model');
    }
  };
}
