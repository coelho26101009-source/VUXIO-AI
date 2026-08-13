export type MessageSource = 'USER' | 'VUXIO' | 'SYSTEM' | 'ERROR';

export interface SearchSource {
  title: string;
  url: string;
  content?: string;
}

export interface GeneratedFile {
  filename: string;
  content: string;
}

export interface LogMessage {
  id: string;
  source: MessageSource;
  text: string;
  timestamp: string;
  sources?: SearchSource[];
  file?: GeneratedFile;
  // Which Groq model actually answered -- only meaningful for VUXIO replies,
  // and always set (even under Auto routing) via the backend's `model` SSE event.
  usedModel?: string;
  // Set on replies produced in research mode. Persisted so the PDF export
  // stays available after a chat is reloaded, not just in the live session.
  isReport?: boolean;
}

export interface Chat {
  id: string;
  title: string;
  isCodeMode?: boolean;
  // Epoch ms. Undefined only for the brief window between optimistic local
  // creation and the Firestore snapshot echoing serverTimestamp() back --
  // the Conversas list sorts those to the top rather than crashing on it.
  updatedAt?: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  // Same undefined-during-optimistic-write caveat as Chat.updatedAt.
  updatedAt?: number;
}

export interface Attachment {
  file: File;
  base64: string;
  // Set instead of base64 for code/text files -- read as plain text and
  // injected directly into the message rather than sent as image_url, since
  // a vision model can't meaningfully accept source code as an "image".
  text?: string;
}

export interface Memory {
  id: string;
  text: string;
  createdAt: number;
}

// Only remote HTTP MCP servers -- a browser can't spawn a stdio subprocess.
export interface McpServer {
  id: string;
  name: string;
  url: string;
}

// groq/compound and groq/compound-mini are deliberately excluded: they reject
// any request carrying custom tools (create_file, offered in every mode) with
// a 400 that fails the whole completion -- see api/chat.js's COMPOUND_MODEL guard.
// Kept in sync with SELECTABLE_MODELS in api/chat.js -- the backend rejects
// anything outside that list. The two llama-3.x entries were dropped on
// 2026-08-13 ahead of Groq shutting them down on 2026-08-16; see the comment
// there. Settings saved with a retired id are coerced back to 'auto' on load
// (useSettings), so an old value can't 400 every request.
// Four Gemini models added 2026-08-13, all verified free-tier against
// Google's own pricing page (ai.google.dev/gemini-api/docs/pricing):
// gemini-2.5-pro, gemini-3.7-flash (latest Flash), gemini-3.6-flash
// (previous-gen Flash), gemini-3.5-flash-lite (Google's own "most
// cost-efficient GA model" pick). gemini-3.1-pro-preview was the model
// originally asked for here but turned out paid-only on that same pricing
// page -- the free-tier column reads "Not available" for it specifically,
// unlike the stable, non-preview 2.5-pro, which does have free access (an
// earlier pass wrongly generalized from 3.1-pro-preview alone to "no free
// Gemini Pro exists" without checking 2.5-pro separately). See the
// InputBar.tsx MODEL_TIERS comment for the account-only gating these four
// sit behind, and providerForModel in api/chat.js for how a 'gemini-*' id
// gets routed server-side. Not part of Auto routing, which stays Groq-only.
// 14 OpenRouter free models added 2026-08-13, pulled from OpenRouter's live
// public catalog (openrouter.ai/api/v1/models) and filtered to 0-cost text
// chat/reasoning/coding models -- see the OPENROUTER_MODELS comment in
// api/chat.js for the four free-priced entries deliberately excluded (two
// music-generation models, a moderation classifier, and a randomized
// meta-router). Every id ends in ':free', which is also how the backend
// tells these apart from Groq's own 'openai/gpt-oss-20b' (no suffix) despite
// sharing the same 'openai/' namespace -- see providerForModel there.
export type SelectableModel = 'auto' | 'openai/gpt-oss-120b' | 'openai/gpt-oss-20b'
  | 'gemini-2.5-pro' | 'gemini-3.7-flash' | 'gemini-3.6-flash' | 'gemini-3.5-flash-lite'
  | 'nvidia/nemotron-3-ultra-550b-a55b:free' | 'nvidia/nemotron-3-super-120b-a12b:free'
  | 'poolside/laguna-s-2.1:free' | 'google/gemma-4-31b-it:free' | 'google/gemma-4-26b-a4b-it:free'
  | 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free' | 'poolside/laguna-xs-2.1:free'
  | 'cohere/north-mini-code:free' | 'nvidia/nemotron-3-nano-30b-a3b:free'
  | 'nvidia/nemotron-3.5-lightning:free' | 'nvidia/nemotron-nano-12b-v2-vl:free'
  | 'nvidia/nemotron-nano-9b-v2:free' | 'liquid/lfm-2.5-2.6b:free' | 'openai/gpt-oss-20b:free';

export interface Settings {
  defaultMode: 'standard' | 'code';
  temperature: number;
  memoryEnabled: boolean;
  selectedModel: SelectableModel;
}

// Parsed from Groq's x-ratelimit-* response headers (see parseGroqLimits in
// api/chat.js). limit/remaining-requests are Requests Per Day; limit/remaining
// -tokens are Tokens Per Minute. Undefined fields mean that header was absent
// on the last response, not that the limit is zero.
export interface GroqLimits {
  limitRequests?: number;
  remainingRequests?: number;
  resetRequestsSeconds?: number;
  limitTokens?: number;
  remainingTokens?: number;
  resetTokensSeconds?: number;
}
