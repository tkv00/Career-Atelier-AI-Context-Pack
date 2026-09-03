# AGENTS.md

Instructions for AI coding agents working in this repository.

This file follows the [AGENTS.md](https://agents.md) convention and is read by
Codex, Gemini CLI, Cursor, Copilot's coding agent, Zed, Aider, and others.

<br>

## What this project is

Career Atelier is a self-hosted job-application workspace. Seven AI agents run
on the user's **own** ChatGPT, Claude, and Gemini CLI subscriptions rather than
on metered API keys.

It has two halves:

| Path | Runs where | Holds |
|---|---|---|
| `web/` | Vercel | Data. **Never AI credentials.** |
| `runner/` | The user's machine | Credentials, and the CLI processes |

The web app never invokes a model. It writes a row into a job queue; the runner
claims it, builds a context pack, runs the right CLI, and writes results back.

<br>

## Setting this up for a user

Run these in order. Steps 1 and 4 need a human — do not pretend otherwise.

### 1. Sign in to Supabase (human required)

```bash
npm install -g supabase          # if `supabase` is missing
supabase login                   # opens a browser; only they can finish it
```

Do not ask them for a project ref or an anon key. The wizard finds both.

Never ask for, accept, or write down the `service_role` key. This project does
not use it anywhere, and `web/lib/env.ts` fails the build if a key like it is
present.

### 2. Run the wizard

```bash
node scripts/setup.mjs --yes
```

`--yes` makes it fully non-interactive, which is what you want with no tty.
It checks tooling, reuses their existing Supabase project or creates
`career-atelier` and waits for it to become healthy, reads the anon key from
the CLI, applies every migration, and writes `web/.env.local` and
`runner/.env`.

`--new-project <name>` forces a fresh project, `--region` defaults to
`ap-northeast-2`, and `--project-ref` with `--anon-key` skips discovery when
the user hands you the values.

### 3. Install dependencies

```bash
cd web && npm install
cd ../runner && npm install
```

### 4. Hand back to the human

Two things you cannot do:

- **First sign-in.** Start `cd web && npm run dev`, then the human opens
  http://localhost:3000 and signs in with their own email. Sign-in is a magic
  link sent to their inbox. **The first account to sign up becomes the owner of
  that instance and every later signup is rejected**, so this must be them.
- **Runner login and approval.** `cd runner && npm run login` needs a six-digit
  code from their email. After `npm run start`, they approve the device in the
  dashboard's runner list.

Agents also need their own CLI subscriptions signed in (`codex login`,
`claude auth login`, `agy`). Those are the human's accounts; do not attempt to
authenticate as them.

<br>

## Verifying your changes

```bash
cd web && npx tsc --noEmit && npm run lint && npm run build
```

All three must pass. **They are not sufficient.** This project's bug history is
mostly defects that passed every static check and only appeared when someone ran
the thing: a context pack destructuring a key that did not exist, a CLI flag
documented to take a file path that actually takes a JSON string, a schema that
was valid JSON but rejected by the provider's API.

When you report what you did, say what you actually exercised. If you could not
run something, say that instead of implying you did.

<br>

## Conventions

**Migrations are append-only.** Add `supabase/migrations/00NN_name.sql`; never
edit an applied file. After a schema change:

```bash
supabase gen types typescript --linked > web/lib/supabase/database.types.ts
```

**Every new table needs RLS** with an owner policy, matching
`supabase/migrations/0003_rls_policies.sql`. The anon key ships in the client
bundle by design, so a table without RLS is world-readable.

**`web/` must stay free of AI credentials.** `web/lib/env.ts` throws at build
time if it finds `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, or similar. That
is a safety rail, not an obstacle to route around.

**Comments are in Korean and explain why.** The codebase documents reasoning,
especially where something non-obvious was learned by hitting it. Match that.
Do not narrate what the next line obviously does.

**Commit messages are in English**, imperative mood, with the reasoning in the
body. See [CONTRIBUTING.md](CONTRIBUTING.md) and [CONTRIBUTING.ko.md](CONTRIBUTING.ko.md).

**`README.md` and `README.ko.md` change together.** They are two languages of
the same document, not two documents. A change to one — a new section, an
updated screenshot, a corrected fact — goes into the other in the same pass.
Never leave one ahead of the other.

**No new dependencies** without a reason the standard library cannot meet.

<br>

## Things that will surprise you

Measured, not assumed. Each cost real debugging time.

- **Codex** rejects any JSON schema whose objects omit
  `additionalProperties: false` — the error comes from the OpenAI API as
  `invalid_json_schema` 400, not from the CLI.
- **Claude Code**'s `--json-schema` takes a JSON **string**, not a file path.
  A path fails with `JSON Parse error: Unrecognized token '/'`. Its
  `--output-format stream-json` also requires `--verbose`.
- **Antigravity** (`agy`, the Gemini CLI's successor) puts schema-conforming
  output in `structured_output`, not `response`. Fields with no `description`
  get filled with meta-summaries like "task complete" instead of real values.
  Its `--mode plan` is not a read-only mode; it writes a plan file and waits,
  which produces empty output in headless runs.
- `runner/schema-compat.mjs` normalises schemas so one definition works on all
  three. Use it rather than hand-tuning per provider.
- Node does not hot-reload. After editing runner code, restart `npm run start`.

<br>

## Layout

| Path | Contents |
|---|---|
| `web/app/(app)/` | App routes: dashboard, calendar, records, essays, prompts, interviews |
| `runner/index.mjs` | Job polling, claim, and the per-agent handlers |
| `runner/context-pack.mjs` | Per-agent context packs and output schemas |
| `runner/providers/` | CLI argument construction, one file per provider |
| `runner/safety.mjs` | Fixed limits and the subscription checks. Not configurable. |
| `supabase/migrations/` | Append-only SQL |
| `scripts/setup.mjs` | The installer described above |
| `docs/` | User guides, harness engineering, setup, and policies |

See `docs/HARNESS-ENGINEERING.md` and `runner/README.md` before changing runner or agent behaviour.
