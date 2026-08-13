// Model IDs verified against Groq's own docs rather than carried over: the
// previous VISION_MODEL (llama-3.2-11b-vision-preview) has been decommissioned,
// so every image upload was failing. qwen/qwen3.6-27b is the model Groq's
// vision docs currently document for image input.
const TEXT_MODEL = 'openai/gpt-oss-120b';
const VISION_MODEL = 'qwen/qwen3.6-27b';
// Code Mode's model used to be groq/compound for its agentic built-in code
// execution, but compound categorically rejects requests carrying custom
// tools (see the streamCompletion comment near requestBody.tools) -- every
// create_file request in Code Mode 400'd the whole completion, not just the
// tool call. Reusing TEXT_MODEL instead: same model Standard mode already
// uses successfully with create_file, and Groq's own docs confirm gpt-oss-120b
// has native tool-calling support plus near-parity with o4-mini on reasoning
// and solid SWE-bench/coding results -- a real model swap, not a downgrade.
const CODE_FALLBACK_MODEL = TEXT_MODEL;
// Referenced only by the tools guard in streamCompletion below -- kept as its own
// constant since it's no longer the same value as CODE_FALLBACK_MODEL.
const COMPOUND_MODEL = 'groq/compound';

// Models a client can pick manually (plus 'auto') or that the Auto heuristic
// below can route to. groq/compound and groq/compound-mini are deliberately
// absent from both: they 400 on any request carrying custom tools, and
// create_file is offered in every mode (see the toolsForModel guard in
// streamCompletion).
//
// llama-3.1-8b-instant and llama-3.3-70b-versatile were removed here on
// 2026-08-13: Groq's deprecation page (console.groq.com/docs/deprecations)
// shuts both down on 2026-08-16, and names openai/gpt-oss-20b and
// openai/gpt-oss-120b respectively as the replacements -- which this file
// already used, so the lineup collapses to two text models rather than four.
// qwen/qwen3.6-27b is NOT added as a selectable text model despite being the
// other suggested replacement: Groq lists it as preview, and their docs say
// preview models are for evaluation only and may be discontinued. It stays
// confined to VISION_MODEL, where there is no production alternative.
const LIGHT_MODEL = 'openai/gpt-oss-20b';

// Verified against Google's own pricing page (ai.google.dev/gemini-api/docs/pricing,
// checked 2026-08-13, re-checked after an earlier gap was caught): its
// free-tier column reads "Free of charge" for gemini-2.5-pro, gemini-3.7-flash,
// gemini-3.6-flash, and gemini-3.5-flash-lite -- all four included below.
// gemini-3.1-pro-preview -- the model originally asked for as a "strong
// tier" pick -- is the one that's genuinely paid-only (that column reads
// "Not available" for it specifically, not "Free of charge"); the first pass
// wrongly generalized from that single preview model to "no free Gemini Pro
// exists" without separately checking the stable, non-preview 2.5-pro, which
// does have free access. gemini-2.5-flash and plain gemini-3.5-flash were
// considered too but dropped as near-duplicates of 3.6/3.7-flash once 2.5-pro
// covers the distinct "different generation" niche instead.
// Manual pick only, not part of autoStandardModel below -- Auto stays
// Groq-only so its routing heuristic doesn't need a cross-provider quality
// comparison nobody has asked for. Frontend tiering (Strong/Medium/Economy)
// lives in InputBar.tsx's MODEL_TIERS -- this list only needs to accept them.
const GEMINI_MODELS = ['gemini-2.5-pro', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'];

// Pulled from OpenRouter's own public catalog (openrouter.ai/api/v1/models,
// checked 2026-08-13, no key required to list) and filtered to entries with
// prompt AND completion pricing both 0. That endpoint returned 18 free
// entries; four are excluded here even though they're priced at 0 per token:
// google/lyria-3-pro-preview and google/lyria-3-clip-preview are music
// generation (billed per song/clip instead, per their own descriptions, so
// "free" only describes the token price, not real usage cost) --
// nvidia/nemotron-3.5-content-safety is a moderation classifier, not a chat
// model -- and openrouter/free is a router that "selects free models at
// random," which would make identityRule's "you are running on model X"
// untrue for whatever it silently picked. The other 14 are real text
// chat/reasoning/coding models and are listed here.
//
// Rate limits (openrouter.ai/docs/api-reference/limits, same check date):
// 20 requests/minute, and 50/day per account with no purchased credits ever
// (1000/day once $10+ has been purchased at any point) -- pooled across
// every :free model on the account, not per model. More choice here does not
// mean more total free requests.
const OPENROUTER_MODELS = [
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'poolside/laguna-s-2.1:free',
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b-a4b-it:free',
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
  'poolside/laguna-xs-2.1:free',
  'cohere/north-mini-code:free',
  'nvidia/nemotron-3-nano-30b-a3b:free',
  'nvidia/nemotron-3.5-lightning:free',
  'nvidia/nemotron-nano-12b-v2-vl:free',
  'nvidia/nemotron-nano-9b-v2:free',
  'liquid/lfm-2.5-2.6b:free',
  'openai/gpt-oss-20b:free',
];
const SELECTABLE_MODELS = ['auto', TEXT_MODEL, LIGHT_MODEL, ...GEMINI_MODELS, ...OPENROUTER_MODELS];

// Every OpenRouter free-tier id in the list above ends in ':free' -- checked
// first and specifically, because a prefix check alone is not safe here:
// OpenRouter's own 'openai/gpt-oss-20b:free' shares the exact 'openai/'
// namespace Groq's real openai/gpt-oss-120b and openai/gpt-oss-20b already
// use, and a naive startsWith('openai/') branch would misroute Groq's own
// models to OpenRouter's endpoint and key. ':free' never appears in a Groq
// or Gemini id, so it's an unambiguous signal.
const providerForModel = (model) => {
  if (model.endsWith(':free')) return 'openrouter';
  if (model.startsWith('gemini-')) return 'gemini';
  return 'groq';
};

// Available in every mode (used to be Code/Web only, see the fileToolNote comment
// below for why that turned out wrong).
const TOOLS = [{
  type: 'function',
  function: {
    name: 'create_file',
    description: 'Creates a downloadable file and delivers it in the chat as a download link. Use ONLY when the user\'s latest message actually asks for a file ("create a file", "make me an html", "give me that as a download"). When they do, call it immediately rather than describing manual steps like "open Notepad and paste this". Do NOT call it for greetings, thanks, small talk, or to resend a file already delivered. Always accompany the file with a short text reply saying what it is.',
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
// Never enforced server-side before -- a 200,000-char userName went straight
// into the system prompt. Firebase Auth's own Google displayName is nowhere
// near this long; 100 leaves room for any legitimate name.
const MAX_USER_NAME_LENGTH = 100;
// Vercel's serverless request limit is 4.5 MB; leave room for JSON overhead.
const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;
// Mirrors the caps enforced client-side when a memory is written -- checked
// again here because the client is not a trust boundary.
const MAX_MEMORIES = 20;
const MAX_MEMORY_LENGTH = 500;
// Each configured server gets discovered on every chat turn (nothing here can
// cache across invocations -- see discoverMcpTools), so this also bounds
// worst-case added latency per turn, not just prompt size.
const MAX_MCP_SERVERS = 5;
const MAX_MCP_URL_LENGTH = 500;
const MAX_MCP_NAME_LENGTH = 100;
// Groq keys are "gsk_" + a fixed-length token, well under 100 chars -- this
// just bounds an obviously-wrong paste before it goes out as an Authorization
// header, not a format check (Groq's own API is what actually rejects a bad key).
const MAX_GROQ_API_KEY_LENGTH = 200;
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

// Without this, asked "que modelo és", the model guesses from its own training
// data and answers things like "GPT-4-turbo" -- a hallucination, since it has
// no built-in awareness of which model or provider is actually serving it here.
// Takes the model actually resolved for this request (see pickTextModel and the
// handler) instead of a hardcoded constant: Auto routing and a manual
// selectedModel can both send Groq a model other than TEXT_MODEL, and a
// hardcoded name here would restate the exact hallucination this rule exists
// to prevent, just from the prompt instead of the model's training data.
// `provider` is the same value the handler computed via providerForModel (or
// forced to 'groq' for an image attachment) -- passed in rather than
// re-derived, since forcing VISION_MODEL for images already lives there.
// Not a fixed list of "forbidden" names either, now that Gemini can be the
// real answer: naming specific brands as always-wrong stopped being true.
const PROVIDER_DISPLAY_NAMES = { groq: 'Groq', gemini: 'Google (Gemini API)', openrouter: 'OpenRouter' };
const identityRule = (model, provider) => `Corres no modelo ${model}, servido pela ${PROVIDER_DISPLAY_NAMES[provider]}. Pedidos com imagem anexada usam ${VISION_MODEL}, servido pela Groq, para visão -- mesmo que o modelo de texto escolhido seja outro. Nunca inventes um nome de modelo ou fornecedor diferente do indicado aqui -- se te perguntarem sobre o teu funcionamento interno e não tiveres a certeza de algo, diz isso abertamente em vez de inventar uma resposta.`;

const codePrompt = (userName, model, provider) => `Tu és o VUXIO em modo PROGRAMADOR. Utilizador: ${userName}.
${LANGUAGE_RULE} ${identityRule(model, provider)} Sê direto e técnico, sem floreados.

Comporta-te como um engenheiro sénior a fazer manutenção a longo prazo, não como quem quer parecer inteligente:
- Percebe o problema real antes de responder. Se o pedido for ambíguo ou faltar contexto, pergunta em vez de assumir.
- Quando é um erro ou bug, aponta sempre a causa raiz, nunca só o sintoma -- e não sugiras um fix sem perceberes porque é que aconteceu.
- Escreve o mínimo de código que resolve o que foi pedido. Nada de abstrações, flags, validação ou tratamento de erros para cenários que não foram pedidos nem podem acontecer.
- Só escreves código quando pedido explicitamente. Quando escreveres, torna-o completo e executável, sem comentários óbvios -- só comentários que expliquem um "porquê" não óbvio (uma limitação escondida, um workaround, uma decisão que parece estranha à primeira vista).
- Prefere código parecido com o de um projeto open-source maduro: simples, direto, sem código que "cheira" a gerado por IA.
- Separa observações de recomendações -- diz claramente o que é facto ("isto está a fazer X") do que é sugestão tua ("sugiro mudar para Y, porque Z").
- Se não tiveres a certeza de algo, diz isso abertamente em vez de inventar uma resposta confiante.`;

const standardPrompt = (userName, model, provider) => `Tu és o VUXIO, um assistente simpático criado pelo Simão. Utilizador: ${userName}. ${LANGUAGE_RULE} ${identityRule(model, provider)} Tom caloroso e direto. Código só se pedido explicitamente. Mantém a resposta curta, salvo pedido de detalhe.`;

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

// SSRF guard for MCP server URLs. `handler` has no auth, only a per-IP rate
// limit, and fetches whatever URL the client supplies -- so this rejects
// anything that could be used to probe the deployment's own network:
// non-https, loopback/private/link-local IP literals, and a few well-known
// internal hostnames. `new URL` already canonicalizes IPv4 obfuscation
// tricks (decimal, hex, octal, short forms all become dotted-decimal) and
// lowercases the hostname, so the checks below only need to compare against
// the plain forms.
//
// This only catches literal addresses written directly in the URL. It
// cannot catch a public hostname that *resolves* to a private IP at connect
// time (DNS rebinding): fetch() resolves and connects in one step, with no
// hook to inspect the resolved address first.
const isBlockedMcpUrl = (urlString) => {
  let url;
  try {
    url = new URL(urlString);
  } catch {
    return true;
  }
  if (url.protocol !== 'https:') return true;
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host === 'metadata.google.internal' || host === '0.0.0.0') {
    return true;
  }
  if (host.startsWith('[') && host.endsWith(']')) {
    const ip = host.slice(1, -1);
    if (ip === '::1' || ip === '::') return true;
    const firstGroup = parseInt(ip.split(':')[0], 16) || 0;
    return (firstGroup >= 0xfc00 && firstGroup <= 0xfdff) // fc00::/7, unique local
      || (firstGroup >= 0xfe80 && firstGroup <= 0xfebf); // fe80::/10, link-local
  }
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (!ipv4) return false;
  const a = Number(ipv4[1]);
  const b = Number(ipv4[2]);
  return a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
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
  if (body.userName !== undefined && (typeof body.userName !== 'string' || body.userName.length > MAX_USER_NAME_LENGTH)) {
    throw new Error('Nome de utilizador inválido.');
  }
  if (body.attachment) {
    const { base64, mimeType, text } = body.attachment;
    if (typeof text === 'string') {
      if (text.length > MAX_ATTACHMENT_BYTES) throw new Error('Anexo inválido ou demasiado grande.');
    } else if (
      typeof base64 !== 'string'
      || typeof mimeType !== 'string'
      || (!['application/pdf'].includes(mimeType) && !mimeType.startsWith('image/'))
      || Math.ceil(base64.length * 0.75) > MAX_ATTACHMENT_BYTES
    ) {
      throw new Error('Anexo inválido ou demasiado grande.');
    }
  }
  if (body.temperature !== undefined && (typeof body.temperature !== 'number' || !Number.isFinite(body.temperature) || body.temperature < 0 || body.temperature > 2)) {
    throw new Error('Temperatura inválida.');
  }
  if (body.researchMode !== undefined && typeof body.researchMode !== 'boolean') {
    throw new Error('Modo de investigação inválido.');
  }
  if (body.locale !== undefined && !['pt', 'en'].includes(body.locale)) {
    throw new Error('Idioma inválido.');
  }
  if (body.selectedModel !== undefined && !SELECTABLE_MODELS.includes(body.selectedModel)) {
    throw new Error('Modelo inválido.');
  }
  if (body.groqApiKey !== undefined && (typeof body.groqApiKey !== 'string' || body.groqApiKey.length > MAX_GROQ_API_KEY_LENGTH)) {
    throw new Error('Chave da API inválida.');
  }
  if (body.memories !== undefined) {
    if (!Array.isArray(body.memories) || body.memories.length > MAX_MEMORIES) throw new Error('Memórias inválidas.');
    for (const memory of body.memories) {
      if (typeof memory !== 'string' || memory.length === 0 || memory.length > MAX_MEMORY_LENGTH) throw new Error('Memórias inválidas.');
    }
  }
  if (body.mcpServers !== undefined) {
    if (!Array.isArray(body.mcpServers) || body.mcpServers.length > MAX_MCP_SERVERS) throw new Error('Servidores MCP inválidos.');
    for (const server of body.mcpServers) {
      if (!server || typeof server.url !== 'string' || server.url.length > MAX_MCP_URL_LENGTH || isBlockedMcpUrl(server.url)) {
        throw new Error('Servidores MCP inválidos.');
      }
      if (server.name !== undefined && (typeof server.name !== 'string' || server.name.length > MAX_MCP_NAME_LENGTH)) {
        throw new Error('Servidores MCP inválidos.');
      }
    }
  }
};

const tavilySearch = async ({ query, depth = 'basic', maxResults = 5, signal }) => {
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
    body: JSON.stringify({ query, search_depth: depth, max_results: maxResults }),
    signal,
  });
  if (!response.ok) return [];
  const data = await response.json();
  return (data.results ?? []).slice(0, maxResults).map(({ title, url, content }) => ({ title, url, content }));
};

const getWebContext = (query) => tavilySearch({ query, depth: 'basic', maxResults: 5 });

// --- Research mode ------------------------------------------------------
//
// SIMPLIFICATION: one planning pass -> one parallel batch of searches -> one
// synthesis. Not an iterative agent loop (search, read, re-plan, search
// again), because vercel.json caps this function at 60s and a second search
// round does not fit alongside a long synthesis. Timing budget at the time of
// writing: planning ~2-4s, parallel advanced searches ~6-12s, synthesis
// ~25-40s. If the cap is ever raised, the upgrade is to loop steps 2-3 with
// the model choosing follow-up queries; nothing in the SSE contract changes.
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
// Verified against Google's own docs (ai.google.dev/gemini-api/docs/openai,
// checked 2026-08-13): this endpoint accepts the same request shape Groq
// does (model/messages/stream/tools/temperature), the same Bearer auth, and
// the same OpenAI-style SSE delta chunks -- runCompletion below is shared
// between both providers rather than needing a second parser. Not
// live-verified against a real Gemini key from this environment though
// (no key available here); DOCUMENTED, not OBSERVED. Worth a real smoke
// test after deploying, particularly the streamed tool_calls shape.
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
// Verified against OpenRouter's own docs (openrouter.ai/docs/api-reference/chat-completion,
// checked 2026-08-13): OpenAI-compatible request/response shape, Bearer auth,
// SSE streaming with the same [DONE] terminator and delta.tool_calls shape
// Groq/Gemini already use -- same runCompletion path, no new parser. Also
// not live-verified against a real key from this environment; DOCUMENTED,
// not OBSERVED, same caveat as GEMINI_URL above.
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Verified against Groq's own docs (console.groq.com/docs/rate-limits,
// checked 2026-08-13): every completion response carries these headers.
// limit/remaining-requests are Requests Per Day (the "daily limit" a user
// actually cares about); limit/remaining-tokens are Tokens Per Minute.
// Reset values are Go-style durations ("2m59.56s", "23h1m2s"), not plain
// seconds -- parseGroqResetDuration below converts them.
const parseGroqResetDuration = (value) => {
  if (!value) return undefined;
  const match = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:([\d.]+)s)?$/);
  if (!match) return undefined;
  const [, h, m, s] = match;
  return (Number(h || 0) * 3600) + (Number(m || 0) * 60) + Number(s || 0);
};

const numberHeader = (headers, name) => {
  const value = headers.get(name);
  return value !== null ? Number(value) : undefined;
};

const parseGroqLimits = (headers) => {
  const limitRequests = numberHeader(headers, 'x-ratelimit-limit-requests');
  const limitTokens = numberHeader(headers, 'x-ratelimit-limit-tokens');
  if (limitRequests === undefined && limitTokens === undefined) return null;
  return {
    limitRequests,
    remainingRequests: numberHeader(headers, 'x-ratelimit-remaining-requests'),
    resetRequestsSeconds: parseGroqResetDuration(headers.get('x-ratelimit-reset-requests')),
    limitTokens,
    remainingTokens: numberHeader(headers, 'x-ratelimit-remaining-tokens'),
    resetTokensSeconds: parseGroqResetDuration(headers.get('x-ratelimit-reset-tokens')),
  };
};

const RESEARCH_MAX_QUERIES = 6;
const RESEARCH_RESULTS_PER_QUERY = 5;
// The planner only emits a short JSON array, so it wants the fastest model
// available rather than the smartest -- LIGHT_MODEL is the quickest Groq
// still serves in production (1000 T/s at the time of writing).
const RESEARCH_PLANNER_MODEL = LIGHT_MODEL;

/** Break the question into focused sub-queries. Falls back to the question
 *  itself -- a planning failure must degrade to a shallower search, never to
 *  no search at all. */
const planResearch = async (question, signal, apiKey) => {
  const fallback = [question];
  try {
    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      signal,
      body: JSON.stringify({
        model: RESEARCH_PLANNER_MODEL,
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `Planeias investigação. Devolve APENAS JSON: {"queries": ["...", "..."]}.
Regras:
- Entre 4 e ${RESEARCH_MAX_QUERIES} queries de pesquisa, cada uma cobrindo um ângulo DIFERENTE do tema (definição, estado atual, dados/números, críticas, comparações, futuro).
- Escreve as queries no idioma com maior probabilidade de ter boas fontes sobre o tema.
- Queries curtas e específicas, como se escrevesse num motor de busca. Sem numeração, sem explicações.`,
          },
          { role: 'user', content: question },
        ],
      }),
    });
    if (!response.ok) return fallback;
    const data = await response.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
    const queries = (parsed.queries ?? [])
      .filter((q) => typeof q === 'string' && q.trim())
      .map((q) => q.trim())
      .slice(0, RESEARCH_MAX_QUERIES);
    return queries.length ? queries : fallback;
  } catch {
    return fallback;
  }
};

/** Run every sub-query in parallel and merge into one deduplicated source
 *  list. Parallel because the 60s budget is wall clock -- sequential searches
 *  would multiply latency by the number of queries. */
const runResearchSearches = async (queries, signal) => {
  const batches = await Promise.all(
    queries.map((query) =>
      tavilySearch({ query, depth: 'advanced', maxResults: RESEARCH_RESULTS_PER_QUERY, signal })
        .catch(() => []),
    ),
  );
  const byUrl = new Map();
  batches.flat().forEach((result) => {
    if (result?.url && !byUrl.has(result.url)) byUrl.set(result.url, result);
  });
  return [...byUrl.values()];
};

const researchContext = (queries, results) => `

MODO INVESTIGAÇÃO -- escreves um relatório de investigação, não uma resposta de chat.

Ângulos pesquisados:
${queries.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Fontes recolhidas (${results.length}):
${results.map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.content}`).join('\n\n')}

FORMATO OBRIGATÓRIO DO RELATÓRIO (Markdown):
- Começa com "# " e um título do relatório.
- "## Resumo" -- 3 a 5 bullets com as conclusões principais, cada um com a sua citação.
- Depois secções "## " temáticas que cubram os ângulos acima. Usa "### " para subsecções quando fizer sentido.
- "## Limitações" -- o que as fontes NÃO respondem, contradições entre elas, e informação possivelmente desatualizada. Esta secção é obrigatória e nunca pode dizer apenas "nenhuma".
- "## Fontes" -- lista Markdown numerada, título + link, apenas das fontes que citaste.

REGRAS:
- Cita com [n] imediatamente a seguir à afirmação que a fonte suporta, não só no fim.
- Não inventes factos, números ou datas que não estejam nas fontes. Se algo for inferência tua, escreve que é inferência.
- Se as fontes discordarem, apresenta as duas versões e diz qual é mais bem suportada e porquê.
- Relatório extenso e detalhado -- é o objetivo do modo. Prefere profundidade a brevidade.
- Não uses a tool create_file neste modo.`;

// --- MCP (remote HTTP servers only) -------------------------------------
//
// A browser can't spawn a stdio subprocess and this function is a fresh,
// stateless invocation per chat turn -- so only the remote "Streamable HTTP"
// MCP transport is reachable here. Every server gets re-initialized on every
// chat turn (nothing survives between invocations to reuse a session), which
// is the honest cost of running an MCP client inside a serverless function
// rather than a long-lived process.
const MCP_TIMEOUT_MS = 8_000;
const MAX_MCP_TOOLS_PER_SERVER = 20;
const MAX_TOOL_ROUNDS = 3;

// OpenAI/Groq function names are capped at 64 chars. "mcp" + a single-digit
// server index (MAX_MCP_SERVERS caps it at 5, so index is always one digit)
// + "_" is 5 chars, leaving this many for the sanitized tool name -- no
// need to truncate anywhere near as aggressively as before.
const MAX_MCP_TOOL_NAME_PART = 59;
const sanitizeToolNamePart = (name) => String(name || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, MAX_MCP_TOOL_NAME_PART);

// Two different tool names can still share a 59-char sanitized prefix and
// collide. `mcpToolsByName` is built with Object.fromEntries (last-wins), so
// a silent collision means the model asks for one tool and the server runs
// whichever definition happened to load second. Disambiguate with a numeric
// suffix instead.
const uniqueToolName = (index, originalName, usedNames) => {
  const base = sanitizeToolNamePart(originalName);
  let candidate = base;
  for (let n = 2; usedNames.has(candidate); n++) {
    const suffix = `_${n}`;
    candidate = base.slice(0, MAX_MCP_TOOL_NAME_PART - suffix.length) + suffix;
  }
  usedNames.add(candidate);
  return `mcp${index}_${candidate}`;
};

// Groq requires `parameters` to be a JSON Schema object (`{ type: 'object',
// ... }`); `inputSchema: []` passes the old `typeof === 'object'` check
// (arrays are objects) and reaches Groq as-is, which rejects the whole
// completion. A schema that's technically valid but huge is also a problem
// nobody asked for: it inflates the deployer's Groq bill on every turn, for
// any anonymous caller, across every tool of every configured server.
const MAX_MCP_PARAMETERS_BYTES = 4_000;
const isUsableMcpSchema = (schema) => (
  schema !== null && typeof schema === 'object' && !Array.isArray(schema) && schema.type === 'object'
  && JSON.stringify(schema).length <= MAX_MCP_PARAMETERS_BYTES
);

const parseJsonRpcMessage = (contentType, bodyText) => {
  if (!contentType.includes('text/event-stream')) return JSON.parse(bodyText);
  // Streamable HTTP transport allows an SSE response instead of a single JSON
  // body (e.g. for servers that stream progress before the real result) --
  // the JSON-RPC reply is whichever frame carries a result or error.
  for (const line of bodyText.split('\n')) {
    // The SSE spec makes the space after the colon optional ("data:{...}" is
    // as valid as "data: {...}") -- JSON.parse tolerates the leading space
    // either way, so slicing past just the field name is enough.
    if (!line.startsWith('data:')) continue;
    const message = JSON.parse(line.slice(5));
    if ('result' in message || 'error' in message) return message;
  }
  throw new Error('Resposta MCP sem resultado.');
};

async function mcpSend(url, message, sessionId, signal) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };
  if (sessionId) headers['Mcp-Session-Id'] = sessionId;
  const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(message), signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return { response, sessionId: response.headers.get('mcp-session-id') ?? sessionId };
}

async function mcpRequest(url, method, params, sessionId, signal) {
  const { response, sessionId: nextSessionId } = await mcpSend(url, { jsonrpc: '2.0', id: crypto.randomUUID(), method, params }, sessionId, signal);
  const message = parseJsonRpcMessage(response.headers.get('content-type') ?? '', await response.text());
  if (message.error) throw new Error(message.error.message || 'Erro no servidor MCP.');
  return { result: message.result, sessionId: nextSessionId };
}

// Fire-and-forget: notifications carry no id and get no JSON-RPC reply to
// wait for. A server that rejects or ignores this still gets the tools/list
// call right after -- that call's own failure is what actually marks a
// server unavailable, not this one.
async function mcpNotify(url, method, sessionId, signal) {
  await mcpSend(url, { jsonrpc: '2.0', method, params: {} }, sessionId, signal).catch(() => {});
}

// One failing/slow/non-compliant server must never take down the whole
// request -- every failure path here resolves to an empty tool list for that
// server instead of throwing.
async function discoverMcpServer(server, index) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MCP_TIMEOUT_MS);
  try {
    const init = await mcpRequest(server.url, 'initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'vuxio', version: '1.0.0' },
    }, undefined, controller.signal);
    await mcpNotify(server.url, 'notifications/initialized', init.sessionId, controller.signal);
    const list = await mcpRequest(server.url, 'tools/list', {}, init.sessionId, controller.signal);
    const tools = Array.isArray(list.result?.tools) ? list.result.tools.slice(0, MAX_MCP_TOOLS_PER_SERVER) : [];
    // Namespaced by server index, not server name/id, so a name a client
    // sent can't collide with create_file or produce an invalid function
    // name -- indices are always unique and always safe characters. The
    // sanitized part of the tool's own name is not guaranteed unique though
    // (see uniqueToolName), so track what this server has already produced.
    const usedNames = new Set();
    return tools.map((tool) => {
      const name = uniqueToolName(index, tool.name, usedNames);
      return {
        name,
        originalName: tool.name,
        server,
        sessionId: list.sessionId,
        definition: {
          type: 'function',
          function: {
            name,
            description: `[${server.name || 'MCP'}] ${String(tool.description || tool.name || '').slice(0, 300)}`,
            parameters: isUsableMcpSchema(tool.inputSchema) ? tool.inputSchema : { type: 'object', properties: {} },
          },
        },
      };
    });
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function discoverMcpTools(servers) {
  const results = await Promise.all(servers.map((server, index) => discoverMcpServer(server, index)));
  return results.flat();
}

async function callMcpTool(tool, args) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MCP_TIMEOUT_MS);
  try {
    const { result } = await mcpRequest(tool.server.url, 'tools/call', { name: tool.originalName, arguments: args }, tool.sessionId, controller.signal);
    const text = Array.isArray(result?.content)
      ? result.content.filter((part) => part?.type === 'text').map((part) => part.text).join('\n')
      : JSON.stringify(result ?? {});
    return result?.isError ? `Erro: ${text || 'a ferramenta reportou um erro.'}` : (text || 'OK.');
  } catch {
    return 'Esta ferramenta está indisponível de momento.';
  } finally {
    clearTimeout(timer);
  }
}

async function streamCompletion({ messages, system, attachment, onChunk, onFile, onModel, signal, textModel = TEXT_MODEL, tools, temperature = 0.7, mcpToolsByName = {}, apiKey, onLimits, baseUrl = GROQ_URL }) {
  if (!apiKey) throw new Error('O serviço de IA não está configurado.');
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
  // Fired only once the request has passed every check above that can still
  // reject it outright (missing key, image attachment that isn't actually an
  // image) -- announcing the model any earlier, e.g. in the handler before
  // streamCompletion runs, sent a real model name over SSE for a request about to
  // fail anyway (a PDF attachment in Standard mode), immediately followed by
  // event: error.
  onModel?.(model);
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
  const toolsForModel = tools && !isImageAttachment && model !== COMPOUND_MODEL ? tools : undefined;

  const hasMcpTools = Object.keys(mcpToolsByName).length > 0;

  // Bounded agentic loop: a tool call is useless to the user unless its result
  // goes back to the model for a real answer, so an MCP tool call triggers a
  // follow-up completion with the result appended as a `tool` message. Capped
  // at MAX_TOOL_ROUNDS so a model that keeps calling tools without ever
  // answering can't run past the function's time budget.
  for (let round = 0; ; round++) {
    // The final round must not offer tools -- otherwise a model that keeps
    // calling tools instead of answering hits MAX_TOOL_ROUNDS having streamed
    // no content at all, and the user gets a blank reply.
    const roundTools = round < MAX_TOOL_ROUNDS ? toolsForModel : undefined;
    let streamedThisRound = false;
    const guardedOnChunk = (text) => {
      if (text) streamedThisRound = true;
      onChunk(text);
    };
    let completion;
    try {
      completion = await runCompletion(apiMessages, { model, temperature, tools: roundTools, signal, onChunk: guardedOnChunk, apiKey, onLimits, baseUrl });
    } catch (err) {
      // A malformed tool schema can still make Groq reject the whole
      // completion before any content streams, despite the coercion in
      // discoverMcpServer -- retrying once without tools still gets the user
      // a text answer instead of only an `event: error`. Not retried if
      // content already streamed this round (a mid-stream network failure,
      // not a rejected request): retrying then would re-send a second answer
      // on top of whatever the user already saw. Also not retried without
      // MCP tools in play -- a plain create_file failure is very likely a
      // real outage (bad key, Groq down), where retrying just doubles the
      // latency before the same error.
      if (!roundTools || !hasMcpTools || streamedThisRound) throw err;
      completion = await runCompletion(apiMessages, { model, temperature, tools: undefined, signal, onChunk, apiKey, onLimits, baseUrl });
    }
    const { content, toolCalls } = completion;

    for (const call of toolCalls) {
      if (call.name !== 'create_file' || !onFile) continue;
      try {
        const { filename, content: fileContent } = JSON.parse(call.arguments);
        // A tool call with an empty filename or missing content is a malformed
        // call, not a real file -- skip it rather than hand the frontend
        // something it would try to save as a nameless, empty download.
        if (filename && fileContent != null) onFile(filename, fileContent);
      } catch { /* malformed tool-call arguments -- drop it, the reply text still sent */ }
    }

    const mcpCalls = toolCalls.filter((call) => mcpToolsByName[call.name]);
    if (mcpCalls.length === 0 || round >= MAX_TOOL_ROUNDS) break;

    apiMessages.push({
      role: 'assistant',
      content: content || null,
      tool_calls: toolCalls.map((call) => ({ id: call.id, type: 'function', function: { name: call.name, arguments: call.arguments || '{}' } })),
    });
    const results = await Promise.all(toolCalls.map((call) => {
      const tool = mcpToolsByName[call.name];
      // create_file has no result to report back -- it was already handled as
      // a side effect above. It still needs a `tool` message here though: the
      // API rejects a follow-up request that's missing a result for any
      // tool_call_id the assistant message declared.
      if (!tool) return 'OK.';
      let args = {};
      try { args = JSON.parse(call.arguments || '{}'); } catch { /* malformed args -- call with {} rather than drop the round */ }
      return callMcpTool(tool, args);
    }));
    apiMessages.push(...toolCalls.map((call, i) => ({ role: 'tool', tool_call_id: call.id, content: results[i] })));
  }
}

async function runCompletion(apiMessages, { model, temperature, tools, signal, onChunk, apiKey, onLimits, baseUrl = GROQ_URL }) {
  const requestBody = { model, messages: apiMessages, temperature, stream: true };
  // Length-checked, not just truthy: an empty array is truthy, so research
  // mode (which deliberately offers no tools) would otherwise send
  // "tools": [] -- a shape some OpenAI-compatible endpoints reject outright.
  if (tools?.length) requestBody.tools = tools;
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(requestBody), signal,
  });
  // Read before the ok-check: a 429 response still carries the rate-limit
  // headers (arguably the most useful moment to see them), and response
  // headers are available as soon as fetch resolves, before the body streams.
  // Optional: the test suite's fetch stubs return plain objects without a
  // real Headers instance, and a missing reading here means "no data yet",
  // the same as parseGroqLimits returning null for a Groq response that
  // omits the rate-limit headers.
  const limits = response.headers ? parseGroqLimits(response.headers) : null;
  if (limits) onLimits?.(limits);
  if (!response.ok || !response.body) throw new Error('Não foi possível contactar o modelo de IA.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const think = createThinkFilter();
  let buffer = '';
  let content = '';
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
        if (delta.content) {
          const visible = think.push(delta.content);
          content += visible;
          onChunk(visible);
        }
        for (const call of delta.tool_calls ?? []) {
          const slot = (toolCalls[call.index] ??= { id: call.id, name: '', arguments: '' });
          if (call.id) slot.id = call.id;
          if (call.function?.name) slot.name = call.function.name;
          if (call.function?.arguments) slot.arguments += call.function.arguments;
        }
      } catch { /* ignore malformed SSE */ }
    }
  }
  const flushed = think.flush();
  content += flushed;
  onChunk(flushed);
  return { content, toolCalls: Object.values(toolCalls) };
}

// Auto routing for Standard mode, no attachment (Code mode and image
// attachments are decided by pickTextModel/streamCompletion before this runs).
// Bucketed by crude length/shape signals, not real complexity classification
// -- a short but technical message ("prove P=NP") is under-routed to the
// lighter model, and there is no attempt here to detect "math-heavy" content
// beyond a code fence.
//
// Two tiers, not three, since the Llama retirement (see SELECTABLE_MODELS):
// the old 50-200 char bucket went to llama-3.3-70b-versatile, and its
// replacement is TEXT_MODEL, which that bucket now shares with the 200+ one.
// That bucket gets strictly better on both axes -- at the prices Groq listed
// when this was written, gpt-oss-120b is cheaper ($0.15/$0.60 per M tokens vs
// $0.59/$0.79) and faster (500 vs 280 T/s) than the 70B it replaces.
const autoStandardModel = (content) => {
  if (content.length >= 50 || content.includes('```')) return TEXT_MODEL;
  return LIGHT_MODEL;
};

// Picks the text model for this request (an image attachment overrides this
// with VISION_MODEL separately -- see isImageAttachment in the handler and
// streamCompletion's own model selection). Manual selection wins over Auto
// regardless of mode; Auto itself still special-cases Code mode, since a
// flagship model is worth the latency there.
const pickTextModel = (body) => {
  if (body.selectedModel && body.selectedModel !== 'auto') return body.selectedModel;
  // A research report is long and structured -- never let Auto route it to a
  // small model by message length the way a normal chat turn is routed.
  if (body.researchMode) return TEXT_MODEL;
  if (body.mode === 'code') return CODE_FALLBACK_MODEL;
  // A non-image attachment (an image forces VISION_MODEL separately, see
  // above) carries unpredictable, often technical content the user's short
  // accompanying message doesn't reflect -- route straight to the flagship
  // model instead of bucketing by that message's length alone.
  if (body.attachment) return TEXT_MODEL;
  return autoStandardModel(body.messages.at(-1).content);
};

export default async function handler(req, res) {
  // Art. 50(2) AI Act: machine-readable marking that replies are AI-generated.
  // Set once here, before any response path, so it covers every status code
  // this handler can return -- not just the SSE success path.
  res.setHeader('X-AI-Generated', 'true');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  if (isRateLimited(clientIp(req))) return res.status(429).json({ error: 'Demasiados pedidos. Tenta novamente dentro de um minuto.' });
  try {
    const controller = new AbortController();
    res.on('close', () => controller.abort());
    const body = parseBody(req.body);
    validate(body);
    // A user's own key, sent fresh on every request and never written to any
    // store here -- falls back to the shared deployment key when absent. Never
    // logged: keep it out of every console.log/error path in this handler.
    const groqApiKey = body.groqApiKey?.trim() || process.env.GROQ_API_KEY;
    // Resolved before the system prompt is built (below), not after: the prompt's
    // IDENTITY_RULE needs to name the model that will actually answer, and
    // streamCompletion itself re-derives this same isImageAttachment -> VISION_MODEL
    // override when it builds the real request.
    const isImageAttachment = body.attachment && typeof body.attachment.text !== 'string';
    const textModel = pickTextModel(body);
    const resolvedModel = isImageAttachment ? VISION_MODEL : textModel;
    // An image attachment always answers on Groq's vision model regardless of
    // which text model was picked -- the same override resolvedModel above
    // applies, kept in sync rather than re-derived from resolvedModel to make
    // the "vision forces Groq" rule explicit at the read site.
    const provider = isImageAttachment ? 'groq' : providerForModel(textModel);
    // No BYOK for Gemini/OpenRouter yet (Settings > Advanced only takes a
    // Groq key) -- see the ROADMAP note this extends once they need it.
    const PROVIDER_CONFIG = {
      groq: { apiKey: groqApiKey, baseUrl: GROQ_URL },
      gemini: { apiKey: process.env.GEMINI_API_KEY, baseUrl: GEMINI_URL },
      openrouter: { apiKey: process.env.OPENROUTER_API_KEY, baseUrl: OPENROUTER_URL },
    };
    const { apiKey, baseUrl } = PROVIDER_CONFIG[provider];
    const latestMessage = body.messages.at(-1).content;

    // Idempotent: research mode has to open the stream early to report
    // progress (its searches alone take 10s+, and the user would otherwise
    // stare at nothing), while every other path opens it just before
    // streaming. Calling setHeader after flushHeaders throws, so the flag is
    // what keeps both callers safe.
    let streamStarted = false;
    const beginStream = () => {
      if (streamStarted) return;
      streamStarted = true;
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();
    };
    if (body.researchMode) beginStream();
    const researchStep = (step, detail) => {
      if (body.researchMode) sendEvent(res, 'research_step', { step, detail });
    };

    // Only these four progress strings need a translation on the server --
    // everything else the client shows is static UI chrome, already covered
    // by src/i18n.ts, and the model's own reply already mirrors whatever
    // language the user typed in (see LANGUAGE_RULE above). `body.locale` is
    // the client's detectLocale() result, not user input from a form field.
    const RESEARCH_STRINGS = {
      pt: {
        plan: 'A planear a investigação',
        search: (n) => `A pesquisar ${n} ângulos`,
        read: (n) => `${n} fontes recolhidas`,
        write: 'A escrever o relatório',
      },
      en: {
        plan: 'Planning the research',
        search: (n) => `Searching ${n} angles`,
        read: (n) => `${n} sources gathered`,
        write: 'Writing the report',
      },
    };
    const rs = RESEARCH_STRINGS[body.locale === 'pt' ? 'pt' : 'en'];

    let researchQueries = [];
    let results = [];
    if (body.researchMode) {
      researchStep('plan', rs.plan);
      researchQueries = await planResearch(latestMessage, controller.signal, groqApiKey);
      researchStep('search', rs.search(researchQueries.length));
      results = await runResearchSearches(researchQueries, controller.signal);
      researchStep('read', rs.read(results.length));
      researchStep('write', rs.write);
    } else if (body.webMode) {
      results = await getWebContext(latestMessage);
    }
    const webContext = body.researchMode
      ? researchContext(researchQueries, results)
      : results.length ? `\n\nResultados de pesquisa web:\n${results.map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.content}`).join('\n\n')}\n\nEstilo de resposta com pesquisa web:
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
    // This note used to say "always call create_file, even for a short message"
    // with nothing on the other side of the scale, so the model answered
    // "twin" and "you good twin" by generating files -- and sent files with no
    // text at all. The rule it was missing is that the trigger is the CURRENT
    // message asking for a file, not a file having been discussed earlier.
    const fileToolNote = '\n\nFICHEIROS (tool create_file):\n- Usa create_file APENAS quando a mensagem MAIS RECENTE do utilizador pedir de facto um ficheiro (ex: "cria um ficheiro", "faz um html", "dá-me isso para download"). Nesse caso usa-a imediatamente, sem explicar passos manuais (abrir o Bloco de Notas, colar, guardar como).\n- NUNCA uses create_file para cumprimentos, agradecimentos, conversa curta ou mensagens como "ok", "twin", "obrigado", "tudo bem?". Responde só com texto.\n- NUNCA reenvies um ficheiro que já enviaste. Se o utilizador pedir alterações, cria a nova versão; se não pediu nada de novo, responde só com texto.\n- Sempre que enviares um ficheiro, escreve também uma resposta curta em texto a dizer o que ele contém e como usá-lo. Nunca respondas apenas com o ficheiro e sem texto.';
    // Sent by the client only when the user has memory on and typed at least
    // one /remember command -- nothing here is extracted automatically.
    const memories = Array.isArray(body.memories) ? body.memories : [];
    const memoryContext = memories.length
      ? `\n\nMEMÓRIAS GUARDADAS (fornecidas explicitamente pelo utilizador via /remember -- não são factos verificados, são contexto de fundo; não as repitas literalmente a menos que seja relevante para a resposta):\n${memories.map((memory) => `- ${memory}`).join('\n')}`
      : '';
    const system = (body.mode === 'code' ? codePrompt(body.userName || 'Utilizador', resolvedModel, provider) : standardPrompt(body.userName || 'Utilizador', resolvedModel, provider)) + webContext + fileToolNote + memoryContext;
    // isImageAttachment also gates MCP discovery: an image attachment forces
    // the vision model, which drops every tool including MCP ones (see the
    // toolsForModel guard in streamCompletion). Discovering tools that will just be
    // thrown away costs up to MCP_TIMEOUT_MS of latency before the first byte,
    // for nothing the model is ever offered.
    const mcpServers = !isImageAttachment && Array.isArray(body.mcpServers) ? body.mcpServers : [];
    const mcpTools = mcpServers.length ? await discoverMcpTools(mcpServers) : [];
    const mcpToolsByName = Object.fromEntries(mcpTools.map((tool) => [tool.name, tool]));
    beginStream();
    if (results.length) sendEvent(res, 'sources', results.map(({ title, url }) => ({ title, url })));
    await streamCompletion({
      messages: body.messages, system, attachment: body.attachment, signal: controller.signal,
      textModel,
      // Research mode gets no tools: the deliverable is one long report, and
      // a create_file call mid-report truncates it. Enforced here rather than
      // only asked for in the prompt.
      tools: body.researchMode ? [] : [...TOOLS, ...mcpTools.map((tool) => tool.definition)],
      // Code mode always runs at 0.3, ignoring the client's temperature --
      // low temperature is what makes generated code deterministic and
      // syntactically reliable; the Settings slider is for Standard mode's
      // prose, where variety is actually wanted.
      temperature: body.mode === 'code' ? 0.3 : body.temperature ?? 0.7,
      mcpToolsByName,
      // Fired by streamCompletion itself once the request has cleared every check
      // that could still reject it (see the onModel comment there) -- not
      // sent up front here, which used to announce a real model over SSE for
      // requests about to fail anyway (e.g. a PDF attachment in Standard mode).
      onModel: (model) => sendEvent(res, 'model', { model }),
      onChunk: (text) => text && sendEvent(res, 'chunk', text),
      onFile: (filename, content) => sendEvent(res, 'file', { filename, content }),
      apiKey,
      baseUrl,
      // Groq-only in practice: parseGroqLimits only recognizes Groq's header
      // names, so a Gemini response (different headers, or none of these)
      // yields null and this never fires for that provider -- no separate
      // guard needed here for it.
      onLimits: (limits) => sendEvent(res, 'limits', limits),
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
