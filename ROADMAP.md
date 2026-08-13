# Roadmap

Not built yet, in the order they came up. Each item names what's missing and
what it depends on -- not a promise of order, just a memory of scope.

## Guest daily limit

A daily token budget for guest (no-account) usage, enforced per IP, that a
new incognito tab can't reset. Deliberately last: the user asked to hold off
so the rest of the work stays reviewable before something that changes who
can do what gets layered in.

Real enforcement needs the backend to know for certain whether a request is
from a signed-in user, which today it doesn't -- `api/chat.js` trusts
whatever `isGuest`-shaped field the client sends, the same way it already
trusts `userName`. A client can lie. Verifying this server-side means adding
Firebase Admin SDK ID-token verification (service account credentials, a new
env var, a new dependency) before the budget itself is worth building --
otherwise it's a limit with a bypass built in.

## GitHub integration (personal access token)

Confirmed direction: a token pasted into Settings (not a GitHub OAuth App,
not a sandboxed VM -- see the architecture question this answered). With a
stored PAT, a Vercel serverless function can call GitHub's REST API directly:
read a repo's file tree (Contents API), commit changes to a new branch (Git
Data API), open a PR (Pulls API). All reachable without spinning up any
execution environment.

Storing the token itself needs care: today MCP server URLs sit in Firestore
in plain text because a URL isn't a secret. A GitHub PAT is a real
credential -- worth deciding whether it's stored encrypted, whether it's
ever sent back to the client after the first save, and what scope the
onboarding UI asks the user to grant when they generate it.

## Project files (upload, read, edit)

The recommended, in-scope version confirmed over the full-VM/autonomous-PR
diagram: a project holds uploaded files (Firebase Storage), the model can
read them as context and propose edits, extending the existing
`create_file` tool rather than introducing a new tool-calling shape. No code
*execution* -- editing and reading only, which is what keeps this buildable
inside stateless serverless functions instead of needing a real sandbox.

Concretely: Storage upload UI in ProjectsView (or a per-project detail view,
which doesn't exist yet either -- right now a project is just a name and a
description), a `list_files`/`read_file`/`edit_file` tool set scoped to the
open project's file set, and deciding the max total size per project given
Firebase Storage's free-tier quota.

## Per-project chat view

Everything above assumes a project has its own space to actually use those
files in a conversation -- that view doesn't exist. ProjectsView today is
create/list/delete only; opening a project doesn't do anything yet beyond
that. This is the natural next piece once file upload exists, since a file
with nowhere to be read from isn't useful on its own.
