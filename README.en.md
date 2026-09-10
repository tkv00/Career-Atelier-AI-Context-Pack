<p align="center"><a href="README.md">한국어</a> · <a href="README.en.md">English</a></p>

# Career Atelier

## Still introducing yourself to AI for every application?

> “Where did I write down that project?”
>
> “Do I really have to paste my experience into another chat?”
>
> “This sounds polished, but it doesn't sound like me.”

**Record your experience once. Give your next application a starting point.**
Career Atelier brings your experience, resume, and job postings into a personal workspace for company research, cover-letter drafts, review, and interview preparation.

<img src="docs/images/banner.png" alt="Career Atelier space-themed banner" width="100%">

<h2 align="center"><a href="https://tkv00.github.io/Career-Atelier-AI-Context-Pack/">🪐 Open the product site →</a></h2>

<p align="center"><b>Installation, features, and measured numbers on one page.</b></p>

[Let an agent install it](#let-an-agent-handle-installation) · [See the screens](#see-the-screens) · [Install manually](#getting-started) · [Write your first letter](#your-first-cover-letter) · [Troubleshooting](#when-you-get-stuck)

<p>
<a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-f5a962?style=flat-square"></a>
<a href="https://github.com/tkv00/Career-Atelier-AI-Context-Pack/releases"><img alt="Version" src="https://img.shields.io/github/package-json/v/tkv00/Career-Atelier-AI-Context-Pack?label=version&amp;style=flat-square"></a>
<img alt="Windows, macOS, Linux" src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-58cfe4?style=flat-square">
</p>

**Self-hosted open source** · Data in your Supabase · AI runs on your PC

AI subscription limits and hosting plan conditions apply. See [manual installation](#getting-started) for prerequisites.

## Let an agent handle installation

**Copy a request below into a coding agent that can access folders and a terminal on your PC.** It can clone the repository, install dependencies, configure the project, and run checks.

### Haven't downloaded it yet?

```text
Install Career Atelier on my PC.
Repository: https://github.com/tkv00/Career-Atelier-AI-Context-Pack.git

Clone the repository and read AGENTS.md and docs/AI-INSTALL.md.
Check prerequisites, install dependencies, configure Supabase, and verify.
If the repository already exists, preserve that folder and local changes.
Guide me when I need to sign in, create my account, or approve the device.
Finish with actual check results and instructions for starting the app.
```

### Already cloned it?

**Open the repository folder in your coding agent**, then send:

```text
Read AGENTS.md and docs/AI-INSTALL.md in this Career Atelier repository
and continue installation in the current folder.
Preserve existing code and settings; ask before overwriting configuration.
Guide me through sign-in, signup, and device approval.
After verification, report the start command and any remaining work.
```

**You handle account connections and approval.**

- Sign in to Supabase and your chosen AI account in the browser.
- Create the first web account, then use it for runner login in the terminal.
- Approve your device in the dashboard.

Enter passwords directly in login forms or the terminal, not in the agent chat. After installation, run `npm start` from the repository folder.

[Agent installation runbook](docs/AI-INSTALL.md) · [Install manually](#getting-started)

<img src="docs/images/screens/01-dashboard.png" alt="Dashboard example showing seven assistants and their task states" width="100%">

*These are example screens already included in the repository. Companies, dates, experiences, and task states illustrate usage and are not populated on signup. Layout and labels may differ by version.*

## See the screens

### “I have experience. I just can't find the notes.”

Save the situation, judgment, action, and result in **경험 카드** (Experiences), then find them by tag. One project can offer material for questions about collaboration or problem-solving. Keep education, employment, and certifications in **이력 정보** (Resume).

<img src="docs/images/screens/05-experiences.png" alt="Experience galaxy linking skill tags to relevant experience cards" width="100%">

### “I already organized this in Notion and Excel.”

Use **자료 가져오기** (Imports) for Markdown, PDF, Word, PowerPoint, and Excel files, pasted text or spreadsheet cells, and Notion page/database URLs. External documents are first converted to Markdown by local [Microsoft MarkItDown](https://github.com/microsoft/markitdown), so the model never receives the source binary directly. **Compare extracted fields with the source, edit, then save.** Optional local AI helps organize free-form notes.

Analysis requires an approved runner. Notion requires a separate connection on the runner. Excel imports retain multirow and merged-header detection, per-sheet classification, column mapping, and cached formula-value checks. Uploading a PDF transcript to an education record automatically adds course names, terms, credits, and grades through the same Markdown conversion path. Local AI summarizes experience titles within 40 characters and selects up to three evidence-supported competencies from a fixed set of 12. MarkItDown's MIT license is recorded in the [third-party notices](THIRD-PARTY-NOTICES.md). Review the [classification policy (Korean)](docs/EXPERIENCE-METADATA.md) and [Excel import guide (Korean)](docs/EXCEL-IMPORTS.ko.md) before saving.

<details>
<summary>View the import screen — compare source and extracted fields</summary>

<img src="docs/images/source-imports/web-review.png" alt="Reviewing action and result fields against a synthetic Excel source before saving" width="100%">

*This review example uses synthetic QA data. The disconnected-runner notice reflects the state when captured.*

</details>

### “My deadlines and half-written letters are in different places.”

Use **지원 일정** (Applications) to track deadlines, submission status, and selection outcomes, then open the letter editor from a saved posting. Enter postings yourself or ask Moka to find them.

<img src="docs/images/screens/02-calendar.png" alt="Monthly application calendar with deadlines and a form for adding a posting" width="100%">

<details>
<summary>View application progress by selection stage</summary>

<img src="docs/images/screens/03-stage-board.png" alt="Submission and selection-stage tracking with links to each cover letter" width="100%">

</details>

### “Research and drafting keep sending me to another chat.”

Enter the **question, character limit, company, role, and posting** in the letter editor. Select **기업 조사부터 소제목까지 실행 (솔)** to run Sol's research → Muse's experience-based draft → Lens's evidence review → Comma's headings.

You need saved experience cards to generate a draft. Read the results, check facts, and edit the wording before submitting. Review helps with fact-checking; the app does not submit applications for you.

### “It sounds like AI. I want it to sound like me.”

In **프롬프트** (Prompts), choose each assistant's provider, model, and writing instructions. Save guidance such as “Lead with my decisions and actions, use only confirmed numbers, and write short sentences” for subsequent tasks.

<img src="docs/images/screens/04-prompt-lab.png" alt="Assistant-specific AI and instruction editor with version history" width="100%">

### “I submitted the letter. What will they ask in the interview?”

In **면접 준비** (Interviews), organize common questions and company-specific questions and answers. Ask Echo for likely questions, then practice explaining your own experience.

<img src="docs/images/screens/06-interviews.png" alt="Common questions, company interview rooms, and an answer editor" width="100%">

[Install your workspace](#getting-started) · [Read the first-letter steps](#your-first-cover-letter)

## Your first cover letter

**Start with one experience and one posting.**

1. **Save your goal** — Enter a target role and interests in **관제실** (Dashboard).
2. **Prepare one experience** — Save its situation, judgment, action, and result in **경험 카드**. Use Imports for existing notes.
3. **Save a posting** — In **지원 일정**, choose **+ 직접 일정 입력**, enter company, role, and deadline, then select **캘린더에 저장**.
4. **Open the editor** — Choose **자소서 쓰기** or **자소서 작성 연결** on that posting.
5. **Request a draft** — Enter the question, character limit, company, role, and posting context; select **기업 조사부터 소제목까지 실행 (솔)**.
6. **Make it yours** — Check the draft and review results, edit facts and wording, then submit the application yourself.

Drafting stops if no experience cards exist. AI tasks require a signed-in CLI and an approved runner.

[Button-by-button walkthrough](docs/FEATURE-WALKTHROUGH.ko.md) (Korean)

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

This is the manual setup path. Prefer help with the commands? [Let an agent handle installation](#let-an-agent-handle-installation).

**Run `npm start` from the repository folder.** Windows, macOS, and Linux use the same command and one terminal for both the web app and runner.

### 1. Prepare once

Prepare these tools and an account. Supabase is the database service that stores your material.

| Prerequisite | Purpose |
|---|---|
| Git | Download the repository |
| [Node.js 22.13+](https://nodejs.org/en/download) | Run the web app and runner |
| [Supabase account](https://supabase.com) | Use your own account |
| [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) | Follow the official OS-specific installer; `supabase` must work in your terminal |

Use PowerShell or Command Prompt on Windows, or Terminal on macOS/Linux:

```bash
git clone https://github.com/tkv00/Career-Atelier-AI-Context-Pack.git
cd Career-Atelier-AI-Context-Pack
npm start
```

Already cloned? Run only `npm start` from that folder. It opens the setup wizard when configuration is missing, installs the locked web/runner dependencies when needed, and starts both services. Existing configuration is reused. When `git pull` adds migrations, startup applies them to the configured Supabase project before launching services. If the Supabase CLI login has expired, it asks you to complete browser login once. The first launch needs internet access and can take a few minutes.

`npm start` also checks GitHub Releases on each run. If a newer release is found, it prints the same install steps with the release tag and recommends `npm run release:update -- --yes --deploy`, which updates the code, applies Supabase migrations, and redeploys Vercel in one pass.

### 2. Complete your account steps

1. On first setup, follow the Supabase sign-in and project selection prompts. The wizard discovers the project details and applies database migrations.
2. Open the printed web address (normally `http://localhost:3000`). Choose **처음이에요 · 계정 만들기** and register with your own email and a password. Only the first account becomes the instance owner; existing users should sign in.
   Deleting the owner account does not reopen registration. If you cannot access your account, reset your password instead of deleting it and signing up again.
3. In the same terminal, enter **the email and password you chose in the web app** when the runner asks. Password input is hidden. These are different from your Supabase dashboard credentials or database password.
4. Approve this device in the **관제실** (Dashboard) runner list.

Supabase sign-in, first signup, and device approval require you. The launcher reuses a valid runner session and asks for login only when needed in an interactive terminal.

### 3. Connect the AI you use

To use AI features, install at least one AI CLI and sign in with **your own subscription account**. AI CLI login is separate from the web and runner account. You do not need all three.

| CLI | Default assistants (change in Prompts) |
|---|---|
| Codex (ChatGPT) | Lumi · Moka · Muse · Echo |
| Claude Code | Sol · Lens |
| Antigravity (Google) | Comma |

<details>
<summary>AI CLI installation and login commands — start with one provider</summary>

#### Start with Codex

Sign in with your ChatGPT account:

```bash
npm install -g @openai/codex
codex --version
codex login
```

When the browser opens, choose **ChatGPT account login**. This service does not use API-key billing, so do not configure an API-key login.

#### Start with Claude Code

Sign in with a Claude Pro or Max subscription account:

```bash
npm install -g @anthropic-ai/claude-code
claude --version
claude auth login
```

Complete the subscription login in your browser.

#### Start with Antigravity

On macOS or Linux, install it and sign in with your Google account:

```bash
curl -fsSL https://antigravity.google/cli/install.sh | bash
agy --version
agy
```

On Windows, download the installer from the [Antigravity website](https://antigravity.google) and follow its prompts. The first `agy` command asks you to sign in with Google.

</details>

If a newly installed command is not found, close the terminal completely, reopen it, and retry its `--version` command. If `npm install -g` returns an `EACCES` permission error on macOS or Linux, do not use `sudo`; reinstall Node.js with [nvm](https://github.com/nvm-sh/nvm).

After login, assign the assistants you want to use to that provider in **프롬프트** (Prompts) and save. An assistant assigned to a CLI you have not signed in to cannot run. See the [AI CLI reference](docs/REFERENCE.md#requirements) for further provider details.

Save an experience under **경험 카드**, then request an assistant task and check **실행 기록**. Keep this terminal and your computer running during AI work.

### Every day

```bash
npm start
```

Open the web address printed in the terminal. After an update, the same command checks for unapplied database changes first. Press **Ctrl+C once** to stop both the local web app and runner. Installation and signup do not need to be repeated.

<details>
<summary>Optional commands — run from the same repository folder</summary>

| Need | Command |
|---|---|
| Use an already deployed web app; start only the local runner | `npm run runner` |
| Manage data with only the local web app | `npm run web` |
| Sign in to the runner again or change the service account | `npm run login` |
| Diagnose the runner connection | `npm run doctor` |
| Reconfigure Supabase or manually recheck database updates | `npm run setup` |

Normal startup reuses environment files and checks remote migration history only when the local migration set changes. Follow the [upgrade guide](docs/UPGRADING.md) for backup and code/database compatibility precautions. Existing commands inside `web/` and `runner/` remain available for development.

</details>

## Where to find features

These labels match the application's left navigation.

| Menu | What you can do | AI required? |
|---|---|---|
| 관제실 — Dashboard | Set goals, run Lumi news/Moka job discovery, approve runners | For research/discovery |
| 지원 일정 — Applications | Save postings/deadlines, track submission/outcomes, open the letter editor | Not for manual management |
| 경험 카드 — Experiences | Manage experiences/tags and explore 3D planets | Not for manual management |
| 자료 가져오기 — Imports | Import files, text, or Notion; compare with sources before saving | Runner required; AI extraction optional |
| 이력 정보 — Resume | Store education, work, and certifications | No |
| 면접 준비 — Interviews | Generate Echo questions and organize answers | For question generation |
| 프롬프트 — Prompts | Set each assistant's provider, model, and instructions | Not for saving settings |
| 실행 기록 — Activity | Inspect queued/running/completed/failed tasks and errors | Not for viewing |

[Feature walkthrough](docs/FEATURE-WALKTHROUGH.ko.md) (Korean) · [Seven assistants and all screenshots](docs/REFERENCE.md#the-seven-agents)

## When you get stuck

| Symptom | First check |
|---|---|
| Incorrect password | Web signup, service password, and email confirmation. [Login guide](docs/AUTH-TROUBLESHOOTING.md) |
| Web login works; runner login fails | Verify both use the same Supabase project |
| Assistants stay queued | Runner running → device approved → provider CLI signed in → matching provider in Prompts |
| Startup fails or a port is occupied | Run `npm start` from the repository root; stop the previous local web process if port 3000 is occupied |
| Dependency installation fails | Check Node.js 22.13+, internet access, and the printed npm error; retry `npm start` |

## Versions and updates

See the version badge above or run `npm run check:version` for the current version. Web, runner, and installer share one product version. Check [GitHub Releases](https://github.com/tkv00/Career-Atelier-AI-Context-Pack/releases) for actual published versions and release files.

When a new release is available, you can run `npm run release:update -- --yes --deploy` from this folder to apply the recommended flow automatically (repository tag check/checkout, `npm install`, `node scripts/setup.mjs --yes`, and optional Vercel deploy).

Run `npm run check:version` from the repository root. Before updating, read the [changelog](CHANGELOG.md) and [upgrade guide](docs/UPGRADING.md). Contributors can run `npm run verify` for version checks, tests, types, lint, and build.

[Package and release policy](docs/RELEASING.md) · [Security reporting](SECURITY.md)

## Read more when needed

| Goal | Guide |
|---|---|
| Access the web app elsewhere | Run `npm run deploy` from the repository root. [Deployment details](docs/REFERENCE.md#deploying). Remote AI requests still require your local runner |
| Understand backups, privacy, and costs | [Backup scope](docs/REFERENCE.md#backups) · [Privacy and costs](docs/PRIVACY-AND-COST.md) |
| Frequently asked questions | [FAQ: accounts, costs, AI, backups, and imports](docs/FAQ.md) |
| Explore features and architecture | [Detailed reference](docs/REFERENCE.md) |
| System design diagrams (Korean) | [Agent execution, sessions, memory, and context](https://tkv00.github.io/Career-Atelier-AI-Context-Pack/architecture.html) |
| Contribute | [Contribution rules](CONTRIBUTING.md) · [AGENTS.md](AGENTS.md) |

[MIT License](LICENSE)
