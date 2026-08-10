# Roadmap

Ideas that have been discussed but aren't scheduled or committed to. Nothing
here is a promise — it's a place to park a plan so it isn't lost, and to
write down the trade-offs while they're still fresh.

## "Sign in with ChatGPT" as an optional model source

**Idea:** let users bring their own ChatGPT account as an alternative to
Groq, using [openai-oauth](https://github.com/EvanZhouDev/openai-oauth)
(Apache-2.0). Each user authenticates with their own account — never a
single shared account powering every user, which the project's own README
explicitly says not to do.

**Why it's interesting:** free inference for users who already pay for
ChatGPT, and access to OpenAI's models without VUXIO needing its own OpenAI
API key/billing.

**Why it's not started yet:**

- **Legal/ToS**: openai-oauth's own README says outright that using it is
  the integrator's and end-user's responsibility under OpenAI's Terms of
  Use — it authenticates via ChatGPT session credentials against
  endpoints not officially opened for third-party API use, which is
  different from OpenAI's metered API. Per-user sign-in (each person's own
  account, own risk) is the least-bad shape of this, but it's still a grey
  area, not a cleared one.
- **Browser extension requirement**: users need to install the "Sign in
  with ChatGPT" extension (Chrome or Firefox) before the flow works at
  all. That's real adoption friction, not a minor detail — worth
  re-confirming this is still wanted once it's time to build it, in case
  the extension requirement goes away in a future version of the library.
- **Architecture mismatch**: `api/chat.js` is a classic Vercel Node
  function (`req, res`, manual SSE via `res.write`). openai-oauth's server
  helper (`openaiCredentials(request)`) expects a Fetch API `Request`, and
  the library is built around the Vercel AI SDK's `generateText`/
  `streamText`, not raw SSE framing. Wiring this in means either adapting
  the existing endpoint's request handling or adding a second endpoint
  with its own streaming shape, plus a frontend `SignInWithChatGPT` button
  and header-passing (`openaiAuthHeaders()`) on top of the existing chat
  flow.

**Shape if it happens:** an additional opt-in mode next to Standard/Code/Web
("Use my ChatGPT account"), not a replacement for Groq.
