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
supabase login                   # opens a browser; only they can finish it
```

If `supabase` is missing, follow the [official OS-specific installation guide](https://supabase.com/docs/guides/local-development/cli/getting-started) and make it available on PATH.

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

For an existing configured installation, `npm start` fingerprints the local
migration set before launching services. When it changes after an update, the
launcher runs the wizard's migration-only path against the project already in
the local env files; it never creates a replacement project during this path.

### 3. Install dependencies

```bash
cd web
npm install
cd ../runner
npm install
```

### 4. Hand back to the human

Two things you cannot do:

- **First sign-up.** Have them run `npm start` from the repository root on Windows, macOS, or Linux. It prepares dependencies and starts the web app and runner together. Then the
  human opens http://localhost:3000 and creates an account with their own email
  and a password. **The first account to sign up becomes the owner of that
  instance and every later signup is rejected**, so this must be them.
- **Runner login and approval.** The same `npm start` terminal requests login if its session is missing or expired. It needs the
  email and password they chose in the web signup form. The password input is hidden.
  Supabase dashboard and database passwords are different credentials. They approve the
  device in the dashboard's runner list.

Ctrl+C stops both local services. For a deployed web app, `npm run runner` starts only the local runner. Existing subdirectory commands remain available for development and unattended use.

Agents also need their own CLI subscriptions signed in (`codex login`,
`claude auth login`, `agy`). Those are the human's accounts; do not attempt to
authenticate as them.

<br>

## Verifying your changes

Run this from the repository root before you report anything:

```bash
npm run verify
```

It runs, in order: version consistency, the project rules, the tooling and
runner tests, and `web`'s typecheck, lint, and build. To run only the rules
while you work — they are fast and need no install:

```bash
npm run rules                          # everything checkable from the tree
npm run rules -- --base origin/main    # adds the history-aware checks CI runs
npm run rules -- --list                # what the rules are
```

Each rule prints the file, the problem, and the fix. They are the conventions
below turned into executable checks, so an agent that cannot run the app can
still prove it did not break the invariants. Every rule is described in
[docs/AGENT-RULES.md](docs/AGENT-RULES.md), which is generated from
`scripts/lib/rules.mjs` — change the rule, then run `npm run rules:docs`.

The web checks on their own, if that is all you touched:

```bash
cd web
npx tsc --noEmit
npm run lint
npm run build
```

All of these must pass. **They are not sufficient.** This project's bug history is
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

**Keep all README language editions synchronized.** `README.md` is the Korean
default, `README.ko.md` mirrors it for existing links, and `README.en.md` is the
English translation. A new section, updated screenshot, or corrected fact goes
into all three in the same pass. Never leave one edition ahead of another.

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
| `scripts/lib/rules.mjs` | The conventions above, as executable checks. `docs/AGENT-RULES.md` is generated from it |
| `.claude/commands/` | Shared task recipes: `/verify`, `/migration`, `/new-agent`, `/new-provider`, `/new-rule` |
| `docs/` | User guides, harness engineering, setup, and policies |

See `docs/HARNESS-ENGINEERING.md` and `runner/README.md` before changing runner or agent behaviour.

<br>

## Contributing as an agent

This repository expects agent-written pull requests and checks them the same way
as any other. `docs/AGENT-CONTRIBUTING.md` describes the loop; the short version:

1. Read this file and `docs/AGENT-RULES.md` before editing.
2. Run `npm run rules` while you work, and `npm run verify` before you report.
3. Fix causes, not checks. If a rule is wrong for your change, leave it failing
   and argue the case in the pull request instead of editing
   `scripts/lib/rules.mjs` to go green.
4. Adding a convention means adding a rule (`/new-rule`), with a test that fails
   before your fix. A rule nothing can violate is not a rule.
