# GDPR (Regulation (EU) 2016/679) — VUXIO-AI

Written 2026-08-12. Not legal advice, and not this contributor's own
compliance sign-off — this document is a starting point for whoever
controls this deployment (the project's deployer/leader) to review and
finish. The **controller** under GDPR is that person/entity, not the
author of this file.

## What's collected

VUXIO-AI does not require signing in — there's a "Continuar sem conta" guest
mode (`src/components/LoginScreen.tsx`). Google sign-in
(`src/hooks/useAuth.ts`, `signInWithPopup`/`signInWithRedirect`) is
available for anyone who wants their history saved. Guest sessions never
reach Firestore: `useChat.ts`'s `sendMessage` captures the signed-in `uid`
at the moment a message is sent (not after the reply streams back, which
would let a guest who signs in mid-reply have that message saved despite
what the UI told them), and skips the Firestore write entirely when there
is none. Signed-in usage writes to Cloud Firestore under `users/{uid}`:

- **Account fields** (`useChat.ts`'s `subscribeToChats`, `useSettings.ts`):
  `email`, `displayName`, `lastSeen`, app `settings`, saved `memories`, and
  configured `mcpServers`.
- **Full chat transcripts** (`useChat.ts`'s `persist()`): every user and
  assistant message, with a Firestore `serverTimestamp()`, under
  `users/{uid}/chats/{chatId}/messages`. This includes message text,
  attached-file metadata, cited sources, and generated files — not just
  metadata.

Deleting a chat (`deleteChat()`) removes that chat's messages and chat
document from Firestore. There is no bulk export or account-deletion flow
in the code — see "Retention" below.

**Firebase Analytics:** grepped `src/` for `getAnalytics` and
`firebase/analytics` — neither appears anywhere. `src/firebase.ts` only
calls `initializeApp`, `getAuth`, and `getFirestore`. The `measurementId`
in `firebaseConfig` is present but unused: Analytics is configured in the
Firebase project but **not initialized in this codebase**, so it does not
run.

## Legal basis — open question

Two candidates, not resolved here:
- **Art. 6(1)(a) (consent)** — the user actively chooses "Entrar com o
  Google" knowing (per the disclosure now on `LoginScreen.tsx` and
  `InputBar.tsx`) that conversations are saved to their account.
- **Art. 6(1)(b) (contract)** — saving chat history could be framed as
  necessary to perform the service the user asked for (a chat app with
  persistent history).

Which one actually applies — or whether both do, for different parts of
what's collected — is a legal judgment call for the controller, not
something this audit asserts.

## Retention (Art. 5(1)(e) — gap)

**Indefinite.** Nothing in the code expires a chat, a message, or the
`users/{uid}` account document. The only deletion path is per-chat, user-
initiated (`deleteChat()`); there is no scheduled cleanup, no account-level
"delete everything," and no export function.

This means:
- **Art. 17 (right to erasure)** is only partially implemented — a user
  can delete individual chats while signed in, but there is no single
  "delete my account and all its data" action, and no server-side process
  to guarantee stray data (e.g. the `users/{uid}` doc itself) is removed.
- **Art. 20 (data portability)** is **not implemented** — no export
  feature exists anywhere in `src/`.

Both are gaps to build, not features to document as done.

## International transfer (Art. 44 et seq.)

**Unknown — requires human/legal input.** The Firestore region is set in
the Firebase console, not in this repository; nothing in `src/firebase.ts`
or elsewhere in the code specifies a region. Whether Standard Contractual
Clauses or another Chapter V transfer mechanism applies depends on that
region and on Google's own processor terms for the Firebase project in
use — not something this audit can determine by reading source code.

## Rights (Art. 12-22)

For a signed-in user, the data is identifiable (tied to a Google account,
via `uid`), so Art. 15 (access), Art. 16 (rectification), and Art. 17
(erasure, for individual chats today) are at least partially actionable
through the app itself. A full erasure or access request would currently
need manual handling by whoever operates the Firebase project, since
there's no "export/delete everything" self-service flow (see Retention).

For a guest session, no Firestore write happens at all (confirmed in
`useChat.ts`), so there is no stored personal data to act on for that
session.

## Requires human/legal review

- **Legal basis.** Pick one of Art. 6(1)(a)/(b) above (or document that
  both apply, to which data) — not decided by this audit.
- **Retention policy.** Decide an actual retention period (or an explicit
  "indefinite, by design" decision) and, if the former, build the
  deletion job — no such job exists today.
- **Art. 17/20 gaps.** Build account-level erasure and export, or document
  why they're out of scope for this deployment's size.
- **International transfer.** Confirm the Firestore project's region and
  the applicable Chapter V transfer mechanism, if any — not visible from
  the code.
- **Controller identity.** This document assumes the project's
  deployer/leader is the controller under Art. 4(7). Confirm that's
  correct for however VUXIO-AI is actually being run and by whom.
