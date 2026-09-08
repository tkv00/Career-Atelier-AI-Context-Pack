<img src="docs/images/banner.png" alt="Career Atelier" width="100%">

<p>
  <a href="https://github.com/tkv00/Career-Atelier-AI-Context-Pack/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/tkv00/Career-Atelier-AI-Context-Pack/actions/workflows/ci.yml/badge.svg?branch=main"></a>
  <a href="https://github.com/tkv00/Career-Atelier-AI-Context-Pack/releases"><img alt="Package version" src="https://img.shields.io/github/package-json/v/tkv00/Career-Atelier-AI-Context-Pack?label=version&amp;style=flat-square"></a>
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-f5a962?style=flat-square"></a>
  <img alt="Node.js 22.13 or newer" src="https://img.shields.io/badge/node-%E2%89%A522.13-5cc98f?style=flat-square&amp;logo=node.js&amp;logoColor=white">
  <img alt="Next.js" src="https://img.shields.io/github/package-json/dependency-version/tkv00/Career-Atelier-AI-Context-Pack/next?filename=web%2Fpackage.json&amp;style=flat-square&amp;logo=nextdotjs">
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-Postgres%20%2B%20RLS-3ecf8e?style=flat-square&amp;logo=supabase&amp;logoColor=white">
  <img alt="Windows macOS Linux" src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-58cfe4?style=flat-square">
  <img alt="No per-token API billing" src="https://img.shields.io/badge/API%20billing-none-5cc98f?style=flat-square">
</p>

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

**Run `npm start` from the repository folder.** Windows, macOS, and Linux use the same command and one terminal for both the web app and runner.

### 1. Prepare once

Install Git, [Node.js 22.13+](https://nodejs.org/en/download), and the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) available on PATH. You also need your own [Supabase account](https://supabase.com). Follow the CLI's official installation method for your OS.

Use PowerShell or Command Prompt on Windows, or Terminal on macOS/Linux:

```bash
git clone https://github.com/tkv00/Career-Atelier-AI-Context-Pack.git
cd Career-Atelier-AI-Context-Pack
npm start
```

Already cloned? Run only `npm start` from that folder. It opens the setup wizard when configuration is missing, installs the locked web/runner dependencies when needed, and starts both services. Existing configuration is reused. The first launch needs internet access and can take a few minutes.

### 2. Complete your account steps

1. On first setup, follow the Supabase sign-in and project selection prompts. The wizard discovers the project details and applies database migrations.
2. Open the printed web address (normally `http://localhost:3000`). Choose **처음이에요 · 계정 만들기** and register with your own email and a password. Only the first account becomes the instance owner; existing users should sign in.
3. In the same terminal, enter **the email and password you chose in the web app** when the runner asks. Password input is hidden. These are different from your Supabase dashboard credentials or database password.
4. Approve this device in the **관제실** (Dashboard) runner list.

Supabase sign-in, first signup, and device approval require you. The launcher reuses a valid runner session and asks for login only when needed in an interactive terminal.

### 3. Connect the AI you use

Install and sign in to at least one supported [AI CLI](docs/REFERENCE.md#requirements) with your own subscription. In **프롬프트** (Prompts), assign the assistants you want to use to that provider. AI CLI login is separate from the web/runner account.

Save an experience under **경험 카드**, then request an assistant task and check **실행 기록**. Keep this terminal and your computer running during AI work.

### Every day

```bash
npm start
```

Open the web address printed in the terminal. Press **Ctrl+C once** to stop both the local web app and runner. Installation and signup do not need to be repeated.

<details>
<summary>Optional commands — run from the same repository folder</summary>

| Need | Command |
|---|---|
| Use an already deployed web app; start only the local runner | `npm run runner` |
| Manage data with only the local web app | `npm run web` |
| Sign in to the runner again or change the service account | `npm run login` |
| Diagnose the runner connection | `npm run doctor` |
| Reconfigure Supabase or apply migrations after updating | `npm run setup` |

Normal startup reuses environment files and does not apply new migrations. Follow the [upgrade guide](docs/UPGRADING.md) when updating. Existing commands inside `web/` and `runner/` remain available for development.

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

[Connection, mapping, and import examples](runner/mcp/README.md)

## When you get stuck

| Symptom | First check |
|---|---|
| Incorrect password | Web signup, service password, and email confirmation. [Login guide](docs/AUTH-TROUBLESHOOTING.md) |
| Web login works; runner login fails | Verify both use the same Supabase project |
| Assistants stay queued | Runner running → device approved → provider CLI signed in → matching provider in Prompts |
| Startup fails or a port is occupied | Run `npm start` from the repository root; stop the previous local web process if port 3000 is occupied |
| Dependency installation fails | Check Node.js 22.13+, internet access, and the printed npm error; retry `npm start` |

## Import your existing records

Open **자료 가져오기** (`/imports`) to upload Markdown/XLSX, paste text or Excel cells, or enter a Notion page/database URL. Review extracted fields beside their sources before saving. Structured content uses deterministic parsers; optional local CLI extraction handles free-form notes. Notion credentials remain on the runner. Apply migration `0032_source_imports.sql` and restart the runner after updating.

Writing selects relevant experiences within a context budget and preserves pinned/cited evidence.

## Versions and updates

See the version badge above or run `npm run check:version` for the current version. Web, runner, and installer share one product version. Check [GitHub Releases](https://github.com/tkv00/Career-Atelier-AI-Context-Pack/releases) for actual published versions and release files.

Run `npm run check:version` from the repository root. Before updating, read the [changelog](CHANGELOG.md) and [upgrade guide](docs/UPGRADING.md). Contributors can run `npm run verify` for version checks, tests, types, lint, and build.

[Package and release policy](docs/RELEASING.md) · [Security reporting](SECURITY.md)

## Read more when needed

| Goal | Guide |
|---|---|
| Access the web app elsewhere | Run `npm run deploy` from the repository root. [Deployment details](docs/REFERENCE.md#deploying). Remote AI requests still require your local runner |
| Understand backups, privacy, and costs | [Backup scope](docs/REFERENCE.md#backups) · [Privacy and costs](docs/PRIVACY-AND-COST.md) |
| Frequently asked questions | [FAQ: accounts, costs, AI, backups, and imports](docs/FAQ.md) |
| Explore features and architecture | [Detailed reference](docs/REFERENCE.md) |
| Contribute | [Contribution rules](CONTRIBUTING.md) · [AGENTS.md](AGENTS.md) |

[MIT License](LICENSE)
