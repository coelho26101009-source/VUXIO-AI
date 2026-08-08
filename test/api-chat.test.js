import assert from 'node:assert/strict';
import test from 'node:test';
import handler from '../api/chat.js';

const response = () => {
  const result = { statusCode: 200, body: undefined, headersSent: false };
  result.status = (statusCode) => { result.statusCode = statusCode; return result; };
  result.json = (body) => { result.body = body; return result; };
  result.setHeader = () => {};
  result.flushHeaders = () => { result.headersSent = true; };
  result.write = () => {};
  result.end = () => {};
  result.on = () => {};
  return result;
};

test('rejects methods other than POST', async () => {
  const res = response();
  await handler({ method: 'GET', headers: {} }, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.body.error, 'Método não permitido.');
});

test('rejects invalid chat payloads before contacting an AI provider', async () => {
  const res = response();
  await handler({ method: 'POST', headers: {}, body: { mode: 'standard', messages: [] } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'Pedido inválido.');
});

// An SSE body shaped like Groq's, so the handler's reader loop terminates.
const groqStream = () => new ReadableStream({
  start(controller) {
    controller.enqueue(new TextEncoder().encode(
      'data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n',
    ));
    controller.close();
  },
});

// Drives the handler with fetch stubbed, and returns every request it made.
// Each caller passes its own IP so the 15-per-minute rate limiter, which keys
// on IP and persists across tests in this process, cannot make one test's
// traffic fail another's.
const runWithStubbedFetch = async (body, ip) => {
  const calls = [];
  const realFetch = globalThis.fetch;
  const realGroqKey = process.env.GROQ_API_KEY;
  const realTavilyKey = process.env.TAVILY_API_KEY;
  const realGeminiKey = process.env.GEMINI_API_KEY;

  process.env.GROQ_API_KEY = 'test-groq-key';
  process.env.TAVILY_API_KEY = 'test-tavily-key';
  delete process.env.GEMINI_API_KEY;

  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('tavily')) {
      return { ok: true, status: 200, json: async () => ({ results: [] }) };
    }
    return { ok: true, status: 200, body: groqStream() };
  };

  try {
    await handler({ method: 'POST', headers: { 'x-forwarded-for': ip }, body }, response());
  } finally {
    globalThis.fetch = realFetch;
    if (realGroqKey === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = realGroqKey;
    if (realTavilyKey === undefined) delete process.env.TAVILY_API_KEY; else process.env.TAVILY_API_KEY = realTavilyKey;
    if (realGeminiKey !== undefined) process.env.GEMINI_API_KEY = realGeminiKey;
  }
  return calls;
};

const chat = { mode: 'standard', messages: [{ role: 'user', content: 'ola' }] };

test('standard mode asks Groq for a model Groq still serves', async () => {
  const calls = await runWithStubbedFetch(chat, '10.0.0.1');
  const groq = calls.find((call) => call.url.includes('api.groq.com'));
  assert.ok(groq, 'expected a request to Groq');

  const { model } = JSON.parse(groq.options.body);
  // llama-3.2-11b-vision-preview and llama-3.2-90b-vision-preview are
  // decommissioned; asking for either is a 400 at runtime, which is exactly
  // the bug this guards against reintroducing.
  assert.doesNotMatch(model, /vision-preview$/, `${model} is a decommissioned Groq model`);
  assert.equal(model, 'openai/gpt-oss-120b');
});

test('web mode authenticates to Tavily with a Bearer header, not a body key', async () => {
  const calls = await runWithStubbedFetch({ ...chat, webMode: true }, '10.0.0.2');
  const tavily = calls.find((call) => call.url.includes('tavily'));
  assert.ok(tavily, 'expected a request to Tavily');

  assert.equal(tavily.options.headers.Authorization, 'Bearer test-tavily-key');
  // Tavily stopped accepting the key in the body. Sending it there failed the
  // handler's !response.ok check, and Web Mode returned no sources at all --
  // silently, because that path returns [] rather than raising.
  assert.equal(JSON.parse(tavily.options.body).api_key, undefined);
});

test('code mode falls back to Groq when Gemini rejects the request', async () => {
  const calls = [];
  const realFetch = globalThis.fetch;
  const realGroqKey = process.env.GROQ_API_KEY;
  const realGeminiKey = process.env.GEMINI_API_KEY;

  process.env.GROQ_API_KEY = 'test-groq-key';
  process.env.GEMINI_API_KEY = 'test-gemini-key';

  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    // 404 is what Google answers for a model it has retired -- the case the
    // old `status === 429 || status >= 500` condition let through to a throw.
    if (String(url).includes('googleapis')) return { ok: false, status: 404, body: null };
    return { ok: true, status: 200, body: groqStream() };
  };

  try {
    await handler(
      { method: 'POST', headers: { 'x-forwarded-for': '10.0.0.3' }, body: { ...chat, mode: 'code' } },
      response(),
    );
  } finally {
    globalThis.fetch = realFetch;
    if (realGroqKey === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = realGroqKey;
    if (realGeminiKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = realGeminiKey;
  }

  const groq = calls.find((call) => call.url.includes('api.groq.com'));
  assert.ok(groq, 'a 404 from Gemini should fall back to Groq, not fail the request');
  assert.equal(JSON.parse(groq.options.body).model, 'groq/compound');
});

// --- <think> filtering -------------------------------------------------
// Exercised through the handler, since the filter is internal to api/chat.js.
// Each case streams the content back split at a deliberately awkward point.
const streamOf = (...chunks) => new ReadableStream({
  start(controller) {
    const encode = new TextEncoder();
    for (const chunk of chunks) {
      controller.enqueue(encode.encode(
        `data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`,
      ));
    }
    controller.enqueue(encode.encode('data: [DONE]\n\n'));
    controller.close();
  },
});

const replyText = async (chunks, ip) => {
  const realFetch = globalThis.fetch;
  const realKey = process.env.GROQ_API_KEY;
  const realGemini = process.env.GEMINI_API_KEY;
  process.env.GROQ_API_KEY = 'test-groq-key';
  delete process.env.GEMINI_API_KEY;

  globalThis.fetch = async () => ({ ok: true, status: 200, body: streamOf(...chunks) });

  let out = '';
  const res = response();
  res.write = (chunk) => { out += chunk; };
  try {
    await handler(
      { method: 'POST', headers: { 'x-forwarded-for': ip },
        body: { mode: 'standard', messages: [{ role: 'user', content: 'hi' }] } },
      res,
    );
  } finally {
    globalThis.fetch = realFetch;
    if (realKey === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = realKey;
    if (realGemini !== undefined) process.env.GEMINI_API_KEY = realGemini;
  }
  return out.split('\n')
    .filter((line) => line.startsWith('data: ') && !line.includes('"sources"'))
    .map((line) => { try { return JSON.parse(line.slice(6)); } catch { return ''; } })
    .filter((value) => typeof value === 'string')
    .join('');
};

test('a reasoning model\'s <think> block never reaches the user', async () => {
  const text = await replyText(['<think>plan the answer</think>', 'Resposta.'], '10.5.0.1');
  assert.equal(text, 'Resposta.');
});

test('<think> split across stream chunks is still stripped', async () => {
  // The case a per-chunk regex misses: no single chunk contains a whole tag.
  const text = await replyText(['<thi', 'nk>hidden', ' reasoning</thi', 'nk>Visivel.'], '10.5.0.2');
  assert.equal(text, 'Visivel.');
});

test('text with no think block passes through byte for byte', async () => {
  const text = await replyText(['Olá', ' Jose', '!'], '10.5.0.3');
  assert.equal(text, 'Olá Jose!');
});

test('a lone < in normal prose is not mistaken for a tag', async () => {
  const text = await replyText(['if (a < b) return;'], '10.5.0.4');
  assert.equal(text, 'if (a < b) return;');
});
