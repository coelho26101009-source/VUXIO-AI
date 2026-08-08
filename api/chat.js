// Model IDs verified against Groq's own docs rather than carried over: the
// previous VISION_MODEL (llama-3.2-11b-vision-preview) has been decommissioned,
// so every image upload was failing. qwen/qwen3.6-27b is the model Groq's
// vision docs currently document for image input.
const TEXT_MODEL = 'openai/gpt-oss-120b';
const VISION_MODEL = 'qwen/qwen3.6-27b';
// Code Mode's Groq fallback. compound is agentic (built-in code execution),
// which suits Code Mode better than the plain text model does.
const CODE_FALLBACK_MODEL = 'groq/compound';
// gemini-2.0-flash was shut down by Google; 2.5 Pro is their current model
// aimed at code and deep reasoning.
const CODE_MODEL = 'gemini-2.5-pro';
const MAX_MESSAGES = 31;
const MAX_MESSAGE_LENGTH = 12_000;
// Vercel's serverless request limit is 4.5 MB; leave room for JSON overhead.
const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;
const requests = new Map();

const sendEvent = (res, event, payload) => {
  res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
};

const clientIp = (req) => req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';

const isRateLimited = (ip) => {
  const now = Date.now();
  if (requests.size > 10_000) {
    for (const [key, entry] of requests) if (now > entry.resetAt) requests.delete(key);
  }
  const entry = requests.get(ip) ?? { count: 0, resetAt: now + 60_000 };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + 60_000;
  }
  entry.count += 1;
  requests.set(ip, entry);
  return entry.count > 15;
};

const codePrompt = (userName) => `Tu és o VUXIO em modo PROGRAMADOR. Utilizador: ${userName}.
Responde sempre em PT-PT, de forma direta e técnica. Só escreves código quando o utilizador pedir explicitamente. Quando escreveres código, torna-o completo e executável. Aponta a causa raiz dos erros e pede esclarecimento quando a pergunta for ambígua.`;

const standardPrompt = (userName) => `Tu és o VUXIO, um assistente simpático criado pelo Simão. Utilizador: ${userName}. Responde em PT-PT, num tom caloroso e direto. Código só se pedido explicitamente. Mantém a resposta curta, salvo pedido de detalhe.`;

const parseBody = (body) => typeof body === 'string' ? JSON.parse(body) : body;

const validate = (body) => {
  if (!body || !Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > MAX_MESSAGES) {
    throw new Error('Pedido inválido.');
  }
  if (!['standard', 'code'].includes(body.mode)) throw new Error('Modo inválido.');
  for (const message of body.messages) {
    if (!['user', 'assistant'].includes(message?.role) || typeof message.content !== 'string' || message.content.length > MAX_MESSAGE_LENGTH) {
      throw new Error('Mensagem inválida.');
    }
  }
  if (body.attachment) {
    const { base64, mimeType } = body.attachment;
    if (typeof base64 !== 'string' || (!['application/pdf'].includes(mimeType) && !mimeType.startsWith('image/')) || Math.ceil(base64.length * 0.75) > MAX_ATTACHMENT_BYTES) {
      throw new Error('Anexo inválido ou demasiado grande.');
    }
  }
};

const getWebContext = async (query) => {
  if (!process.env.TAVILY_API_KEY || !query) return [];
  // Tavily authenticates with a Bearer header; the api_key-in-body form this
  // used to send is no longer accepted, so every search failed the !ok check
  // below and Web Mode silently returned no sources at all.
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
    },
    body: JSON.stringify({ query, search_depth: 'basic', max_results: 5 }),
  });
  if (!response.ok) return [];
  const data = await response.json();
  return (data.results ?? []).slice(0, 5).map(({ title, url, content }) => ({ title, url, content }));
};

async function streamGroq({ messages, system, attachment, onChunk, signal, textModel = TEXT_MODEL }) {
  if (!process.env.GROQ_API_KEY) throw new Error('O serviço de IA não está configurado.');
  if (attachment && !attachment.mimeType.startsWith('image/')) {
    throw new Error('O modo normal suporta apenas imagens. Usa o Modo Code para analisar PDFs.');
  }
  const last = messages.at(-1);
  const apiMessages = [
    { role: 'system', content: system },
    ...messages.slice(0, -1),
    {
      role: 'user',
      content: attachment
        ? [{ type: 'text', text: last.content || 'Analisa este ficheiro.' }, { type: 'image_url', image_url: { url: `data:${attachment.mimeType};base64,${attachment.base64}` } }]
        : last.content,
    },
  ];
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({ model: attachment ? VISION_MODEL : textModel, messages: apiMessages, temperature: 0.7, stream: true }), signal,
  });
  if (!response.ok || !response.body) throw new Error('Não foi possível contactar o modelo de IA.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ') || line.trim() === 'data: [DONE]') continue;
      try { onChunk(JSON.parse(line.slice(6)).choices?.[0]?.delta?.content ?? ''); } catch { /* ignore malformed SSE */ }
    }
  }
}

async function streamGemini({ messages, system, attachment, onChunk, signal }) {
  const groqFallback = () => streamGroq({ messages, system, attachment, onChunk, signal, textModel: CODE_FALLBACK_MODEL });
  if (!process.env.GEMINI_API_KEY) return groqFallback();
  const last = messages.at(-1);
  const contents = messages.slice(0, -1).map((message) => ({ role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: message.content }] }));
  contents.push({
    role: 'user',
    parts: attachment
      ? [{ text: last.content || 'Analisa este ficheiro.' }, { inlineData: { mimeType: attachment.mimeType, data: attachment.base64 } }]
      : [{ text: last.content }],
  });
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${CODE_MODEL}:streamGenerateContent?key=${process.env.GEMINI_API_KEY}&alt=sse`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents, generationConfig: { temperature: 0.3 } }), signal,
  });
  // Any failure Groq could serve instead falls back, not just 429/5xx. A model
  // that Google has retired answers 404, and the old condition let that through
  // to the throw below -- so when gemini-2.0-flash was shut down, Code Mode
  // broke outright even though a healthy Groq key was sitting right there.
  // PDFs are the one thing Groq cannot take over, so they still surface.
  if (!response.ok && process.env.GROQ_API_KEY && (!attachment || attachment.mimeType.startsWith('image/'))) {
    return groqFallback();
  }
  if (!response.ok || !response.body) throw new Error('Não foi possível contactar o modelo de IA.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try { onChunk(JSON.parse(line.slice(6)).candidates?.[0]?.content?.parts?.[0]?.text ?? ''); } catch { /* ignore malformed SSE */ }
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  if (isRateLimited(clientIp(req))) return res.status(429).json({ error: 'Demasiados pedidos. Tenta novamente dentro de um minuto.' });
  try {
    const controller = new AbortController();
    res.on('close', () => controller.abort());
    const body = parseBody(req.body);
    validate(body);
    const latestMessage = body.messages.at(-1).content;
    const results = body.webMode ? await getWebContext(latestMessage) : [];
    const webContext = results.length ? `\n\nResultados de pesquisa web:\n${results.map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.content}`).join('\n\n')}\nUsa-os como contexto factual e inclui fontes em Markdown.` : '';
    const system = (body.mode === 'code' ? codePrompt(body.userName || 'Utilizador') : standardPrompt(body.userName || 'Utilizador')) + webContext;
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    if (results.length) sendEvent(res, 'sources', results.map(({ title, url }) => ({ title, url })));
    const stream = body.mode === 'code' ? streamGemini : streamGroq;
    await stream({ messages: body.messages, system, attachment: body.attachment, signal: controller.signal, onChunk: (text) => text && sendEvent(res, 'chunk', text) });
    sendEvent(res, 'done', null);
    res.end();
  } catch (error) {
    if (error?.name === 'AbortError') return res.end();
    if (res.headersSent) {
      sendEvent(res, 'error', error instanceof Error ? error.message : 'Ocorreu um erro inesperado.');
      return res.end();
    }
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Pedido inválido.' });
  }
}
