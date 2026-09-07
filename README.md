<img src="docs/images/banner.png" alt="Career Atelier" width="100%">

English · **[한국어](README.ko.md)** · MIT · Node.js 22.13+

# Your job search, in one personal workspace

Bring together your Notion experiences, spreadsheet resume, job postings, and cover letters. Use your own experiences for company research, drafting, and review, with an AI provider and writing style you choose for each assistant.

**This is a self-hosted application: your Supabase project stores the data, and signed-in AI CLIs run on your PC.** Manual data management needs no AI connection. Your AI account limits and Supabase/Vercel plan conditions still apply.

[Install](#getting-started) · [Write your first cover letter](#your-first-cover-letter) · [Find a feature](#where-to-find-features) · [Login troubleshooting](docs/AUTH-TROUBLESHOOTING.md) · [FAQ](docs/FAQ.md)

<img src="docs/images/screens/01-dashboard.png?v=0750026" alt="Career Atelier dashboard" width="100%">

## Why I built this

While preparing applications, I kept resume details and experiences in Notion and Excel, postings and deadlines in another table, and company research and drafts in GPT or Claude chats. Every application meant switching windows, copying the same experiences, and introducing myself to AI again.

**I wanted an experience recorded once to remain useful for the next application.** Career Atelier brings organization, research, drafting, review, and interview preparation into one workspace. Your own Supabase project holds the data, and you choose the AI you already use to work from your evidence and in your voice.

## Meet your seven pilots

Each pilot has a distinct role in this space-themed workspace. Use the character and role labels to find the assistant you need.

<table>
<tr>
<td align="center" width="25%"><img src="docs/images/agents/agent-news.png" width="96" alt="Lumi"><br><b>Lumi</b><br>Industry news</td>
<td align="center" width="25%"><img src="docs/images/agents/agent-jobs.png" width="96" alt="Moka"><br><b>Moka</b><br>Job discovery</td>
<td align="center" width="25%"><img src="docs/images/agents/agent-company.png" width="96" alt="Sol"><br><b>Sol</b><br>Company research</td>
<td align="center" width="25%"><img src="docs/images/agents/agent-writer.png" width="96" alt="Muse"><br><b>Muse</b><br>Experience-based drafts</td>
</tr>
</table>

<table>
<tr>
<td align="center" width="33%"><img src="docs/images/agents/agent-review.png" width="96" alt="Lens"><br><b>Lens</b><br>Evidence review</td>
<td align="center" width="33%"><img src="docs/images/agents/agent-subtitle.png" width="96" alt="Comma"><br><b>Comma</b><br>Section headings</td>
<td align="center" width="33%"><img src="docs/images/agents/agent-interview.png" width="96" alt="Echo"><br><b>Echo</b><br>Interview questions</td>
</tr>
</table>


Find postings with Moka, then run **Sol → Muse → Lens → Comma** from the cover-letter editor. Lumi handles news research; Echo prepares interview questions. Change each pilot’s AI provider in **프롬프트** (Prompts).

[Start installation](#getting-started) · [Detailed assistant roles](docs/REFERENCE.md#the-seven-agents) · [Frequently asked questions](docs/FAQ.md)

## Getting started

**Complete steps 1 → 2 → 3 first.** If you can save a record, the basic installation works. Connect AI in step 4; deployment and MCP are optional later steps. The current application UI is Korean; Korean menu labels below match the screen.

### 1. Check the requirements

| Requirement | How to check |
|---|---|
| Git | Run `git --version` |
| Node.js 22.13 or newer | Run `node -v` and `npm -v`; install [Node.js](https://nodejs.org/en/download) if needed |
| Your own Supabase account | Sign up at [Supabase](https://supabase.com) |
| Supabase CLI | Follow the OS-specific [official installation guide](https://supabase.com/docs/guides/local-development/cli/getting-started), then run `supabase --version` |

The wizard invokes `supabase` directly, so it must be available on PATH. Use Homebrew on macOS, Scoop on Windows, or an official binary for a global installation. An npm project dependency is a different installation method. Use the [official installation methods](https://supabase.com/docs/guides/local-development/cli/getting-started) instead of the older `npm install -g supabase` instructions.

### 2. Connect a project — terminal A

Use PowerShell on Windows or Terminal on macOS/Linux. Run each line separately.

```bash
git clone https://github.com/tkv00/Career-Atelier-AI-Context-Pack.git
cd Career-Atelier-AI-Context-Pack
npm run setup
```

If you already cloned the repository, run only the last command from its root. Sign in with your own Supabase account and select a project when prompted. An existing project may require its **database password**. Follow the selection prompt to create a new project instead.

**Checkpoint:** setup finishes applying configuration and prints web startup/signup instructions. If it ends with an error, resolve it before continuing. [Installation details](docs/USER-GUIDE.md) · [Switch Supabase accounts](docs/AUTH-TROUBLESHOOTING.md#다른-supabase-계정으로-전환하기) (Korean)

### 3. Start the web app and create your account — terminal A and browser

Continue in terminal A:

```bash
cd web
npm install
npm run dev
```

Leave it running and open its printed Local address **in your browser**. Usually this is `http://localhost:3000`; use the printed port if different.

1. Choose **처음이에요 · 계정 만들기** (Create account).
2. Sign up with your email and a password you choose. Complete email confirmation if prompted.
3. Once the dashboard opens, save one experience through **경험 카드** (Experience cards).

**Checkpoint:** the experience remains after refreshing. You can now manage data without AI.

> Web and runner use **the same email and password chosen here**. These are not your Supabase dashboard credentials or database password. Only the first owner account can register in each project. Existing users should sign in or reset their password.

### 4. Connect AI assistants — only when needed

An **AI CLI** runs your AI account from a terminal. The **runner** is a local process that receives web requests and executes that CLI. Their logins are separate.

1. Install **one** supported AI CLI and sign in with your own account. See [provider setup](docs/REFERENCE.md#requirements).
2. Open **프롬프트** (Prompts) in the web app. Assign the assistants you intend to run to that signed-in provider and save. All assistants can use the same provider.
3. Open a **new terminal B**, navigate to the repository root, and run:

```bash
cd runner
npm install
npm run login
npm run start
```

For `npm run login`, enter **the web account from step 3**. Password input is hidden.

4. In the browser, find the runner list under **관제실** (Dashboard) and approve this device with **승인**.

**Checkpoint:** confirm the connected/approved state, request one assistant task, and check its outcome under **실행 기록** (Activity). Connection alone does not keep assistants continuously running. Keep terminal B and your PC running during AI work.

<details>
<summary>Starting again the next day</summary>

Do not repeat installation or signup. From the repository root, use `cd web` → `npm run dev` in terminal A, and `cd runner` → `npm run start` in a new terminal B. Run `npm run login` again only when the runner session expires.

</details>

<details>
<summary>Prefer an AI coding agent to handle installation?</summary>

Give this instruction to a coding agent with access to your computer's terminal. You still complete Supabase sign-in, first web signup, and device approval yourself.

```text
Read these instructions and install Career Atelier: https://raw.githubusercontent.com/tkv00/Career-Atelier-AI-Context-Pack/refs/heads/main/docs/AI-INSTALL.md
```

[Agent installation runbook](docs/AI-INSTALL.md)

</details>

## Your first cover letter

| Step | Where and what to do | Checkpoint |
|---|---|---|
| 1 | Save your target role and interests in **관제실** (Dashboard) | Research preferences are saved |
| 2 | Add education/work in **이력 정보** (Resume); save situation, judgment, action, and result in **경험 카드** | At least one real experience exists |
| 3 | In **지원 일정** (Applications), choose **+ 직접 일정 입력**, enter company/role/deadline, then **캘린더에 저장** | The posting appears. You can also select one found by Moka |
| 4 | Choose **자소서 쓰기** or **자소서 작성 연결** on the posting | Its cover-letter editor opens |
| 5 | Enter the question, character limit, company, role, and posting context; choose **기업 조사부터 소제목까지 실행 (솔)** | Review results from Sol → Muse → Lens → Comma |
| 6 | Check facts and edit the draft and review suggestions | A personally reviewed letter. Submit the application yourself |

Muse stops if no experience cards exist. Moka discovery and cover-letter generation are separate requests. [Detailed button-by-button walkthrough](docs/FEATURE-WALKTHROUGH.ko.md) (Korean)

## Where to find features

These labels match the application's left navigation.

| Menu | What you can do | AI required? |
|---|---|---|
| 관제실 — Dashboard | Set goals, run Lumi news/Moka job discovery, approve runners | For research/discovery |
| 지원 일정 — Applications | Save postings/deadlines, track submission/outcomes, open the letter editor | Not for manual management |
| 경험 카드 — Experiences | Manage experiences/tags and explore 3D planets | Not for manual management |
| 이력 정보 — Resume | Store education, work, and certifications | No |
| 면접 준비 — Interviews | Generate Echo questions and organize answers | For question generation |
| 프롬프트 — Prompts | Set each assistant's provider, model, and instructions | Not for saving settings |
| 실행 기록 — Activity | Inspect queued/running/completed/failed tasks and errors | Not for viewing |

[Feature walkthrough](docs/FEATURE-WALKTHROUGH.ko.md) (Korean) · [Seven assistants and all screenshots](docs/REFERENCE.md#the-seven-agents)

## Import existing Notion and Excel material

**Optional: MCP is not required for initial installation.** Imports currently run through a local MCP client or terminal. There is no web upload wizard yet.

| Your source | Available approach |
|---|---|
| Same table structure, different headers | Map your column names to supported fields with `column_map` |
| Multiple worksheets | Select `sheet` and record kind `section` |
| Different Notion database property names | Map properties and inspect the preview |
| Several experiences per cell, merged cells, free-form pages | Automatic splitting and semantic extraction are not supported; convert to table values or supported Markdown/JSON first |

**Sources need not have identical names, but current mapping has limits.** Inspect skipped/rejected rows and warnings before saving. Values in unrecognized table columns are currently not saved.

[Connection, mapping, and import examples](runner/mcp/README.md) · [Flexible-format extension design — not implemented](docs/IMPORT-FORMAT-DESIGN.ko.md) (Korean)

## When you get stuck

| Symptom | First check |
|---|---|
| Incorrect password | Web signup, service password, and email confirmation. [Login guide](docs/AUTH-TROUBLESHOOTING.md) |
| Web login works; runner login fails | Verify both use the same Supabase project |
| Assistants stay queued | Runner running → device approved → provider CLI signed in → matching provider in Prompts |
| `cd web` or `cd runner` fails | Start from the repository root. A and B are separate terminal windows |
| Setup asks for a DB password | It connects to an existing project's database; this is not your web password |

## Versions and updates

The current development baseline is **0.1.0**. Web, runner, and installer share one product version. Check [GitHub Releases](https://github.com/tkv00/Career-Atelier-AI-Context-Pack/releases) for actual published versions and release files.

Run `npm run check:version` from the repository root. Before updating, read the [changelog](CHANGELOG.md) and [upgrade guide](docs/UPGRADING.md). Contributors can run `npm run verify` for version checks, tests, types, lint, and build.

[Package and release policy](docs/RELEASING.md) · [Open-source comparison and decisions](docs/OPEN-SOURCE-READINESS.ko.md) (Korean) · [Security reporting](SECURITY.md)

## Read more when needed

| Goal | Guide |
|---|---|
| Access the web app elsewhere | Run `npm run deploy` from the repository root. [Deployment details](docs/REFERENCE.md#deploying). Remote AI requests still require your local runner |
| Understand backups, privacy, and costs | [Backup scope](docs/REFERENCE.md#backups) · [Privacy and costs](docs/PRIVACY-AND-COST.md) |
| Frequently asked questions | [FAQ: accounts, costs, AI, backups, and imports](docs/FAQ.md) |
| Explore features and architecture | [Detailed reference](docs/REFERENCE.md) |
| Study MCP implementation and experiments | [Korean research report](docs/research/mcp-import/REPORT.ko.md) |
| Contribute | [Contribution rules](CONTRIBUTING.md) · [AGENTS.md](AGENTS.md) |

[MIT License](LICENSE)
