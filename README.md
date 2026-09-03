<img src="docs/images/banner.png" alt="Career Atelier" width="100%">

<p>
  <img alt="license" src="https://img.shields.io/badge/license-MIT-f5a962?style=flat-square">
  <img alt="node" src="https://img.shields.io/badge/node-%E2%89%A522-5cc98f?style=flat-square&logo=node.js&logoColor=white">
  <img alt="next.js" src="https://img.shields.io/badge/Next.js-16-e6eef7?style=flat-square&logo=next.js&logoColor=white">
  <img alt="supabase" src="https://img.shields.io/badge/Supabase-Postgres%20%2B%20RLS-3ecf8e?style=flat-square&logo=supabase&logoColor=white">
  <img alt="platform" src="https://img.shields.io/badge/Windows%20%7C%20macOS%20%7C%20Linux-58cfe4?style=flat-square">
  <img alt="api billing" src="https://img.shields.io/badge/API%20billing-none-5cc98f?style=flat-square">
</p>

English · **[한국어](README.ko.md)**

---

A self-hosted job-application workspace that runs on the ChatGPT, Claude, and Gemini subscriptions you already pay for.

No metered API keys. Seven AI agents handle everything from industry research to cover-letter review and interview prep, inside your existing subscription.



<br>

## Contents

- [Why this exists](#why-this-exists)
- [The seven agents](#the-seven-agents)
- [Screens](#screens)
- [Architecture](#architecture)
- [Getting started](#getting-started)
- [Install with an AI coding agent](#install-with-an-ai-coding-agent)
- [Bulk import over MCP](#bulk-import-over-mcp)
- [Backups](#backups)
- [Why your bill does not grow](#why-your-bill-does-not-grow)
- [Contributing](#contributing)

<br>

## Why this exists

Every application repeats the same work.

Look up what the company actually does. Check what they shipped recently. Pick which of your experiences fit this role. Dig up what you wrote for a similar question last time.

Handing that to an AI usually means one of two things: pay per token with an API key, or paste your whole history into a chat window again every session.

Career Atelier is a third option. It calls the **CLI tools you already subscribe to** (Codex, Claude Code, Antigravity) on your own machine, and keeps the context in your own database.

<br>

## The seven agents

Each agent runs from the screen it belongs to. Output is validated against a JSON schema before anything is stored.

<br>

<table>
<tr>
<td width="130" align="center"><img src="docs/images/agents/agent-news.png" width="100" alt="Lumi"></td>
<td>

### Lumi — industry news research

**Runs on** Codex · **Writes to** `research_notes` (kind: `news`)

Takes the fields you listed in `context/01-interests.md` and **actually searches the web** for them. The prompt forbids answering from model memory alone, and Codex's automatic `web_search` tool does the lookup.

Returns three to five items from the last week or two, each with a title, source, real URL, and date.

Launch it from Lumi's card on the dashboard.

</td>
</tr>

<tr>
<td width="130" align="center"><img src="docs/images/agents/agent-jobs.png" width="100" alt="Moka"></td>
<td>

### Moka — job posting discovery

**Runs on** Codex · **Writes to** `job_posts` → cascades into `calendar_events`

Reads your profile and experience cards, finds matching postings, and scores each one (`fit_score`). With no experience cards recorded it scores conservatively or returns nothing rather than inflating the match.

Saving a posting immediately triggers **Nova**, which parses the deadline with regular expressions and files it on the calendar. Rolling postings with no real deadline get no calendar entry at all.

The same URL updates the existing posting instead of creating a duplicate.

**Runs automatically at 15:00 KST daily.** If your laptop was asleep it runs when you next open it that day, and skips entirely once the date rolls over.

</td>
</tr>

<tr>
<td width="130" align="center"><img src="docs/images/agents/agent-company.png" width="100" alt="Sol"></td>
<td>

### Sol — company and role research

**Runs on** Claude Code · **Writes to** `research_notes` (kind: `company`)

Give it a company and a role and it researches from **primary sources**: public filings, financial statements, engineering blogs. Every finding carries its source URL.

It goes past summarising and proposes angles you could actually write about for that specific company.

Launch it from the cover-letter editor. Its findings become evidence for Muse.

</td>
</tr>

<tr>
<td width="130" align="center"><img src="docs/images/agents/agent-writer.png" width="100" alt="Muse"></td>
<td>

### Muse — cover-letter drafting

**Runs on** Codex · **Writes to** `artifacts` (kind: `draft`)

Takes a question and a target length and writes a draft. It may **only** draw on experience cards you recorded and research Sol produced.

Three layers stop it from inventing things:

1. The prompt forbids facts outside the supplied evidence.
2. The output schema requires an `evidence` array per paragraph, naming which experience backs it.
3. **Code cross-checks every `experience_id` against your real cards** and records any that do not exist as violations.

Drafts do not apply themselves. You review the stored artifact and click to accept it.

</td>
</tr>

<tr>
<td width="130" align="center"><img src="docs/images/agents/agent-review.png" width="100" alt="Lens"></td>
<td>

### Lens — evidence review

**Runs on** Claude Code · **Writes to** `artifacts` (kind: `review`)

Reads a finished draft and flags overclaims, unsupported assertions, and poor fit for the role.

Findings are typed as `fact_error`, `overclaim`, or missing evidence, and each comes with a concrete rewrite suggestion.

Put a number in your draft that appears in none of your experience cards and Lens will catch it.

</td>
</tr>

<tr>
<td width="130" align="center"><img src="docs/images/agents/agent-interview.png" width="100" alt="Echo"></td>
<td>

### Echo — interview question generation

**Runs on** Codex · **Writes to** `interview_questions`

Reads the posting, the company research, and your experience cards together, then produces likely questions.

Questions are stored by category (company, role, experience) so you can draft and refine answers in the practice room.

</td>
</tr>

<tr>
<td width="130" align="center"><img src="docs/images/agents/agent-subtitle.png" width="100" alt="Comma"></td>
<td>

### Comma — section headings

**Runs on** Antigravity (Gemini 3) · **Writes to** `artifacts` (kind: `subtitle`)

Reads a finished cover letter and proposes headings of **15 characters or fewer**.

It compresses your own wording rather than adding claims, so Muse's three-layer evidence check does not apply here. It **refuses to run on an empty draft**.

Like every other agent, its output is a suggestion until you accept it.

</td>
</tr>
</table>

<br>

> **Which LLM each agent runs on is configurable** in the prompt studio. The table above lists the defaults.
>
> If you only subscribe to one, point all seven at it — schemas are converted to that provider's requirements automatically. An agent still needs its CLI signed in to actually run; otherwise the run fails.

<br>

## Screens

### Dashboard

All seven agents at a glance: which one is running, how the last run ended, whether the runner is connected, and how many runs you have used today.

Lumi and Moka launch directly from their own cards.

<img src="docs/images/screens/01-dashboard.png" alt="Dashboard" width="100%">

<br>

### Application calendar

Deadlines on a month grid. **Hover a date** and every posting due that day expands into a list with company, role, and current stage.

<img src="docs/images/screens/02-calendar.png" alt="Application calendar" width="100%">

<br>

### Per-stage outcomes

Outcomes are not collapsed into one pass/fail. **Resume screen, written test, coding test, technical interview, and final interview** are tracked separately.

Each chip cycles through pending → passed → failed on click.

<img src="docs/images/screens/03-stage-board.png" alt="Per-stage outcome tracking" width="100%">

<br>

### Prompt studio

Edit each agent's system prompt directly.

Every save keeps the previous body as a version you can restore at any time. Restoring is itself a new version, so nothing is ever lost.

<img src="docs/images/screens/04-prompt-lab.png" alt="Prompt studio" width="100%">

<br>

### Personal dossier

Seven sections — education, certifications, activities, training, projects, work history, and awards — each with its own fields, reached from **"My info"** in the side rail.

You stop re-finding your GPA or a certificate registration number for every application. Supporting documents such as transcripts live here too — files go to a private bucket, and opening one mints a 60-second signed link rather than exposing a public URL.

<!-- PLACEHOLDER — replace this file with a real capture. Spec: docs/images/screens/README.md -->
<img src="docs/images/screens/07-records.png" alt="Personal dossier" width="100%">

<br>

### Experience archive

Record project experience broken into context, problem, your role, judgement, actions, results, missteps, and reflection.

Only what you record here can be used as evidence by Muse.

<!-- PLACEHOLDER — replace this file with a real capture. Spec: docs/images/screens/README.md -->
<img src="docs/images/screens/05-experiences.png" alt="Experience archive" width="100%">

<br>

### Interview practice

Draft and refine answers to the questions Echo generated.

<!-- PLACEHOLDER — replace this file with a real capture. Spec: docs/images/screens/README.md -->
<img src="docs/images/screens/06-interviews.png" alt="Interview practice room" width="100%">

<br>

## Architecture

```
                    ┌──────────────────────────────┐
Browser  ────────>  │  Vercel (web/)               │
                    │  · holds data                │
                    │  · holds no AI credentials   │──┐
                    └──────────────────────────────┘  │
                                                      │  Supabase
                    ┌──────────────────────────────┐  │  Postgres + Auth + RLS
Your machine ────>  │  runner/ (Node)              │<─┘
                    │  · polls the job queue       │
                    │  · runs CLIs, stores results │
                    └───────────┬──────────────────┘
                                │
                    codex · claude · agy
                    (subscription OAuth, never leaves this machine)
```

The web app never runs an agent. It writes one row into a job queue.

The runner is a Node process on your machine, signed in as you. It claims the job, builds a context pack, invokes the right CLI, and writes the results back.

**Turn the runner off and the site still works.** You just cannot start new agent runs.

<br>

## Getting started

Four steps, in order: check the requirements below, install the CLI(s) you're missing, run the setup wizard, then start the two processes. Nothing here assumes you have installed anything before.

### Requirements

| Item | Check |
|---|---|
| Node.js 22+ | `node -v` |
| A free Supabase project | [supabase.com](https://supabase.com) |
| Supabase CLI | `npm install -g supabase` |
| At least one AI CLI | see below |

<br>

| CLI | Powers | Install · sign in |
|---|---|---|
| Codex | Lumi · Moka · Muse · Echo | `npm install -g @openai/codex` → `codex login` |
| Claude Code | Sol · Lens | `npm install -g @anthropic-ai/claude-code` → `claude auth login` |
| Antigravity | Comma | install from [antigravity.google](https://antigravity.google), then run `agy` |

You only need **one** of these working — install the CLI for whichever subscription you already pay for. An agent assigned to a CLI you skip just stays disabled; everything else still runs.

<br>

<details>
<summary><b>Never used any of these CLIs before? Expand for a from-zero walkthrough</b></summary>

<br>

Each block below assumes nothing is installed yet — only Node.js from the Requirements table above.

**Codex CLI (OpenAI)** — needs a ChatGPT Plus, Pro, Team, or Business subscription.

```bash
npm install -g @openai/codex
codex --version
codex login
```

`codex login` opens your browser. Sign in with the same ChatGPT account as your subscription, and pick the subscription option rather than an API key — this project refuses API-key billing on purpose, so an API-key login will not work here even if you complete it.

**Claude Code CLI (Anthropic)** — needs a Claude Pro or Max subscription.

```bash
npm install -g @anthropic-ai/claude-code
claude --version
claude auth login
```

Same shape: browser opens, sign in with your Claude account, choose the subscription login.

**Antigravity CLI (Google)** — needs a Google account.

```bash
# macOS / Linux
curl -fsSL https://antigravity.google/cli/install.sh | bash
```

Antigravity is not an npm package, so on Windows download the installer from [antigravity.google](https://antigravity.google) and follow its prompts instead. Either way, finish with:

```bash
agy --version
agy
```

The first `agy` run opens your browser for Google sign-in.

**If a command says "not recognized" or "command not found" right after installing**

Your terminal opened before the install and has not picked up the new PATH entry. Close it and open a fresh one, then retry the `--version` check — this is by far the most common cause, on every OS.

**If `npm install -g` fails with a permission error on macOS or Linux (`EACCES`)**

Do not re-run it with `sudo` — that hands ownership of files under your Node install to root and causes more permission errors later. Install Node via [nvm](https://github.com/nvm-sh/nvm) instead; it lives entirely under your home directory, so global installs need no elevated permission at all.

Sign-in is one-time per CLI. It survives runner restarts, so you will not repeat these steps for every agent run — only once, ever, per machine.

Once at least one CLI logs in successfully, move on to "Install — three commands" below — that step connects Supabase, and does not touch the CLIs at all.

</details>

<br>

### Install — three commands

The same on Windows, macOS, and Linux.

```bash
git clone https://github.com/tkv00/Career-Atelier-AI-Context-Pack.git
cd Career-Atelier-AI-Context-Pack
npm run setup
```

**You never open the Supabase dashboard or copy a key.** Sign in once in the browser and the wizard does the rest:

1. Check Node, the Supabase CLI, and your AI CLIs
2. Sign in to Supabase (opens a browser once)
3. Pick a project, or **create one** and wait until it is ready
4. **Read the anon key directly** from the CLI
5. Apply tables, row level security, and the default prompts
6. Write `web/.env.local` and `runner/.env`

> The database password is generated at random and stored nowhere. The `service_role` key is never even read.

<br>

### Install with an AI coding agent

Paste this one line into Codex, Claude Code, Gemini CLI, Cursor, or any coding agent with terminal access:

```text
Install Career Atelier by reading and following these instructions: https://raw.githubusercontent.com/tkv00/Career-Atelier-AI-Context-Pack/refs/heads/main/docs/AI-INSTALL.md
```

An agent can also do the whole thing without stopping to ask, by running these in order. `--yes` means the wizard never waits on a prompt:

```bash
git clone https://github.com/tkv00/Career-Atelier-AI-Context-Pack.git
cd Career-Atelier-AI-Context-Pack
npm run setup -- --yes
```

The agent will check prerequisites, clone the official repository, install locked dependencies, run the existing setup wizard, and verify the build. The runbook forbids API keys, destructive Git operations, silent environment-file overwrites, and automatic deployment. Login and account-ownership confirmations intentionally remain manual. You can inspect the complete instructions before using them: [docs/AI-INSTALL.md](docs/AI-INSTALL.md).

> Run this only in a coding agent that has local terminal access. A normal web chat cannot install software on your computer.

Once the repo is cloned there is nothing to paste. [AGENTS.md](AGENTS.md) at the root is picked up automatically by Codex, Gemini CLI, Cursor, Copilot's coding agent, Zed, and Aider — it is the [AGENTS.md convention](https://agents.md), used by over 60,000 repositories. Claude Code reads [CLAUDE.md](CLAUDE.md), which points at the same file so the two cannot drift.

<br>

### Run

You need two terminals.

```bash
# terminal 1 — web app
cd web
npm install
npm run dev
```

```bash
# terminal 2 — runner
cd runner
npm install
npm run login
npm run start
```

Open http://localhost:3000 and create an account with your own email and a password.

> **The first account to sign up becomes the owner of that instance, and every later signup is rejected.** Make sure the first sign-up is yours.

Finally, **approve** this machine in the runner list at the bottom of the dashboard. Once per device.

<br>

### Deploying

Point a Vercel project at the `web/` directory and set two environment variables.

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Do not add a service role key or any AI provider key. **The build rejects them on purpose** (`web/lib/env.ts`).

Details in [docs/V2-SETUP.md](docs/V2-SETUP.md).

<br>

## Bulk import over MCP

Your experience notes probably already exist somewhere — a Notion page, a Markdown file you have been adding to for months. Retyping them into seven different screens is the worst possible first hour with this app.

Career Atelier ships its own **MCP server** that reads those notes and writes them straight into the right tables.

### What kind of MCP server this is

It is a **local, tool-only MCP server** that speaks JSON-RPC 2.0 over stdio. It exposes three tools and no resources or prompts. It has **zero dependencies** — the protocol is implemented directly, and the Supabase client is the one the runner already uses.

The point is not convenience, it is **token cost**. Ask an agent to "read these notes and put them in the database" and the whole document enters the model's context, then the model has to restate it as structured insert arguments — the source is paid for roughly two and a half times. This server reads the source itself and writes the rows itself, so the model only ever sees a path going in and a short receipt coming back. **The source text never enters the model's context at all.**

Measured on a 2,215-character note file producing 12 records across 9 tables:

| | Tokens |
|---|---:|
| Agent doing it directly | 3,006 |
| Through this MCP server | 114 |
| Reduction | **96.2%** |

Direct file parsing keeps token consumption to a minimum.

### It is not Claude-only

There is no Anthropic SDK in it. Any MCP-capable client works, including all three CLIs this project already uses:

| Client | Register with |
|---|---|
| Claude Code | already registered in `.mcp.json` at the repo root |
| Codex | `codex mcp add career-atelier -- node <repo>/runner/mcp/server.mjs` |
| Antigravity | `agy mcp add career-atelier -- node <repo>/runner/mcp/server.mjs` |

Cursor, Windsurf, Cline, and Zed connect the same way.

### The three tools

| Tool | What it does |
|---|---|
| `preview_import` | Shows what would be saved. Writes nothing. |
| `import_records` | Saves. **Defaults to `dry_run: true`** — you must pass `dry_run: false` to actually write. |
| `db_snapshot` | Row count per table, for before/after comparison. |

Re-importing the same notes updates the matching rows instead of duplicating them, so running it twice is safe.

### Note format

One heading level picks the table, the next starts a record, and `- key: value` lines fill the fields. [`runner/mcp/fixtures/sample-notes.md`](runner/mcp/fixtures/sample-notes.md) is a complete working example.

```markdown
# Experience
## Running a campus study group
- Situation: attendance had fallen to 40% over three months
- Result: back to 85% after three months
- Metrics: attendance 40%->85%, members 12->19
```

Recognised sections: profile, education, certifications, external activities, training, projects, work history, awards, and experience cards. Field names accept several aliases. **Anything it cannot place is reported back in a `skipped` list rather than dropped silently.**

### Using it from a terminal instead

```bash
cd runner
node mcp/server.mjs preview --source /path/to/notes.md
node mcp/server.mjs import  --source /path/to/notes.md --write
```

### Reading from Notion

Create an internal integration, **share the page with it** (Notion hides anything unshared from the API), add `NOTION_TOKEN=secret_...` to `runner/.env`, then pass `notion://page/<id>` or `notion://database/<id>` as the source.

<br>

## Backups

Supabase pauses free-tier projects that go unused, and a single cloud database is a single point of failure for writing you cannot easily reproduce.

Turn on **local folder backup** in the dashboard's runner section and give it an absolute path.

- macOS · Linux — `~/career-atelier-backups`
- Windows — `C:\career-atelier-backups`

While the runner is up it writes a full JSON export every 2 hours, one file per day so the folder stays bounded.

> The runner writes backups, not the browser, because a web page cannot write to an arbitrary folder on your disk. **No runner, no backup.**

<br>

## Why your bill does not grow

"No extra cost" means **no per-token API billing**. Your subscription fee is unchanged, and your plan's usage limits still apply.

What the runner enforces:

- **Strips API key variables** such as `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` from child processes.
- **Verifies each CLI is on a subscription login** before running. If not, it does not run.
- **Halts immediately** when Claude signals paid overage.
- Stops at `waiting_for_reset` when you hit a usage limit, rather than falling back to an API.

These are fixed in code and cannot be switched off from the UI.

| Safety limit | Value |
|---|---|
| Runs per day | 40 |
| Concurrent runs | 1 |
| Single run timeout | 15 min |
| Retries | 0 |
| Job expiry | 6 hours |

<br>

## Contributing

Contributions are welcome — bug reports, but just as much a design change, a new feature, or a fix to how an existing one behaves. Development setup and PR expectations are in [CONTRIBUTING.md](CONTRIBUTING.md) and [CONTRIBUTING.ko.md](CONTRIBUTING.ko.md).

Everyone develops against their own Supabase project, so **there is no shared dev database to break.**

<br>

## Documentation

| Document | Description |
|---|---|
| [docs/USER-GUIDE.md](docs/USER-GUIDE.md) | Per-OS installation and usage guide |
| [docs/AI-INSTALL.md](docs/AI-INSTALL.md) | Safe installation runbook for AI coding agents |
| [docs/V2-SETUP.md](docs/V2-SETUP.md) | Supabase and Vercel manual setup and deployment |
| [docs/PRIVACY-AND-COST.md](docs/PRIVACY-AND-COST.md) | Privacy model and zero-cost guarantee |
| [docs/HARNESS-ENGINEERING.md](docs/HARNESS-ENGINEERING.md) | Harness engineering and agent architecture guide |
| [runner/README.md](runner/README.md) | Runner internals and execution guide |
| [runner/mcp/README.md](runner/mcp/README.md) | MCP server tools and note format conventions |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contribution guidelines (English) |
| [CONTRIBUTING.ko.md](CONTRIBUTING.ko.md) | Contribution guidelines (Korean) |

<br>

## License

MIT License - [LICENSE](LICENSE)
