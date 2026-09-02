# Career Atelier

[한국어 README](README.ko.md)

Career Atelier is a self-hosted job-application workspace driven by AI agents
that run on **your own** ChatGPT, Claude, and Gemini subscriptions — not on
metered API keys.

This README is for people who want to run it, and for people who want to help
build it. If you are looking for the setup walkthrough, jump to
[Getting started](#getting-started). If you want to understand the design first,
read [Why it is built this way](#why-it-is-built-this-way).

## What is Career Atelier?

Applying for jobs means doing the same research over and over: what does this
company actually do, what did they ship recently, which of my experiences are
relevant, what did I already write for a similar question. Career Atelier keeps
that context in one place and lets seven agents work on it.

| Agent | Does | Runs on |
|---|---|---|
| Lumi (루미) | Researches news in your field | Codex |
| Moka (모카) | Finds job postings that match your profile | Codex |
| Sol (솔) | Researches a company and role from primary sources | Claude Code |
| Muse (뮤즈) | Drafts a cover letter using only your recorded experiences | Codex |
| Lens (렌즈) | Reviews a draft for overclaims and missing evidence | Claude Code |
| Echo (에코) | Generates interview questions from the posting | Claude Code |
| Sojemok (소제목) | Suggests section headings for a finished draft | Antigravity (Gemini) |

Around them sits the workspace: an application calendar with per-stage
pass/fail tracking, an experience archive, a cover-letter editor with version
history, an interview practice room, and a prompt lab where you can edit each
agent's system prompt and roll back to any earlier version.

## Why choose Career Atelier?

- **No per-token billing.** Agents run through the CLI tools you already pay a
  subscription for. The runner strips `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and
  similar variables from child processes, verifies each CLI is on a subscription
  login before running, and halts instead of falling back to paid overage.
- **Your credentials never leave your machine.** The cloud half of the app has
  no AI credentials at all — it cannot, because the build fails if it finds any.
- **Your data is yours.** One Supabase project per person, row level security
  scoped to the owner, and an optional local folder backup so a lost cloud
  project does not take your writing with it.
- **Grounded output.** The writing agent may only cite experiences you actually
  recorded; fabricated evidence IDs are filtered out before anything is saved.

## Architecture

```
Browser ──── Vercel (web/) ──────┐
                                 │ Supabase: Postgres + Auth + RLS
Your computer ─ runner/ ─────────┘
      └─ codex / claude / agy   (subscription OAuth, stays local)
```

The web app never runs an agent. It writes a row into a job queue. The runner —
a Node process on your machine, logged in as you — claims the job, builds a
context pack, invokes the right CLI, streams output back, and writes results.
Turn the runner off and the site still works; you just cannot start new agent
runs.

## Getting started

You will need **Node.js 22+**, a free [Supabase](https://supabase.com) project,
and at least one AI CLI subscription.

```bash
git clone https://github.com/tkv00/Career-Atelier-AI-Context-Pack.git
cd Career-Atelier-AI-Context-Pack
npm run setup
```

`npm run setup` runs the same way on Windows, macOS, and Linux. It checks your
tooling, links your Supabase project, applies the database migrations, and
writes the two env files for you.

Then start the two halves:

```bash
cd web    && npm install && npm run dev     # http://localhost:3000
cd runner && npm install && npm run login && npm run start
```

The first account to sign up becomes the owner of that instance; every later
signup is rejected. Approve your runner from the dashboard once and it starts
picking up work.

Full walkthrough, including per-OS notes and the AI CLI logins:
**[docs/USER-GUIDE.md](docs/USER-GUIDE.md)**.

### Deploying the web app

Point a Vercel project at the `web/` directory and set two environment
variables — `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
Do not add a service role key or any AI provider key; the build rejects them on
purpose. See [docs/V2-SETUP.md](docs/V2-SETUP.md).

## Backing up your data

Supabase's free tier can pause an unused project, and a cloud database is a
single point of failure for work you cannot easily rewrite. Turn on **로컬 폴더
자동 백업** in the dashboard's runner section and give it an absolute folder
path. The runner writes a full JSON export there every six hours — one file per
day, so the folder does not grow without bound.

Backups are written by the runner, not the browser, because a web page cannot
write to an arbitrary folder on your disk.

## Why it is built this way

The obvious design would put everything on a server and call the OpenAI and
Anthropic APIs. That was rejected for two reasons.

**Authentication is tied to the machine.** Codex and Claude Code authenticate
through OAuth sessions stored locally. Moving those to a server means putting
long-lived credentials in server environment variables — and if that server is
compromised, so are the accounts behind them.

**Metered APIs change the cost model.** The point is to use subscriptions
already being paid for. A design that can silently fall back to per-token
billing is a design that will eventually produce a surprise invoice, so the
runner blocks that path rather than warning about it.

The result is a split: a cloud face that holds data and no credentials, and a
local face that holds credentials and runs the models.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for the
development setup and what a good pull request looks like. Everyone develops
against their own Supabase project — there is no shared dev database to break.

Good places to start:

- The runner is macOS-first in places; Windows and Linux testing is genuinely
  useful.
- Agents are defined in `runner/context-pack.mjs` and `runner/providers/`.
  Adding a provider means adding one file there.
- The interview and prompt-lab screens have the least test coverage.

## Documentation

- [User guide (Windows/macOS/Linux)](docs/USER-GUIDE.md)
- [Cloud setup — Supabase, Vercel](docs/V2-SETUP.md)
- [Design and architecture](docs/DESIGN-V2-CLOUD.md)
- [Privacy and cost guarantees](docs/PRIVACY-AND-COST.md)
- [Runner internals](runner/README.md)

## License

MIT. See [LICENSE](LICENSE).
