# AI-assisted installation

This file is an installation runbook for coding agents such as Codex, Claude Code, and Gemini CLI. If a user asks you to install Career Atelier, follow these steps from the user's local terminal.

## Goal

Install Career Atelier from the official repository, connect the user's own Supabase project, install the web and runner dependencies, and leave the app ready to start. Account creation, OAuth sign-in, email verification, and runner approval remain with the user.

Official repository: `https://github.com/tkv00/Career-Atelier-AI-Context-Pack.git`

## Safety boundaries

- Never request, create, store, or add an OpenAI/Anthropic API key or a Supabase `service_role` key. This project uses subscription/OAuth AI logins and a Supabase anon/publishable key only.
- Never print the contents of `.env`, `web/.env.local`, `runner/.env`, login files, or `local-data/`.
- Do not overwrite an existing environment file unless the user explicitly approves it when the setup wizard asks.
- Do not run `git reset`, discard local changes, delete an existing installation, use `sudo`, or deploy the app without an explicit user request.
- Do not pipe a remote script directly into a shell. Clone the repository first so its files can be inspected locally.
- Pause for the user when a browser login, email code, Supabase value, operating-system permission, or first-account/runner approval is required. Do not attempt to bypass these steps.

## Procedure

### 1. Check the destination

Use the current working directory unless the user named another location.

- If the current directory is already this repository, use it in place and preserve all local changes.
- Otherwise, if `Career-Atelier-AI-Context-Pack` is absent, clone the official repository:

  ```bash
  git clone https://github.com/tkv00/Career-Atelier-AI-Context-Pack.git
  cd Career-Atelier-AI-Context-Pack
  ```

- If that child directory already exists, confirm it is this repository with `git remote -v`. Preserve all local changes. Do not pull or replace files automatically.

### 2. Check prerequisites

Run these read-only checks:

```bash
git --version
node -v
npm -v
supabase --version
```

Node.js 22.13 or newer and the Supabase CLI are required. At least one supported AI CLI is needed for agent runs: `codex`, `claude`, or `agy`.

If a prerequisite is missing, use its official installer or the package manager already available on the machine. Explain the exact system-wide change and obtain any approval required by the user's agent before running it. Never use `sudo` unless the user explicitly requests it.

### 3. Install project dependencies

From the repository root, use the committed lockfiles:

```bash
npm ci --prefix web
npm ci --prefix runner
```

### 4. Run the setup wizard

Ask the user to have these values ready from Supabase **Settings → Data API**:

- project ref
- Project URL
- anon/publishable key

Then run the wizard with those values as flags:

```bash
node scripts/setup.mjs --project-ref <REF> --anon-key <ANON_KEY>
```

Passing both flags skips every prompt. This matters because most agent shells have no tty, and `npm run setup` on its own will sit waiting for input it can never receive. Add `--url` when the user's Project URL is not the default `https://<REF>.supabase.co`.

The wizard links the Supabase project, applies migrations and row-level security, and creates `web/.env.local` and `runner/.env`. Existing env files are kept; pass `--yes` only if the user explicitly asked to overwrite them.

`supabase link` may require `supabase login` first, which opens a browser for the user.

### 5. Set up an AI subscription CLI

Detect the CLIs already installed:

```bash
codex --version
claude --version
agy --version
```

Only one is required, although unavailable providers leave their assigned agents disabled. Let the user complete the provider's subscription/OAuth login. Do not configure API-key authentication.

### 6. Verify the installation

Do not display environment-file contents. Check only that the files exist, then run:

```bash
npm run lint --prefix web
npm run typecheck --prefix web
npm run build --prefix web
node --check runner/index.mjs
```

If a check fails, diagnose it without weakening the privacy or billing safeguards above.

### 7. Hand control back to the user

Report what was installed, which AI CLIs are available, and any checks that failed. Give the two start commands:

```bash
npm run dev --prefix web
```

```bash
npm run start --prefix runner
```

Remind the user that they must:

1. Open `http://localhost:3000` and make their own email the first account.
2. Run `npm run login --prefix runner` and complete the email-code login.
3. Approve this runner once from the dashboard.

Do not claim installation is complete until dependency installation, the setup wizard, and the verification checks have either succeeded or been clearly reported as remaining work.
