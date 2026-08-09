// Model IDs verified against Groq's own docs rather than carried over: the
// previous VISION_MODEL (llama-3.2-11b-vision-preview) has been decommissioned,
// so every image upload was failing. qwen/qwen3.6-27b is the model Groq's
// vision docs currently document for image input.
const TEXT_MODEL = 'openai/gpt-oss-120b';
const VISION_MODEL = 'qwen/qwen3.6-27b';
// Code Mode's model used to be groq/compound for its agentic built-in code
// execution, but compound categorically rejects requests carrying custom
// tools (see the streamGroq comment near requestBody.tools) -- every
// create_file request in Code Mode 400'd the whole completion, not just the
// tool call. Reusing TEXT_MODEL instead: same model Standard mode already
// uses successfully with create_file, and Groq's own docs confirm gpt-oss-120b
// has native tool-calling support plus near-parity with o4-mini on reasoning
// and solid SWE-bench/coding results -- a real model swap, not a downgrade.
const CODE_FALLBACK_MODEL = TEXT_MODEL;
// Referenced only by the tools guard in streamGroq below -- kept as its own
// constant since it's no longer the same value as CODE_FALLBACK_MODEL.
const COMPOUND_MODEL = 'groq/compound';
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
${LANGUAGE_RULE} Sê direto e técnico, sem floreados.

Comporta-te como um engenheiro sénior a fazer manutenção a longo prazo, não como quem quer parecer inteligente:
- Percebe o problema real antes de responder. Se o pedido for ambíguo ou faltar contexto, pergunta em vez de assumir.
- Quando é um erro ou bug, aponta sempre a causa raiz, nunca só o sintoma -- e não sugiras um fix sem perceberes porque é que aconteceu.
- Escreve o mínimo de código que resolve o que foi pedido. Nada de abstrações, flags, validação ou tratamento de erros para cenários que não foram pedidos nem podem acontecer.
- Só escreves código quando pedido explicitamente. Quando escreveres, torna-o completo e executável, sem comentários óbvios -- só comentários que expliquem um "porquê" não óbvio (uma limitação escondida, um workaround, uma decisão que parece estranha à primeira vista).
- Prefere código parecido com o de um projeto open-source maduro: simples, direto, sem código que "cheira" a gerado por IA.
- Separa observações de recomendações -- diz claramente o que é facto ("isto está a fazer X") do que é sugestão tua ("sugiro mudar para Y, porque Z").
- Se não tiveres a certeza de algo, diz isso abertamente em vez de inventar uma resposta confiante.`;

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
    const { base64, mimeType, text } = body.attachment;
    if (typeof text === 'string') {
      if (text.length > MAX_ATTACHMENT_BYTES) throw new Error('Anexo inválido ou demasiado grande.');
    } else if (typeof base64 !== 'string' || (!['application/pdf'].includes(mimeType) && !mimeType.startsWith('image/')) || Math.ceil(base64.length * 0.75) > MAX_ATTACHMENT_BYTES) {
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
  // A text/code file (.c, .py, ...) is read client-side as plain text rather than
  // base64 -- it goes straight into the message as text, not through the
  // image_url/vision path below, since a vision model can't meaningfully accept
  // source code as an "image".
  const isTextAttachment = attachment && typeof attachment.text === 'string';
  const isImageAttachment = attachment && !isTextAttachment;
  if (isImageAttachment && !attachment.mimeType.startsWith('image/')) {
    throw new Error('O modo normal suporta apenas imagens. Usa o Modo Code para analisar PDFs.');
  }
  const last = messages.at(-1);
  const textWithFile = isTextAttachment
    ? `${last.content || `Analisa o ficheiro ${attachment.name}.`}\n\n[Ficheiro anexado: ${attachment.name} -- responde em texto sobre o conteúdo. Não uses a tool create_file só para devolveres este ficheiro sem alterações; usa-a apenas se o utilizador pedir explicitamente um ficheiro novo ou uma versão modificada.]\n\`\`\`\n${attachment.text}\n\`\`\``
    : last.content;
  const apiMessages = [
    { role: 'system', content: system },
    ...messages.slice(0, -1),
    {
      role: 'user',
      content: isImageAttachment
        ? [{ type: 'text', text: last.content || 'Analisa este ficheiro.' }, { type: 'image_url', image_url: { url: `data:${attachment.mimeType};base64,${attachment.base64}` } }]
        : textWithFile,
    },
  ];
  const model = isImageAttachment ? VISION_MODEL : textModel;
  const requestBody = { model, messages: apiMessages, temperature: 0.7, stream: true };
  // Not offered alongside an image attachment: the vision model is a separate,
  // narrower model from the one tools were designed against, and mixing
  // multimodal input with tool-calling is exactly the kind of combination
  // worth not assuming works rather than actually needing right now --
  // nothing today asks for both at once. A text attachment stays on the plain
  // text model, so it keeps tool-calling (create_file) available.
  //
  // Not offered to groq/compound either: Groq's own docs (console.groq.com/docs/compound)
  // state custom user-defined tools aren't supported by compound systems, only their
  // fixed built-in ones -- sending `tools` to it doesn't get ignored, it 400s the whole
  // request. Nothing currently routes here (Code Mode moved off compound to
  // CODE_FALLBACK_MODEL = TEXT_MODEL specifically over this), but the guard stays in
  // case compound is ever wired back in for something else.
  if (tools && !isImageAttachment && model !== COMPOUND_MODEL) requestBody.tools = tools;
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
    const webContext = results.length ? `\n\nResultados de pesquisa web:\n${results.map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.content}`).join('\n\n')}\n\nEstilo de resposta com pesquisa web:
- Sintetiza as fontes numa resposta direta e coerente -- não te limites a listá-las ou a parafrasear cada uma em separado.
- Cita a fonte logo a seguir à afirmação que ela suporta, com o número entre parênteses retos (ex: "X aconteceu em 2024 [1][3]."), não só no fim da resposta.
- Se as fontes discordarem entre si ou a informação estiver desatualizada, diz isso explicitamente em vez de escolheres uma versão silenciosamente.
- Para perguntas com várias partes, organiza a resposta em secções ou bullets em vez de um parágrafo único.
- Termina sempre com uma lista "Fontes" em Markdown (título + link) para as fontes efetivamente citadas.` : '';
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
