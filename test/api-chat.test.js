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
  // the bug this guards against reintroducing. Which exact model Auto picks
  // for this message is covered by the model-selection tests below.
  assert.doesNotMatch(model, /vision-preview$/, `${model} is a decommissioned Groq model`);
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

test('code mode uses a model that actually supports custom tools', async () => {
  const calls = await runWithStubbedFetch({ ...chat, mode: 'code' }, '10.0.0.3');
  const groq = calls.find((call) => call.url.includes('api.groq.com'));
  assert.ok(groq, 'expected a request to Groq');

  const body = JSON.parse(groq.options.body);
  // groq/compound rejects any request carrying custom tools outright (400,
  // not a silent ignore) -- Code Mode used to default to it and every
  // create_file request there failed the whole completion, not just the
  // tool call. Guards against reintroducing that pairing.
  assert.notEqual(body.model, 'groq/compound');
  assert.ok(body.tools, 'expected create_file to be offered in Code Mode');
});

test('a text/code attachment is injected as text, not routed through the vision model', async () => {
  const calls = await runWithStubbedFetch({
    ...chat,
    messages: [{ role: 'user', content: 'o que faz isto?' }],
    attachment: { text: 'int main() { return 0; }', name: 'main.c', mimeType: 'text/x-csrc', base64: '' },
  }, '10.0.0.4');
  const groq = calls.find((call) => call.url.includes('api.groq.com'));
  assert.ok(groq, 'expected a request to Groq');

  const body = JSON.parse(groq.options.body);
  // A .c/.py file has no image_url representation -- routing it through
  // VISION_MODEL would either 400 or silently ignore the code. It must stay
  // on the plain text model as literal message content instead.
  assert.equal(body.model, 'openai/gpt-oss-120b');
  assert.match(body.messages.at(-1).content, /int main\(\) \{ return 0; \}/);
  assert.match(body.messages.at(-1).content, /main\.c/);
  // Text attachments aren't multimodal, so create_file stays available --
  // unlike an image attachment, which drops tools (see the guard in streamGroq).
  assert.ok(body.tools, 'expected create_file to still be offered alongside a text attachment');
});

// --- input validation (client is not a trust boundary) --------------------

test('an oversized userName is rejected before it reaches the system prompt', async () => {
  const res = response();
  await handler({ method: 'POST', headers: { 'x-forwarded-for': '10.0.1.1' }, body: { ...chat, userName: 'x'.repeat(101) } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'Nome de utilizador inválido.');
});

test('an attachment missing mimeType is rejected cleanly, not with a raw TypeError', async () => {
  const res = response();
  // No `text`, so this falls into the base64/mimeType branch of validate() --
  // it used to call mimeType.startsWith() before checking mimeType was even
  // a string, crashing with "Cannot read properties of undefined (reading
  // 'startsWith')" and leaking that raw message to the client.
  await handler({
    method: 'POST',
    headers: { 'x-forwarded-for': '10.0.1.2' },
    body: { ...chat, attachment: { base64: 'aGVsbG8=' } },
  }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'Anexo inválido ou demasiado grande.');
});

// --- model identity ------------------------------------------------------

test('the system prompt states VUXIO\'s real model instead of letting it guess', async () => {
  const calls = await runWithStubbedFetch(chat, '10.1.0.1');
  const groq = calls.find((call) => call.url.includes('api.groq.com'));
  const { model, messages } = JSON.parse(groq.options.body);
  const system = messages[0].content;
  // "ola" is short enough that Auto routes it to the fast model, not the
  // flagship -- the prompt must name whichever model this request actually
  // resolves to, not a hardcoded constant that can drift from what Groq
  // actually receives.
  assert.equal(model, 'llama-3.1-8b-instant');
  // Guards against the hallucination this was added to fix: asked "what
  // model do you run on", VUXIO answered "GPT-4-turbo" with nothing in the
  // prompt telling it otherwise.
  assert.match(system, /llama-3\.1-8b-instant/);
  assert.match(system, /qwen\/qwen3\.6-27b/);
});

test('the system prompt still states the real model under a non-default selectedModel', async () => {
  // Picks a model the request would never resolve to by coincidence (Auto's
  // own default for this message is the fast model, per the test above) --
  // the only way this passes is if the prompt is actually built from the
  // resolved model rather than a hardcoded one.
  const calls = await runWithStubbedFetch({ ...chat, selectedModel: 'llama-3.3-70b-versatile' }, '10.1.0.2');
  const groq = calls.find((call) => call.url.includes('api.groq.com'));
  const { model, messages } = JSON.parse(groq.options.body);
  const system = messages[0].content;
  assert.equal(model, 'llama-3.3-70b-versatile');
  assert.match(system, /llama-3\.3-70b-versatile/);
  assert.doesNotMatch(system, /openai\/gpt-oss-120b/);
});

// --- temperature -----------------------------------------------------------

test('temperature defaults to 0.7 when the client omits it', async () => {
  const calls = await runWithStubbedFetch(chat, '10.2.0.1');
  const groq = calls.find((call) => call.url.includes('api.groq.com'));
  assert.equal(JSON.parse(groq.options.body).temperature, 0.7);
});

test('a client-supplied temperature is forwarded to Groq', async () => {
  const calls = await runWithStubbedFetch({ ...chat, temperature: 1.3 }, '10.2.0.2');
  const groq = calls.find((call) => call.url.includes('api.groq.com'));
  assert.equal(JSON.parse(groq.options.body).temperature, 1.3);
});

test('an out-of-range temperature is rejected before contacting Groq', async () => {
  const res = response();
  await handler({ method: 'POST', headers: { 'x-forwarded-for': '10.2.0.3' }, body: { ...chat, temperature: 5 } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'Temperatura inválida.');
});

// --- cross-chat memory -----------------------------------------------------

test('memories are validated and injected into the system prompt', async () => {
  const calls = await runWithStubbedFetch({ ...chat, memories: ['gosta de respostas curtas'] }, '10.3.0.1');
  const groq = calls.find((call) => call.url.includes('api.groq.com'));
  const system = JSON.parse(groq.options.body).messages[0].content;
  assert.match(system, /gosta de respostas curtas/);
});

test('an oversized memories array is rejected before contacting Groq', async () => {
  const res = response();
  const memories = Array.from({ length: 21 }, (_, i) => `memoria ${i}`);
  await handler({ method: 'POST', headers: { 'x-forwarded-for': '10.3.0.2' }, body: { ...chat, memories } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'Memórias inválidas.');
});

// --- MCP (remote HTTP servers) ----------------------------------------------
// A stub JSON-RPC server standing in for a real remote MCP server, keyed by
// the JSON-RPC method in each request body.
const mcpJsonRpc = (id, result) => ({
  ok: true,
  headers: { get: (name) => (name === 'content-type' ? 'application/json' : null) },
  text: async () => JSON.stringify({ jsonrpc: '2.0', id, result }),
});

test('an invalid MCP server URL is rejected before contacting Groq', async () => {
  const res = response();
  await handler({ method: 'POST', headers: { 'x-forwarded-for': '10.9.0.1' }, body: { ...chat, mcpServers: [{ name: 'Bad', url: 'not-a-url' }] } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'Servidores MCP inválidos.');
});

test('MCP server URLs pointing at loopback, link-local, or private literals are rejected (SSRF)', async () => {
  const blocked = [
    'http://169.254.169.254/latest/meta-data/', // cloud metadata endpoint, plain http
    'https://127.0.0.1:8080/admin',
    'https://[::1]:9000/',
    'https://localhost/',
    'https://sub.localhost/',
    'https://metadata.google.internal/',
    'https://10.1.2.3/',
    'https://192.168.1.1/',
    'https://172.16.0.5/',
    'https://172.31.255.255/',
    'https://[fe80::1]/',
    'https://[fc00::1]/',
    'https://0.0.0.0/',
    // decimal/octal/hex-encoded 127.0.0.1 -- new URL() canonicalizes all of
    // these to dotted-decimal before the check runs.
    'https://2130706433/',
    'https://0x7f000001/',
  ];
  for (const url of blocked) {
    const res = response();
    await handler({ method: 'POST', headers: { 'x-forwarded-for': '10.9.0.100' }, body: { ...chat, mcpServers: [{ name: 'X', url }] } }, res);
    assert.equal(res.statusCode, 400, `expected ${url} to be rejected`);
    assert.equal(res.body.error, 'Servidores MCP inválidos.');
  }
});

test('a discovered MCP tool is namespaced, offered to Groq, and its result reaches a follow-up answer', async () => {
  const realFetch = globalThis.fetch;
  const realGroqKey = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = 'test-groq-key';

  let groqCallCount = 0;
  const offeredToolNames = [];

  globalThis.fetch = async (url, options) => {
    const href = String(url);
    if (href.includes('mock-mcp.example.com')) {
      const message = JSON.parse(options.body);
      if (message.method === 'initialize') return mcpJsonRpc(message.id, {});
      if (message.method === 'notifications/initialized') return { ok: true, headers: { get: () => null } };
      if (message.method === 'tools/list') return mcpJsonRpc(message.id, { tools: [{ name: 'lookup', description: 'Looks something up' }] });
      if (message.method === 'tools/call') return mcpJsonRpc(message.id, { content: [{ type: 'text', text: 'resultado da ferramenta' }] });
      throw new Error(`unexpected MCP method ${message.method}`);
    }

    groqCallCount += 1;
    const requestBody = JSON.parse(options.body);
    if (groqCallCount === 1) {
      offeredToolNames.push(...(requestBody.tools ?? []).map((tool) => tool.function.name));
      // First round: the model calls the discovered tool instead of answering.
      return {
        ok: true, status: 200,
        body: new ReadableStream({
          start(controller) {
            const encode = new TextEncoder();
            controller.enqueue(encode.encode(`data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_1', function: { name: 'mcp0_lookup', arguments: '{}' } }] } }] })}\n\n`));
            controller.enqueue(encode.encode('data: [DONE]\n\n'));
            controller.close();
          },
        }),
      };
    }
    // Second round: the tool result must already be in the conversation the
    // model sees, as a `tool` message answering the exact tool_call_id.
    const toolMessage = requestBody.messages.find((message) => message.role === 'tool');
    assert.ok(toolMessage, 'expected a tool-result message in the follow-up request');
    assert.equal(toolMessage.tool_call_id, 'call_1');
    assert.equal(toolMessage.content, 'resultado da ferramenta');
    return { ok: true, status: 200, body: groqStream() };
  };

  try {
    await handler({
      method: 'POST',
      headers: { 'x-forwarded-for': '10.9.0.2' },
      body: { ...chat, messages: [{ role: 'user', content: 'usa a ferramenta lookup' }], mcpServers: [{ name: 'Demo', url: 'https://mock-mcp.example.com/mcp' }] },
    }, response());
    assert.equal(groqCallCount, 2, 'expected a follow-up completion once the tool result came back');
    assert.ok(offeredToolNames.includes('mcp0_lookup'), 'expected the discovered tool namespaced by server index and merged with create_file');
    assert.ok(offeredToolNames.includes('create_file'), 'expected create_file to still be offered alongside MCP tools');
  } finally {
    globalThis.fetch = realFetch;
    if (realGroqKey === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = realGroqKey;
  }
});

test('an unreachable MCP server degrades to "no tools from it" instead of failing the whole chat', async () => {
  const realFetch = globalThis.fetch;
  const realGroqKey = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = 'test-groq-key';

  let groqCalled = false;
  globalThis.fetch = async (url) => {
    if (String(url).includes('down.example.com')) throw new Error('connection refused');
    groqCalled = true;
    return { ok: true, status: 200, body: groqStream() };
  };

  let wrote = '';
  const res = response();
  res.write = (chunk) => { wrote += chunk; };

  try {
    await handler({
      method: 'POST',
      headers: { 'x-forwarded-for': '10.9.0.3' },
      body: { ...chat, mcpServers: [{ name: 'Down', url: 'https://down.example.com/mcp' }] },
    }, res);
    // statusCode/body are undefined-by-default on the fake res, so asserting
    // just those two would pass even if the handler never touched Groq at
    // all -- assert real evidence that a reply actually happened instead.
    assert.equal(res.statusCode, 200, 'the chat must still complete even though its only configured MCP server is unreachable');
    assert.ok(groqCalled, 'expected the handler to still contact Groq for a real answer');
    assert.match(wrote, /event: chunk/, 'expected an actual reply chunk to reach the client, not a silent no-op');
  } finally {
    globalThis.fetch = realFetch;
    if (realGroqKey === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = realGroqKey;
  }
});

test('a non-spec-compliant inputSchema is coerced to an empty object schema instead of reaching Groq broken', async () => {
  const realFetch = globalThis.fetch;
  const realGroqKey = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = 'test-groq-key';

  let offeredParameters;
  globalThis.fetch = async (url, options) => {
    const href = String(url);
    if (href.includes('weird-mcp.example.com')) {
      const message = JSON.parse(options.body);
      if (message.method === 'initialize') return mcpJsonRpc(message.id, {});
      if (message.method === 'notifications/initialized') return { ok: true, headers: { get: () => null } };
      // inputSchema: [] passes a naive `typeof === 'object'` check (arrays
      // are objects) but isn't a JSON Schema object -- this is what used to
      // reach Groq as-is and 400 the whole completion.
      if (message.method === 'tools/list') return mcpJsonRpc(message.id, { tools: [{ name: 'weird', inputSchema: [] }] });
      throw new Error(`unexpected MCP method ${message.method}`);
    }
    const requestBody = JSON.parse(options.body);
    const weird = (requestBody.tools ?? []).find((tool) => tool.function.name === 'mcp0_weird');
    offeredParameters = weird?.function.parameters;
    return { ok: true, status: 200, body: groqStream() };
  };

  try {
    await handler({
      method: 'POST', headers: { 'x-forwarded-for': '10.9.0.4' },
      body: { ...chat, mcpServers: [{ name: 'Weird', url: 'https://weird-mcp.example.com/mcp' }] },
    }, response());
    assert.deepEqual(offeredParameters, { type: 'object', properties: {} });
  } finally {
    globalThis.fetch = realFetch;
    if (realGroqKey === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = realGroqKey;
  }
});

test('two tool names sharing a long prefix are disambiguated instead of one silently overwriting the other', async () => {
  const realFetch = globalThis.fetch;
  const realGroqKey = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = 'test-groq-key';

  // First 59 chars are identical, so the old 40-char truncation (and the
  // current 59-char one) both sanitize these two down to the same string.
  const longPrefix = 'a'.repeat(59);
  let groqCallCount = 0;
  let offeredNames = [];
  let calledOriginalName;

  globalThis.fetch = async (url, options) => {
    const href = String(url);
    if (href.includes('collide-mcp.example.com')) {
      const message = JSON.parse(options.body);
      if (message.method === 'initialize') return mcpJsonRpc(message.id, {});
      if (message.method === 'notifications/initialized') return { ok: true, headers: { get: () => null } };
      if (message.method === 'tools/list') {
        return mcpJsonRpc(message.id, { tools: [{ name: `${longPrefix}_read` }, { name: `${longPrefix}_write` }] });
      }
      if (message.method === 'tools/call') {
        calledOriginalName = message.params.name;
        return mcpJsonRpc(message.id, { content: [{ type: 'text', text: 'ok' }] });
      }
      throw new Error(`unexpected MCP method ${message.method}`);
    }

    groqCallCount += 1;
    const requestBody = JSON.parse(options.body);
    if (groqCallCount === 1) {
      offeredNames = (requestBody.tools ?? []).map((tool) => tool.function.name).filter((name) => name.startsWith('mcp0_'));
      // The model asks for the second (write) tool by its disambiguated name.
      const second = offeredNames[1];
      return {
        ok: true, status: 200,
        body: new ReadableStream({
          start(controller) {
            const encode = new TextEncoder();
            controller.enqueue(encode.encode(`data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_1', function: { name: second, arguments: '{}' } }] } }] })}\n\n`));
            controller.enqueue(encode.encode('data: [DONE]\n\n'));
            controller.close();
          },
        }),
      };
    }
    return { ok: true, status: 200, body: groqStream() };
  };

  try {
    await handler({
      method: 'POST',
      headers: { 'x-forwarded-for': '10.9.0.5' },
      body: { ...chat, mcpServers: [{ name: 'Collide', url: 'https://collide-mcp.example.com/mcp' }] },
    }, response());

    assert.equal(offeredNames.length, 2, 'expected both tools to be offered, not one overwriting the other');
    assert.notEqual(offeredNames[0], offeredNames[1], 'expected the truncated names to be disambiguated instead of colliding');
    // The model asked for the "write" tool by its disambiguated name -- the
    // server must actually run "write", not silently fall back to "read".
    assert.equal(calledOriginalName, `${longPrefix}_write`);
  } finally {
    globalThis.fetch = realFetch;
    if (realGroqKey === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = realGroqKey;
  }
});

test('an MCP server responding over SSE without a space after "data:" is still parsed', async () => {
  const realFetch = globalThis.fetch;
  const realGroqKey = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = 'test-groq-key';

  // The SSE spec makes the space after the field name optional -- this
  // frame is exactly as valid as "data: {...}".
  const sseFrame = (id, result) => ({
    ok: true,
    headers: { get: (name) => (name === 'content-type' ? 'text/event-stream' : null) },
    text: async () => `data:${JSON.stringify({ jsonrpc: '2.0', id, result })}\n\n`,
  });

  let offeredNames = [];
  globalThis.fetch = async (url, options) => {
    const href = String(url);
    if (href.includes('sse-mcp.example.com')) {
      const message = JSON.parse(options.body);
      if (message.method === 'initialize') return sseFrame(message.id, {});
      if (message.method === 'notifications/initialized') return { ok: true, headers: { get: () => null } };
      if (message.method === 'tools/list') return sseFrame(message.id, { tools: [{ name: 'ping' }] });
      throw new Error(`unexpected MCP method ${message.method}`);
    }
    const requestBody = JSON.parse(options.body);
    offeredNames = (requestBody.tools ?? []).map((tool) => tool.function.name);
    return { ok: true, status: 200, body: groqStream() };
  };

  try {
    await handler({
      method: 'POST',
      headers: { 'x-forwarded-for': '10.9.0.6' },
      body: { ...chat, mcpServers: [{ name: 'SSE', url: 'https://sse-mcp.example.com/mcp' }] },
    }, response());
    assert.ok(offeredNames.includes('mcp0_ping'), 'expected the space-less SSE handshake to still succeed instead of marking the server unavailable');
  } finally {
    globalThis.fetch = realFetch;
    if (realGroqKey === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = realGroqKey;
  }
});

test('hitting MAX_TOOL_ROUNDS still gets a real text answer instead of a blank reply', async () => {
  const realFetch = globalThis.fetch;
  const realGroqKey = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = 'test-groq-key';

  let groqCallCount = 0;
  const toolsOfferedPerCall = [];

  globalThis.fetch = async (url, options) => {
    const href = String(url);
    if (href.includes('loopy-mcp.example.com')) {
      const message = JSON.parse(options.body);
      if (message.method === 'initialize') return mcpJsonRpc(message.id, {});
      if (message.method === 'notifications/initialized') return { ok: true, headers: { get: () => null } };
      if (message.method === 'tools/list') return mcpJsonRpc(message.id, { tools: [{ name: 'poke' }] });
      // Mirrors callMcpTool's own "unavailable" message -- exactly the kind
      // of result that makes a model retry the tool instead of answering.
      if (message.method === 'tools/call') return mcpJsonRpc(message.id, { content: [{ type: 'text', text: 'esta ferramenta está indisponível de momento' }] });
      throw new Error(`unexpected MCP method ${message.method}`);
    }

    groqCallCount += 1;
    const requestBody = JSON.parse(options.body);
    toolsOfferedPerCall.push(Boolean(requestBody.tools));
    if (requestBody.tools) {
      // The model keeps calling the tool on every round tools are offered.
      return {
        ok: true, status: 200,
        body: new ReadableStream({
          start(controller) {
            const encode = new TextEncoder();
            controller.enqueue(encode.encode(`data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id: `call_${groqCallCount}`, function: { name: 'mcp0_poke', arguments: '{}' } }] } }] })}\n\n`));
            controller.enqueue(encode.encode('data: [DONE]\n\n'));
            controller.close();
          },
        }),
      };
    }
    // Final round, no tools offered: the model has nothing left to call.
    return { ok: true, status: 200, body: groqStream() };
  };

  let wrote = '';
  const res = response();
  res.write = (chunk) => { wrote += chunk; };

  try {
    await handler({
      method: 'POST',
      headers: { 'x-forwarded-for': '10.9.0.7' },
      body: { ...chat, messages: [{ role: 'user', content: 'usa a ferramenta poke repetidamente' }], mcpServers: [{ name: 'Loopy', url: 'https://loopy-mcp.example.com/mcp' }] },
    }, res);

    assert.equal(groqCallCount, 4, 'expected 3 tool rounds plus one final tools-less round');
    assert.deepEqual(toolsOfferedPerCall, [true, true, true, false], 'expected the final round to omit tools so the model must answer');
    assert.match(wrote, /event: chunk/, 'expected the final round to actually stream an answer, not a blank reply');
  } finally {
    globalThis.fetch = realFetch;
    if (realGroqKey === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = realGroqKey;
  }
});

test('MCP discovery is skipped for an image attachment, since its tools would be discarded anyway', async () => {
  const realFetch = globalThis.fetch;
  const realGroqKey = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = 'test-groq-key';

  let mcpContacted = false;
  globalThis.fetch = async (url) => {
    if (String(url).includes('unused-mcp.example.com')) {
      mcpContacted = true;
      throw new Error('should never be reached');
    }
    return { ok: true, status: 200, body: groqStream() };
  };

  try {
    await handler({
      method: 'POST',
      headers: { 'x-forwarded-for': '10.9.0.8' },
      body: {
        ...chat,
        attachment: { base64: Buffer.from('x').toString('base64'), mimeType: 'image/png' },
        mcpServers: [{ name: 'Unused', url: 'https://unused-mcp.example.com/mcp' }],
      },
    }, response());
    assert.equal(mcpContacted, false, 'expected MCP discovery to be skipped when an image attachment drops tools anyway');
  } finally {
    globalThis.fetch = realFetch;
    if (realGroqKey === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = realGroqKey;
  }
});

// --- model selection (selectedModel / Auto routing) -------------------------

test('Auto picks the fast model for a short greeting', async () => {
  const calls = await runWithStubbedFetch({ mode: 'standard', messages: [{ role: 'user', content: 'ola' }] }, '10.4.0.1');
  const groq = calls.find((call) => call.url.includes('api.groq.com'));
  assert.equal(JSON.parse(groq.options.body).model, 'llama-3.1-8b-instant');
});

test('Auto picks the flagship model for a long, code-fenced message', async () => {
  const long = `\`\`\`\n${'x'.repeat(250)}\n\`\`\``;
  const calls = await runWithStubbedFetch({ mode: 'standard', messages: [{ role: 'user', content: long }] }, '10.4.0.2');
  const groq = calls.find((call) => call.url.includes('api.groq.com'));
  assert.equal(JSON.parse(groq.options.body).model, 'openai/gpt-oss-120b');
});

test('Auto picks the flagship model for Code mode regardless of message length', async () => {
  const calls = await runWithStubbedFetch({ mode: 'code', messages: [{ role: 'user', content: 'oi' }] }, '10.4.0.3');
  const groq = calls.find((call) => call.url.includes('api.groq.com'));
  assert.equal(JSON.parse(groq.options.body).model, 'openai/gpt-oss-120b');
});

test('an image attachment forces the vision model even when selectedModel requests another one', async () => {
  const calls = await runWithStubbedFetch({
    ...chat,
    selectedModel: 'llama-3.1-8b-instant',
    attachment: { base64: Buffer.from('x').toString('base64'), mimeType: 'image/png' },
  }, '10.4.0.4');
  const groq = calls.find((call) => call.url.includes('api.groq.com'));
  assert.equal(JSON.parse(groq.options.body).model, 'qwen/qwen3.6-27b');
});

test('a manual selectedModel is honored over Auto routing', async () => {
  const calls = await runWithStubbedFetch({ ...chat, selectedModel: 'llama-3.3-70b-versatile' }, '10.4.0.5');
  const groq = calls.find((call) => call.url.includes('api.groq.com'));
  assert.equal(JSON.parse(groq.options.body).model, 'llama-3.3-70b-versatile');
});

test('an invalid selectedModel is rejected before contacting Groq', async () => {
  const res = response();
  // groq/compound is a real Groq model id, but not one this endpoint ever
  // offers -- it 400s on any request carrying custom tools, which every mode
  // sends (create_file). Confirms it's excluded from the allowlist too, not
  // just from Auto's own routing.
  await handler({ method: 'POST', headers: { 'x-forwarded-for': '10.4.0.6' }, body: { ...chat, selectedModel: 'groq/compound' } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'Modelo inválido.');
});

test('the model SSE event reports which model actually answered', async () => {
  const realFetch = globalThis.fetch;
  const realGroqKey = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = 'test-groq-key';
  globalThis.fetch = async () => ({ ok: true, status: 200, body: groqStream() });

  let wrote = '';
  const res = response();
  res.write = (chunk) => { wrote += chunk; };
  try {
    await handler({ method: 'POST', headers: { 'x-forwarded-for': '10.4.0.7' }, body: { ...chat, selectedModel: 'llama-3.3-70b-versatile' } }, res);
  } finally {
    globalThis.fetch = realFetch;
    if (realGroqKey === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = realGroqKey;
  }
  assert.match(wrote, /event: model\ndata: \{"model":"llama-3\.3-70b-versatile"\}/);
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
