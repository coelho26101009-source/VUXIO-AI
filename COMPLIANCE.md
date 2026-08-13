# EU AI Act compliance — VUXIO-AI

Regulation (EU) 2024/1689 ("the AI Act"), as amended by Regulation (EU)
2026/1744. Article 50 has applied since 2 August 2026.

Written 2026-08-12. Not legal advice — see "Requires human/legal review"
below for the open items.

## What the system is

VUXIO-AI is a chat frontend (React 19 + TypeScript + Vite + Tailwind) with a
serverless backend (`api/chat.js`) that proxies chat completions to
third-party model providers over SSE, with an optional web-search context
step (Tavily) and an optional MCP tool-calling loop.

## Art. 3(1) — is this an "AI system"?

Yes, for the same reasons as any LLM-backed chat application: machine-based,
generates output from input for the explicit objective of answering the
user, operating with varying autonomy. Not disputed.

## Roles — Art. 3(3)/(4)

VUXIO-AI does not train or place any model on the market; it calls
third-party models over an API. The operator of this deployment is:
- **Deployer (Art. 3(4))** of the third-party models called from
  `api/chat.js` (below) — not their provider. Art. 53 GPAI obligations for
  those models sit with the model providers, not with VUXIO-AI.
- Also acts as **provider (Art. 3(3))** of VUXIO-AI itself as an AI
  *system* (the chat application as a whole, distinct from the underlying
  models it calls) under Art. 3's system/model distinction.

## Models and services actually present in `api/chat.js`

Read directly from `api/chat.js` — nothing here is inferred from the
README or from history in code comments. Updated 2026-08-13: this section
previously said "Gemini is not called anywhere in the current code" — that
was true as of the previous check and is no longer true; Gemini and
OpenRouter were both wired in since, and are listed below.

| Constant | Value | Notes |
|---|---|---|
| `TEXT_MODEL` | `openai/gpt-oss-120b` | Standard mode default; served via Groq |
| `VISION_MODEL` | `qwen/qwen3.6-27b` | Used for image attachments; always Groq, regardless of the selected text model |
| `CODE_FALLBACK_MODEL` | `openai/gpt-oss-120b` (= `TEXT_MODEL`) | Code mode default |
| `LIGHT_MODEL` | `openai/gpt-oss-20b` | Selectable / Auto-routed |
| `COMPOUND_MODEL` | `groq/compound` | Referenced only by a guard that keeps it out of `SELECTABLE_MODELS` and strips `tools` if it's ever used — not reachable through any current routing path (`pickTextModel`/`autoStandardModel`) |
| `GEMINI_MODELS` | `gemini-2.5-pro`, `gemini-3.7-flash`, `gemini-3.6-flash`, `gemini-3.5-flash-lite` | Manual pick only, not Auto-routed; requested from Google's Gemini API |
| `OPENROUTER_MODELS` | 14 ids, each ending `:free` (e.g. `nvidia/nemotron-3-ultra-550b-a55b:free`) | Manual pick only; requested from OpenRouter, which itself proxies to the underlying model's own infrastructure (NVIDIA, Poolside, Cohere, Liquid AI, Google, depending on which of the 14 is selected) |

The four Groq constants above are requested from
`https://api.groq.com/openai/v1/chat/completions` (`runCompletion`) — Groq
is one of three APIs VUXIO-AI's backend now calls for chat completions,
selected per-request by `providerForModel()` based on which model the user
picked (Settings > model picker); the other two are Google's Gemini API
(`https://generativelanguage.googleapis.com/...`) and OpenRouter
(`https://openrouter.ai/api/v1/chat/completions`). Whichever is selected
receives the full conversation the user sent to that turn — same as Groq
already did before this update; the message content itself is data these
providers now also receive, not just VUXIO-AI's own Firestore.

Bring-your-own-key (`Settings > Advanced`, `body.groqApiKey`): a user-supplied
Groq key is used for that request only and is never written to any
datastore server-side (`api/chat.js`'s handler reads it from the request
body, never logs it, never persists it) — session-only on the client too
(`App.tsx`'s `groqApiKey` state, plain `useState`, not `localStorage` or
Firestore). Gemini and OpenRouter do not have a BYOK path yet; both always
use the deployment's own shared key.
`openai/gpt-oss-*` and `qwen*` are the underlying model families
Groq serves them from.

`getWebContext()` also calls `https://api.tavily.com/search` (Tavily) when
Web Mode is on. Tavily is a web-search API, not a generative AI model —
listed here for completeness since it is a third-party service `api/chat.js`
sends user queries to.

## Why not Art. 5 (prohibited practices)

Art. 5 lists eight prohibited practices. None apply to a general-purpose
chat assistant:

- (a) subliminal/manipulative/deceptive techniques materially distorting
  behaviour — the assistant answers user-directed requests; no
  manipulation objective.
- (b) exploiting vulnerabilities of age, disability or social/economic
  situation — not targeted at, or aware of, any such characteristic.
- (c) social scoring leading to detrimental treatment in unrelated
  contexts — no scoring of any kind.
- (d) criminal-risk assessment based solely on profiling or personality
  traits — not a risk-assessment system.
- (e) untargeted scraping of facial images from the internet or CCTV — no
  facial or biometric data collection anywhere in `api/chat.js`.
- (f) emotion inference in workplaces and education — no emotion
  inference; general public chat app, not workplace/education deployment.
- (g) biometric categorisation inferring sensitive characteristics — no
  biometric input handled by this system.
- (h) real-time remote biometric identification in public spaces for law
  enforcement — not applicable.

## Why not Annex III (high-risk)

Annex III lists eight high-risk domains: (1) biometrics, (2) critical
infrastructure, (3) education/vocational training, (4) employment/worker
management, (5) access to essential private and public services (credit,
insurance, emergency services, etc.), (6) law enforcement, (7)
migration/asylum/border control, (8) administration of justice and
democratic processes. VUXIO-AI is a general-purpose chat assistant with no
role in any of the eight — it does not make or feed decisions in any of
them.

## Why not Annex I

Annex I lists EU harmonisation legislation defining "safety component"
high-risk AI (machinery, toys, lifts, medical devices, etc.). VUXIO-AI is
software with no physical safety-component role under any Annex I
instrument.

## Why not GPAI (Art. 51-56)

VUXIO-AI does not train or place any model on the market — it is a
deployer of the third-party models listed above, called over Groq's,
Google's, and OpenRouter's APIs. Art. 53's training-data-summary (Art.
53(1)(d)) and other GPAI obligations sit with those models' own providers
(the entities that trained each model, and that operate the inference
service — Groq, Google, or whichever backend OpenRouter routes a given
`:free` model to), not with VUXIO-AI.

## Art. 50(1) — visible disclosure to natural persons

Implemented: `src/components/InputBar.tsx`, directly below the existing
"Enter para enviar · Shift+Enter para nova linha" hint line — a matching
muted `text-xs` line reading "As respostas do VUXIO são geradas por IA e
podem conter erros.", always visible under the input box in every mode.

## Art. 50(2) — machine-readable marking of AI-generated output

Implemented:
- `src/App.tsx` — `data-ai-generated="true"` set on the assistant message
  bubble `<div>` only (conditioned on `isVuxio`, i.e. `log.source ===
  'VUXIO'`), not on user message bubbles.
- `api/chat.js`, top of the exported `handler` — `res.setHeader('X-AI-Generated',
  'true')`, set before any response path (method check, rate limit, or the
  SSE stream), so it is present on every response this endpoint returns.
  Set as a header only, before `res.flushHeaders()` / the SSE stream
  starts — no new SSE event type was added, so the stream consumer needs
  no change.

## Requires human/legal review

- **Provider terms of service, not just the AI Act — added 2026-08-13,
  unresolved.** Checked OpenRouter's and Google's Gemini API terms directly
  (not from memory) before adding those two providers. Both raised a real
  question this document cannot resolve on its own:
  - OpenRouter's terms prohibit using the Service "for purposes of
    reselling API access to Models" — a multi-user app proxying many
    end users' requests through one shared OpenRouter key is at least
    arguably that, even though no money changes hands and the models used
    are the `:free` tier.
  - Google's Gemini API terms describe AI Studio / the unpaid Gemini API
    quota as being "for developers building with Google AI models for
    professional or business purposes, not for consumer use," and state
    that on unpaid usage "Google uses the content you submit... to
    provide, improve, and develop Google products" — i.e. guest and
    signed-in users' message content sent to Gemini's free tier may be
    used by Google for that purpose, which is a fact PRIVACY.md did not
    previously disclose for any provider.
  - This is not a new problem specific to Gemini/OpenRouter -- the same
    "one backend key serving many end users" architecture applied to Groq
    before this update too, and is common across AI-wrapper apps generally
    -- but it had not been checked against any provider's actual terms
    before now, for any provider, including Groq's. Read via automated
    page summarization (WebFetch), not a full manual read of either
    provider's terms by a person -- treat the quotes above as a starting
    point for that read, not as a legal conclusion. Whether this
    architecture is actually permitted, under whose account, and whether
    it needs a different API tier/agreement, is a decision for whoever
    operates this deployment, not something resolved by adding this note.
- **Art. 2(10).** Whether a given deployment/user of VUXIO-AI falls inside
  the Art. 2(10) exclusion (AI used by a natural person in a purely
  personal, non-professional activity) is not resolved here — VUXIO-AI is
  a public multi-user web app, which is a different situation from the
  VOIDSEED demo's single-purpose competition context; requires
  human/legal review.
- **Third-party model providers' own Art. 53 status.** This document does
  not audit whether `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, or
  `qwen/qwen3.6-27b`
  individually cross the Art. 51 GPAI presumption or Art. 51(2)
  systemic-risk thresholds, or what Groq's/each model provider's own Art.
  53 compliance status is — not this deployer's obligation under Art. 53,
  but worth confirming Groq's own transparency documentation (model cards,
  Art. 53(1)(d) training-data summaries where applicable) is being relied
  on correctly if that question comes up.
