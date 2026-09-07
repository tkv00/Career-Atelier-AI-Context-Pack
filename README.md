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

**Bring your job search into one workspace of your own.**

Connect the resume and experience notes in Notion, postings on job boards, deadlines in your calendar, and cover letters in ChatGPT or Claude. Career Atelier is an open-source workspace that stores your material in your own Supabase project and runs research, drafting, and review through AI CLIs on your computer.

**Your experience. Your voice. The AI you already use.** Run seven assistants with an eligible AI account's CLI allowance, without subscribing to another dedicated cover-letter service.

[Start installing](#getting-started) · [Read the FAQ](#frequently-asked-questions) · [Import Notion notes](#bulk-import-over-mcp)



<br>

## Contents

- [Why this exists](#why-this-exists)
- [Your first workflow](#your-first-workflow)
- [Frequently asked questions](#frequently-asked-questions)
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

Resume details and experience notes lived in Notion. Job postings and application stages lived in another spreadsheet. Company research and cover letters piled up in GPT or Claude conversations. Every application meant switching tabs, copying the same material, and explaining my background to an AI again.

Career Atelier brings that work together. An experience recorded once becomes evidence for research and drafting; a saved posting connects to deadlines and interview preparation. Spend less time moving your material and more time deciding what it says about you.

| What you need | What changes with Career Atelier |
|---|---|
| Organised material | Keep resume records, experience, postings, deadlines, and drafts together. Import existing notes over MCP. |
| Writing grounded in your background | Use saved experiences and company research as evidence, then have a reviewer check for overclaims. |
| Your voice and choice of AI | Set each assistant's prompt, provider, model, and reasoning effort. |
| Ownership of your data | Each user runs their own Supabase project and login account. |
| Access beyond your desk | Deploy to Vercel to view and edit remotely; an online runner handles AI work. |

<br>

## Your first workflow

1. **Install your workspace:** use the [setup wizard](#getting-started) to connect Supabase and create your own account. For AI features, also sign in to a CLI and approve your runner device.
2. **Add your background:** enter target roles and interests in the dashboard, save resume records in My info, and record real situations, decisions, actions, and results as experience cards. [Import existing notes over MCP](#bulk-import-over-mcp) if you have them.
3. **Assign your assistants:** in the prompt studio, assign each assistant to a CLI you have signed in to. Save your preferred writing style and criteria.
4. **Find a posting:** ask Moka to search. Saved postings with valid deadlines connect to the calendar. Choose a posting and prepare your cover-letter questions.
5. **Run research through review:** enter the company, role, and job description in the cover-letter editor, then choose **「기업 조사부터 소제목까지 실행 (솔)」** (run from company research through section headings). Sol → Muse → Lens → Comma run in order.
6. **Make it your own:** inspect and apply the draft and review, track application stages, and prepare interview answers. You submit the final application yourself.

Moka's discovery and the cover-letter chain are separate steps. Finding a posting does not automatically draft an application for every result. Muse stops if there are no experience cards, so add evidence first.

<br>

## Frequently asked questions

### Can other people see my cover letters?

**They are stored in your own Supabase project.** The installed owner-only signup restriction and row level security (RLS) allow the authenticated owner to read and write their records. Open-source users do not share a central application database, and publishing the repository does not publish the database contents.

When you run AI features, the experiences, drafts, and research needed for that task are sent to the selected AI provider. Private database storage and provider processing are separate; you manage your account and access permissions.

### I already pay for GPT or Claude. Do I need another AI subscription?

**Career Atelier charges no subscription or per-token API fee.** Sign in to a supported CLI with your own AI account. Use the subscription you already have for evidence-based drafting and review in one place. Your AI plan's limits still apply; Supabase and Vercel costs depend on the plans and usage you choose.

### Can it write in my usual voice?

Edit and save each assistant's prompt in the prompt studio. For example, tell Muse to use short sentences, lead with your decisions and actions, and avoid unsupported superlatives. **Saved settings are read by subsequent runs**, not injected into a task already running. You can restore earlier prompt versions.

Provider, model, and reasoning effort are also configurable per assistant. Prompts are stored per assistant, so adjust them when switching providers. This changes Career Atelier's instructions, not your personal settings on the ChatGPT or Claude website.

### Does it only work on my local computer?

[Deploy the web app to Vercel](#deploying) to sign in from another computer or mobile browser, manage records and deadlines, and write or edit drafts manually. **AI generation needs an internet-connected computer running the runner and authenticated AI CLI.** That runner processes requests sent from elsewhere. A computer that is off or asleep cannot process them, and queued jobs have a six-hour expiry.

### I do not know where to start, and writing takes too long.

Find a posting with Moka, prepare your experiences and questions, and start Sol's chain. **Company research → evidence-based draft → evidence review → section headings** run in sequence. You do not have to copy the material into another chat at every step. Check the facts and your intended meaning yourself; review does not guarantee accuracy or submit applications automatically.

### I only use Codex, or only Claude. Is that enough?

Yes. Assign all seven assistants to a provider you have signed in to, or mix providers by role. Use model names and effort settings supported by that CLI. The provider assignments in this README are defaults.

### Can I start without a paid AI subscription?

As checked on 2026-09-06, **Codex is included in ChatGPT Free**. Sign in to Codex CLI with a free account and work within its allowance. Check [OpenAI's official guide](https://learn.chatgpt.com/docs/pricing) for model availability and limits. **The free Claude plan does not include Claude Code.** This project's Claude path requires an eligible subscription login. [Claude's official guide](https://code.claude.com/docs/en/setup)

You can also manage resume records, experience, postings, deadlines, and drafts manually without AI. The web app's manual features do not need a running AI CLI or runner.

### What if I lose my Supabase data?

Enable local folder backup in the dashboard. While running, the runner exports selected tables to JSON **every two hours**; the current implementation is not a six-hour schedule. It updates the same day's file and creates a new file on a new date. This is not complete recovery covering all resume records and attachments; check the [backup scope](#backups).

### Can it find postings and add their deadlines to my calendar?

Moka searches using your target roles, interests, and experience, then saves results. Postings with valid deadlines connect to the calendar automatically. Rolling postings without dates do not get invented deadlines. You can search from the dashboard; an approved, running runner also supports daily discovery at 15:00 KST.

### The runner is connected, but the assistants are not moving.

A connection means the runner is ready. Request a task with a run button and the assistant becomes active when it executes. If it stays queued, check device approval in the dashboard, runner terminal errors, the selected CLI's login, and usage limits in the activity log.

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

<img src="docs/images/screens/01-dashboard.png?v=0750026" alt="Dashboard" width="100%">

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
<img src="docs/images/screens/07-records.png?v=0750026" alt="Personal dossier" width="100%">

<br>

### Experience archive

Record project experience broken into context, problem, your role, judgement, actions, results, missteps, and reflection.

Only what you record here can be used as evidence by Muse.

<!-- PLACEHOLDER — replace this file with a real capture. Spec: docs/images/screens/README.md -->
<img src="docs/images/screens/05-experiences.png?v=0750026" alt="Experience archive" width="100%">

<br>

### Interview practice

Draft and refine answers to the questions Echo generated.

<!-- PLACEHOLDER — replace this file with a real capture. Spec: docs/images/screens/README.md -->
<img src="docs/images/screens/06-interviews.png?v=0750026" alt="Interview practice room" width="100%">

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
| Node.js 22.13+ | `node -v` |
| A free Supabase project | [supabase.com](https://supabase.com) |
| Supabase CLI | `npm install -g supabase` |
| At least one AI CLI for AI features | see below |

<br>

| CLI | Powers | Install · sign in |
|---|---|---|
| Codex | Lumi · Moka · Muse · Echo | `npm install -g @openai/codex` → `codex login` |
| Claude Code | Sol · Lens | `npm install -g @anthropic-ai/claude-code` → `claude auth login` |
| Antigravity | Comma | install from [antigravity.google](https://antigravity.google), then run `agy` |

You only need **one** of these working. Install a CLI your account can use and assign the assistants you want to that provider in the prompt studio. Tasks assigned to a CLI you have not signed in to cannot run.

<br>

<details>
<summary><b>Never used any of these CLIs before? Expand for a from-zero walkthrough</b></summary>

<br>

Each block below assumes nothing is installed yet — only Node.js from the Requirements table above.

**Codex CLI (OpenAI)** — sign in with a ChatGPT account. Free accounts are supported; model availability and usage limits vary by plan. [Current availability](https://learn.chatgpt.com/docs/pricing)

```bash
npm install -g @openai/codex
codex --version
codex login
```

`codex login` opens your browser. Choose **ChatGPT account login**. This project refuses API-key billing, so an API-key login will not work here even if you complete it.

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

Sign in to each CLI you use. Sessions normally survive runner restarts; sign in again if a session expires or access is revoked.

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

**Sign in to Supabase once; the wizard reuses the CLI login.** It reads the anon key automatically and does the rest:

1. Check Node, the Supabase CLI, and your AI CLIs
2. Sign in to Supabase (opens a browser once)
3. Pick a project, or **create one** and wait until it is ready
4. **Read the anon key directly** from the CLI
5. Apply pending migrations (tables, row level security, and default prompts) through the HTTPS Management API
6. Apply email templates, the single-owner signup guard, and SMTP settings
7. Write `web/.env.local` and `runner/.env`
8. Show the web signup link — choose your own email and password there once, then use the same credentials for the runner

Database ports 5432/6543 and an existing project's database password are not needed for migrations. The wizard reads the CLI login from the OS credential store (Windows Credential Manager, macOS Keychain, or Linux `secret-tool`) or the CLI's fallback token file. `SUPABASE_ACCESS_TOKEN` in the current shell takes precedence; if the credential store cannot be read, the wizard explains how to sign in again or supply that token. The management token is never written to the web or runner environment files. Only the official `supabase` cloud profile is supported.

Re-running setup skips recorded migrations. Each migration and its history entry commit together; a timeout stops setup, and the next run checks the history before proceeding. Existing tables without migration history, or a history that differs from the local migration sequence, require a schema/history review. Setup stops without resetting data or generating a full SQL file to paste. See [setup troubleshooting](docs/USER-GUIDE.md). `--skip-migrations` bypasses this verification and is only for installations whose migrations were independently verified.

The wizard no longer creates temporary service passwords. Supabase dashboard credentials, the database password, and your Career Atelier account are separate. A new email needs **Create account** first. Each project accepts only its first owner account. Existing users should sign in or reset their password. Signup without an authenticated session stays on the confirmation screen instead of opening the dashboard.

If web login works but runner login fails, compare the project host shown under **Having trouble signing in?** on the login page with the runner's project host. Match `NEXT_PUBLIC_SUPABASE_URL` in `web/.env.local` and `SUPABASE_URL` in `runner/.env`, then restart both. Password entry in the runner is hidden; enter your service password, not the login URL. Once signed in, the saved runner session is reused. See [authentication troubleshooting](docs/AUTH-TROUBLESHOOTING.md).

> The database password is generated at random and stored nowhere. The `service_role` key is never even read.

**Password-reset emails work out of the box**, using Supabase's built-in mailer — but it's capped at 2 emails per hour, which is fine for actual use (you only reset a forgotten password occasionally) but tight while you're testing the sign-up flow repeatedly. For a higher limit, sign up for a free [Resend](https://resend.com) account, copy `supabase/.env.example` to `supabase/.env`, fill in `RESEND_API_KEY` and the site URL fields, then run `supabase config push`.

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

Before running the runner login command, open the web address printed by Next.js (usually http://localhost:3000). Choose **Create account** and set your own email and password. If you already have an account, sign in with it. The runner uses those same credentials.

> **The first account to sign up becomes the owner of that instance, and every later signup is rejected.** Make sure the first sign-up is yours.

Finally, **approve** this machine in the runner list at the bottom of the dashboard. Once per device.

<br>

### Deploying

Optional — the runner needs your machine, but the web app works fine as `localhost:3000` only. Deploy it if you want to open your calendar or a draft from outside your home or office; the runner does not need to be running for that.

```bash
npm run deploy
```

This installs the Vercel CLI's project link into `web/` directly — no GitHub import required, which is the step that tends to get stuck if Vercel's GitHub App does not have access to your fork. It reads the same `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` that `npm run setup` already wrote to `web/.env.local`, sets them on the Vercel project, and deploys. Sign in to Vercel once when prompted; re-run the same command any time you want to push a new deploy.

Once it has deployed, it asks what you want your address to be — try your own name first. If someone else already has `<that-name>.vercel.app`, it says so and asks again; after three misses in a row it offers a name with a random suffix that is guaranteed free instead of making you keep guessing. (Running with `--yes` skips straight to that random name on the first miss, since there's no one to ask.) You can also pass the name up front:

```bash
npm run deploy -- --project-name my-own-name
```

Do not add a service role key or any AI provider key. **The build rejects them on purpose** (`web/lib/env.ts`).

Prefer to do it by hand instead? Point a Vercel project at the `web/` directory and set those same two environment variables yourself — details in [docs/V2-SETUP.md](docs/V2-SETUP.md).

<br>

## Bulk import over MCP

**Keep the experience notes you already wrote in Notion.** MCP (Model Context Protocol) is a shared interface for AI clients to call external tools. This repository's `career-atelier` server reads Notion pages/databases or local Markdown/JSON and imports them into resume records and experience cards. Run it from a local MCP client or terminal; it is not a button in the web app.

### What can it import?

| Tool | Purpose | Main arguments |
|---|---|---|
| `preview_import` | Preview recognised items, destination tables, and warnings without writing | `source`; `section` for databases |
| `import_records` | Add items or update matches | `source`, `section`, `dry_run`, optional `only` |
| `db_snapshot` | Count rows in supported tables | None |

Supported kinds: profile, education, certifications, activities, training, projects, work, awards, and experience cards. It is not a general importer for postings or cover letters, a two-way Notion sync, or OCR for scanned documents.

The server parses the source locally and writes it to the database. Instead of asking a model to restate the entire source as INSERT arguments, the client exchanges paths and summaries of counts, titles, and results. Parsing itself makes no LLM call. Token savings depend on the input and tool-definition overhead; the historical sample's roughly 96% is an estimate, not a guarantee. Run `npm run mcp:bench` from `runner` to inspect character counts and token estimates.

### 1. Prepare installation and login

Complete [setup](#getting-started) and install the runner dependencies. From `runner`, run `npm run login` and finish email verification with your own account. Database writes and row counts use the runner's user session with RLS applied. File previews do not require database login.

The MCP server is separate from the job-queue runner. You do not need to keep `npm run start` running just to import. Notion credentials are only needed for Notion sources.

### 2. Register with an MCP client

Claude Code is configured in the root [.mcp.json](.mcp.json). Start it in the project directory and complete the client's MCP approval flow. For Codex and Antigravity, replace `<repo>` with **your repository's absolute path**:

```bash
codex mcp add career-atelier -- node <repo>/runner/mcp/server.mjs
agy mcp add career-atelier -- node <repo>/runner/mcp/server.mjs
```

Reopen the client and check that the three `career-atelier` tools are available. In other MCP clients, use `node` as the command and the absolute server path as its argument.

### 3. Format your notes

Heading 1 (`#`) selects the kind, heading 2 (`##`) names one item, and `key: value` list entries provide its fields. Use the same heading/list structure in a Notion page's body. Its page title alone does not select the kind.

```markdown
# Experience
## Running a campus study group
- Context: attendance was declining
- Problem: participants gave up because the exercises were too difficult
- Role: curriculum coordinator
- Judgment: let participants choose an appropriate difficulty
- Action: offered three levels and shared where people got stuck
- Result: the study group continued into the next semester
- Tags: collaboration, problem-solving

# Education
## Example University
- Major: Computer Science
- Period: 2020-03 ~ 2024-02
- GPA: 3.82 / 4.5
- Status: 졸업
```

Copy the [complete example](runner/mcp/fixtures/sample-notes.md) and replace it with your real material. The parser does not use AI to infer meaning from arbitrary prose. Unknown sections appear in `skipped`, invalid rows in `rejected`, and adjustments in `warnings`. Some unknown fields are preserved in memo or detail text.

### 4. Preview → save → verify

Ask your client:

> Use career-atelier's preview_import on /absolute/path/my-notes.md. Show the item counts and warnings.

After inspecting the result:

> Import the same file with import_records, dry_run set to false, and only set to ["experience"]. Then check the counts with db_snapshot.

Omit `only` to include all recognised kinds. Allowed values are `profile / education / certification / activity / training / project / work / award / experience`. The default `dry_run` is `true`; actual writes need `false`.

You can also use a terminal:

```bash
cd runner
node mcp/server.mjs preview --source /absolute/path/my-notes.md
node mcp/server.mjs import --source /absolute/path/my-notes.md
node mcp/server.mjs import --source /absolute/path/my-notes.md --write
node mcp/server.mjs snapshot
```

**Matches are updated.** Matching keys depend on kind: experience uses its title, while education uses school name and type. Importing an experience with the same title can change its existing content, and including a profile updates your current profile. There is no batch undo. Inspect `written.created / updated / failed` and `failures`; a run can partially succeed.

### 5. Connect Notion

1. Create a [Notion internal integration](https://www.notion.so/my-integrations) and grant it access to the pages or databases you want to read.
2. Save `NOTION_TOKEN=<your issued token>` in `runner/.env`. Keep it local; do not commit it or paste it into chat.
3. **The current Notion adapter reads process environment variables.** Merely editing `.env` does not load them. Start the MCP process with Node's `--env-file` option:

```bash
codex mcp add career-atelier -- node --env-file=<repo>/runner/.env <repo>/runner/mcp/server.mjs
```

Use this configuration instead of the file-only registration. If already registered, update that server's command in your client and reconnect. For Claude Code, set `.mcp.json`'s `args` to `["--env-file=<repo>/runner/.env", "<repo>/runner/mcp/server.mjs"]`. Antigravity uses the same Node arguments. Do not commit your machine's absolute paths to the shared configuration.

| Source | Arguments | Structure |
|---|---|---|
| Page | `source: "notion://page/<page-ID>"` | Heading 1 in its body selects the kind |
| Database | `source: "notion://database/<DB-ID>", section: "experience"` | Row title becomes item name; property names become fields |

Extract the page or database ID from its shared link, not the whole URL or the view ID after `?v=`. Import one kind per database call and name properties using supported fields. Database row bodies and attachments are not imported.

Example arguments for a database preview:

```json
{
  "source": "notion://database/<DB-ID>",
  "section": "experience"
}
```

Call `import_records` with the same arguments plus `dry_run: false` to write. **The current terminal CLI does not forward `--section`, so use MCP tools for database sources.** Pages can be previewed in the terminal:

```bash
cd runner
node --env-file=.env mcp/server.mjs preview --source "notion://page/<page-ID>"
```

### Troubleshooting

| Symptom | Check |
|---|---|
| MCP tools missing | Server path, Node installation, client approval and reconnection |
| Runner login missing / session expired | Run `npm run login` from `runner` |
| Missing `NOTION_TOKEN` | Token configuration and `--env-file` in the MCP command |
| Notion 401 / 403 / 404 | Token validity, integration access, and page/database ID |
| Zero planned rows / `skipped` | Page headings, database `section`, and field names |
| Nothing saved | `dry_run: false` or CLI `--write`, and the `failures` result |

**Verification scope:** file parsing and Supabase insert/update have been exercised. The Notion adapter is implemented but has not been tested against a live Notion account. It currently uses API version `2022-06-28`, which can fail for newer databases with multiple data sources. [Notion upgrade guide](https://developers.notion.com/guides/get-started/upgrade-guide-2025-09-03) · [MCP implementation and verification details](runner/mcp/README.md)

<br>

## Backups

Supabase pauses free-tier projects that go unused, and a single cloud database is a single point of failure for writing you cannot easily reproduce.

Turn on **local folder backup** in the dashboard's runner section and give it an absolute path.

- macOS · Linux — `~/career-atelier-backups`
- Windows — `C:\career-atelier-backups`

While the runner is up it exports the [tables listed in the backup code](runner/backup.mjs) to JSON every two hours. The same day's file is overwritten; a new date creates a new file. Old files are not deleted automatically, so manage retention yourself.

| Scope | Current behaviour |
|---|---|
| Included | Profile, experience cards, postings and calendar, research, prompts and configuration, essays/questions/versions/autosaves, interview questions, generated artifacts, and agent runs |
| Excluded | Education, certification, activity, training, project, work, and award tables; Storage attachments; some queue and detailed log data |
| Large tables | A single query per table; no pagination to export beyond the server's response row limit |
| Restore | JSON export only, without one-click restore. Its format also differs from MCP notes JSON, so it cannot be imported there unchanged |

This does not replace a complete Supabase project backup. Prepare separate database and attachment backups if you need full recovery.

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
| Concurrent runs | 1 |
| Single run timeout | 15 min |
| Failed-run retries | 0 |
| Lumi/Moka invalid-search retry | At most 1 |
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
| [Login and signup troubleshooting](docs/AUTH-TROUBLESHOOTING.md) | First signup, password recovery, and web/runner Supabase connection checks (Korean) |
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
