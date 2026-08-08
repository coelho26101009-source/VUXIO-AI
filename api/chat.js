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
// Available in every mode (used to be Code/Web only, see the fileToolNote comment
// below for why that turned out wrong).
const TOOLS = [{
  type: 'function',
  function: {
    name: 'create_file',
    description: 'Creates a downloadable file and delivers it directly in the chat as a download link. Call this immediately once the file content is decided -- never describe manual steps (e.g. "open Notepad, paste this, save as x.txt") as a substitute for calling it. Use for generated code, a document, data, or any content meant to be saved rather than just read in the chat reply.',
    parameters: {
      type: 'object',
      properties: {
        filename: { type: 'string', description: 'File name including extension, e.g. script.py' },
        content: { type: 'string', description: 'The full file content' },
      },
      required: ['filename', 'content'],
    },
  },
}];

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

// Both prompts mirror the user's language instead of forcing PT-PT: a user typing in
// English was still getting Portuguese replies regardless of what they wrote.
const LANGUAGE_RULE = 'Responde sempre no mesmo idioma que o utilizador usar na mensagem mais recente (inglês, português, espanhol, etc. -- adapta-te automaticamente). Usa PT-PT apenas quando o idioma não for claro pelo contexto.';

const codePrompt = (userName) => `Tu és o VUXIO em modo PROGRAMADOR. Utilizador: ${userName}.
${LANGUAGE_RULE} Sê direto e técnico. Só escreves código quando o utilizador pedir explicitamente. Quando escreveres código, torna-o completo e executável. Aponta a causa raiz dos erros e pede esclarecimento quando a pergunta for ambígua.`;

const standardPrompt = (userName) => `Tu és o VUXIO, um assistente simpático criado pelo Simão. Utilizador: ${userName}. ${LANGUAGE_RULE} Tom caloroso e direto. Código só se pedido explicitamente. Mantém a resposta curta, salvo pedido de detalhe.`;

const parseBody = (body) => typeof body === 'string' ? JSON.parse(body) : body;

const THINK_OPEN = '<think>';
const THINK_CLOSE = '</think>';

/**
 * Hides a reasoning model's <think> scratchpad from the streamed reply.
 *
 * qwen/qwen3.6-27b (the vision model) narrates its reasoning in <think> blocks
 * before answering; the other models here do not. Without this the user watches
 * that scratchpad type itself out as if it were the answer.
 *
 * Stateful because the stream is chunked: a tag can be split across two SSE
 * chunks ("<thi" then "nk>"), so a regex applied per chunk misses it. Anything
 * that could still turn out to be the start of a tag is held back until the
 * next chunk proves otherwise, and flush() releases whatever is left over if
 * the stream ends mid-tag.
 */
const createThinkFilter = () => {
  let buffer = '';
  let thinking = false;

  const longestPartialTagSuffix = (text) => {
    const longest = Math.max(THINK_OPEN.length, THINK_CLOSE.length) - 1;
    for (let size = Math.min(longest, text.length); size > 0; size--) {
      const tail = text.slice(-size);
      if (THINK_OPEN.startsWith(tail) || THINK_CLOSE.startsWith(tail)) return size;
    }
    return 0;
  };

  return {
    push(chunk) {
      buffer += chunk;
      let visible = '';
      for (;;) {
        if (thinking) {
          const end = buffer.indexOf(THINK_CLOSE);
          if (end === -1) break;
          buffer = buffer.slice(end + THINK_CLOSE.length);
          thinking = false;
          continue;
        }
        const start = buffer.indexOf(THINK_OPEN);
        if (start === -1) break;
        visible += buffer.slice(0, start);
        buffer = buffer.slice(start + THINK_OPEN.length);
        thinking = true;
      }
      if (!thinking) {
        const hold = longestPartialTagSuffix(buffer);
        visible += buffer.slice(0, buffer.length - hold);
        buffer = buffer.slice(buffer.length - hold);
      }
      return visible;
    },
    // A stream that ends inside a <think> block has nothing to show; one that
    // ends on a partial tag should still show those characters rather than
    // silently swallow them.
    flush() {
      if (thinking) return '';
      const rest = buffer;
      buffer = '';
      return rest;
    },
  };
};

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

async function streamGroq({ messages, system, attachment, onChunk, onFile, signal, textModel = TEXT_MODEL, tools }) {
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
  const requestBody = { model: attachment ? VISION_MODEL : textModel, messages: apiMessages, temperature: 0.7, stream: true };
  // Not offered alongside an attachment: the vision model is a separate,
  // narrower model from the one tools were designed against, and mixing
  // multimodal input with tool-calling is exactly the kind of combination
  // worth not assuming works rather than actually needing right now --
  // nothing today asks for both at once.
  if (tools && !attachment) requestBody.tools = tools;
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify(requestBody), signal,
  });
  if (!response.ok || !response.body) throw new Error('Não foi possível contactar o modelo de IA.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const think = createThinkFilter();
  let buffer = '';
  // Streamed tool calls arrive as fragments keyed by index -- name in the
  // first fragment, arguments accumulated in pieces across many more -- so
  // nothing is usable until the stream actually ends.
  const toolCalls = {};
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ') || line.trim() === 'data: [DONE]') continue;
      try {
        const delta = JSON.parse(line.slice(6)).choices?.[0]?.delta ?? {};
        if (delta.content) onChunk(think.push(delta.content));
        for (const call of delta.tool_calls ?? []) {
          const slot = (toolCalls[call.index] ??= { name: '', arguments: '' });
          if (call.function?.name) slot.name = call.function.name;
          if (call.function?.arguments) slot.arguments += call.function.arguments;
        }
      } catch { /* ignore malformed SSE */ }
    }
  }
  onChunk(think.flush());
  for (const call of Object.values(toolCalls)) {
    if (call.name !== 'create_file' || !onFile) continue;
    try {
      const { filename, content } = JSON.parse(call.arguments);
      // A tool call with an empty filename or missing content is a malformed
      // call, not a real file -- skip it rather than hand the frontend
      // something it would try to save as a nameless, empty download.
      if (filename && content != null) onFile(filename, content);
    } catch { /* malformed tool-call arguments -- drop it, the reply text still sent */ }
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
    // Gemini used to be primary for Code Mode with a Groq fallback on failure; flipped
    // because Gemini was the unreliable link (model deprecations, unpredictable 404/5xx).
    // Groq direct for both modes now, code mode still gets its own model.
    //
    // create_file used to be gated to Code Mode / Web Mode only, on the assumption
    // Standard mode had no use for it. Real usage showed otherwise -- "create a
    // hello world c file" typed in plain Standard-mode chat got a code block and a
    // manual "open Notepad, paste this" walkthrough instead of a real file, twice,
    // even after asking again. Available in every mode now.
    const fileToolNote = '\n\nSe o utilizador pedir um ficheiro (para descarregar, guardar, ou "criar um ficheiro"), usa sempre a tool create_file assim que o conteúdo estiver definido -- mesmo que a mensagem seja curta como "create a file". Nunca expliques passos manuais (abrir o Bloco de Notas / Notepad, colar texto, guardar como) em vez de criares o ficheiro diretamente.';
    const system = (body.mode === 'code' ? codePrompt(body.userName || 'Utilizador') : standardPrompt(body.userName || 'Utilizador')) + webContext + fileToolNote;
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    if (results.length) sendEvent(res, 'sources', results.map(({ title, url }) => ({ title, url })));
    await streamGroq({
      messages: body.messages, system, attachment: body.attachment, signal: controller.signal,
      textModel: body.mode === 'code' ? CODE_FALLBACK_MODEL : TEXT_MODEL,
      tools: TOOLS,
      onChunk: (text) => text && sendEvent(res, 'chunk', text),
      onFile: (filename, content) => sendEvent(res, 'file', { filename, content }),
    });
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
