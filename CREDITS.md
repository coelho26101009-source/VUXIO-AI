# Credits

## Team

**[@coelho26101009-source](https://github.com/coelho26101009-source)** — project
lead and owner of VUXIO. The product is his: what VUXIO is, how it should
behave, the mode split (Standard / Code / Web), the PT-PT-first voice, and the
call to keep it free with no account wall.

**[@otzpt](https://github.com/otzpt)** — main contributor. Most of the direction
below came from him using the app daily and finding what was broken.

Things found and driven to a fix from real use rather than from a bug report:

- **Code Mode was entirely broken.** He kept hitting failed completions; the
  cause turned out to be `groq/compound` rejecting any request carrying custom
  tools, which failed the whole response rather than just the tool call.
- **Uploading a `.c` file was rejected** as an invalid attachment, which led to
  text/code file support instead of images-only.
- **A file upload got echoed back as a download** instead of being read, which
  exposed a `create_file` instruction with no counterweight.
- **Answering "twin" with a generated file** — the same root cause, caught
  again from real use.
- **Replies came back in Portuguese for English messages**, which is why the
  language rule now mirrors the user instead of forcing PT-PT.

## AI assistance

Parts of this codebase were written with **Claude** (Anthropic), working from
otzpt's direction and bug reports. Claude wrote code and documentation; it did
not decide what the product is.

Where that help went:

| Area | What was done |
| --- | --- |
| Code Mode | Moved off `groq/compound`, which 400s on custom tools, onto the text model that already worked |
| Vision | Replaced the decommissioned `llama-3.2-11b-vision-preview`, which had been failing every image upload |
| Web Mode | Fixed Tavily auth (Bearer header, not an `api_key` body field) — searches had been silently returning nothing |
| Attachments | Added text/code file uploads (`.c`, `.py`, ~30 more) read as text rather than forced through the image path |
| `create_file` | Scoped it to messages that actually ask for a file, after it started answering greetings with downloads |
| Reasoning models | Hid `<think>` scratchpads from the streamed reply, including tags split across SSE chunks |
| Prompts | Rewrote Code Mode around root-cause-over-symptom and minimum-necessary-code; reworked web search toward synthesized answers with inline citations |
| Tests | `test/api-chat.test.js` — 10 tests pinning the bugs above so they cannot come back silently |

## Built with

- [React](https://react.dev) · [Vite](https://vite.dev) · [TypeScript](https://www.typescriptlang.org) — MIT
- [Tailwind CSS](https://tailwindcss.com) — MIT
- [lucide-react](https://lucide.dev) — ISC
- [Firebase](https://firebase.google.com) — auth and Firestore
- [Groq](https://groq.com) — inference
- [Tavily](https://tavily.com) — web search
- [Vercel](https://vercel.com) — hosting and serverless functions

## Prior art worth reading

Not dependencies and not copied from — projects in the same space whose
architecture is worth studying before adding a big feature here.

- **[LibreChat](https://github.com/danny-avila/LibreChat)** (MIT) — the closest
  comparison: a TypeScript chat UI over many providers, with agents, MCP and
  presets. MIT means patterns can be borrowed directly with attribution.
- **[Open WebUI](https://github.com/open-webui/open-webui)** — the reference for
  local-model workflows and RAG-style document handling.
- **[Jan](https://github.com/janhq/jan)** — offline-first desktop client;
  relevant if VUXIO ever grows a local-model mode.

Check each project's licence before reusing anything from it. LibreChat is MIT;
the others carry their own terms.
