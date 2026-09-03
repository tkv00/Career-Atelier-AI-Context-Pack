# Contributing to Career Atelier

Thanks for taking the time to contribute.

This guide follows the conventions used by projects like [Rust](https://github.com/rust-lang/rust),
[Vue](https://github.com/vuejs/core), and [Atom](https://github.com/atom/atom):
say what a good issue looks like, what a good pull request looks like, and what
the commit history should read like. If something here is unclear, opening an
issue to ask is itself a useful contribution.

<br>

## Table of contents

- [Code of conduct](#code-of-conduct)
- [Getting set up](#getting-set-up)
- [Project layout](#project-layout)
- [How to report a bug](#how-to-report-a-bug)
- [How to suggest a feature](#how-to-suggest-a-feature)
- [Your first pull request](#your-first-pull-request)
- [Commit messages](#commit-messages)
- [Style](#style)
- [Database changes](#database-changes)
- [Updating the README screenshots](#updating-the-readme-screenshots)
- [Security](#security)

<br>

## Code of conduct

Be decent to other people. Assume the person on the other end is trying to help.
Harassment, personal attacks, and dismissive behaviour toward newcomers are not
welcome, and the maintainer will act on them.

<br>

## Getting set up

You need Node.js 22+ and the [Supabase CLI](https://supabase.com/docs/guides/cli).

Every contributor runs against **their own** Supabase project. There is no shared
development database, so you cannot break anyone else's data, and you never need
credentials from the maintainer.

```bash
git clone https://github.com/tkv00/Career-Atelier-AI-Context-Pack.git
cd Career-Atelier-AI-Context-Pack
npm run setup
```

`npm run setup` checks your tooling, links your Supabase project, applies the
migrations, and writes `web/.env.local` and `runner/.env`. The full walkthrough
is in [docs/USER-GUIDE.md](docs/USER-GUIDE.md).

<br>

## Project layout

| Path | What lives there |
|---|---|
| `web/` | Next.js app deployed to Vercel. Never calls an LLM, never holds a provider key. |
| `runner/` | Local Node process that runs the agents through your own CLI subscriptions. Never deployed. |
| `supabase/migrations/` | Append-only SQL migrations. |
| `scripts/` | Setup and documentation tooling. |
| `docs/` | Architecture, setup, and verification notes. |

The split matters: **`web/` must stay free of AI credentials.** `web/lib/env.ts`
throws at build time if a key like `OPENAI_API_KEY` is present. That is a safety
rail, not an obstacle to route around.

<br>

## How to report a bug

Before opening an issue, check whether it is already reported.

A useful bug report answers four questions:

1. **What did you do?** The exact steps, not a summary.
2. **What did you expect?**
3. **What happened instead?** Paste the error, do not describe it.
4. **What is your setup?** OS, `node -v`, and which half failed (web, runner, or
   `npm run setup`).

For runner problems, include the console output from `npm run start`.

**Redact before you paste.** Logs and screenshots from this app routinely contain
your email address, your Supabase project URL, and the companies you are applying
to. None of that helps debug.

<br>

## How to suggest a feature

This is not only for new features. A design change, an awkward screen you'd
lay out differently, or a fix to how an existing feature behaves are just as
welcome here as a brand-new capability.

Open an issue describing the problem before proposing the solution. "I have to
retype my certificate number for every application" is more useful than "add a
certificates table", because it leaves room for a better answer.

Say whether you are willing to implement it. Both answers are fine, but it
changes how the issue gets scheduled.

<br>

## Your first pull request

1. Branch from `main`.
2. Make one logical change per pull request. A refactor bundled with a bug fix is
   two pull requests.
3. Run the checks below.
4. Describe **what you verified**, not just what you wrote.

```bash
cd web
npx tsc --noEmit
npm run lint
npm run build
```

On verification: "typechecks" is not verification. "Created a job post, clicked
the stage chip, confirmed `stage_results` in the database" is. This project's
history has several bugs that passed every static check and only appeared when
someone actually ran the thing, so the bar is deliberately set at real use.

If you changed the runner, say which provider you tested against. If you could
not test a provider because you do not have that subscription, say that too —
an honest gap is easier to work with than a silent one.

<br>

## Commit messages

Write commit messages in **English**, in the imperative mood, as Git itself does:

```
Add per-stage outcome tracking to the calendar
```

not "Added…", "Adds…", or "adding…".

Keep the subject under about 72 characters. Then leave a blank line and explain
**why** the change was made in the body. The diff already shows what changed;
what it cannot show is the reasoning, and that is the part future readers need.

<br>

## Style

- **Match the surrounding code.** The codebase uses Korean comments that explain
  *why* a decision was made, particularly where something non-obvious was learned
  the hard way. Keep that habit. English comments are fine in new files whose
  surroundings are English.
- **Comments explain reasoning, not mechanics.** Do not narrate what the next
  line obviously does.
- **No new dependencies** without a reason that cannot be met by the standard
  library or what is already installed.
- **No new abstractions** ahead of a second caller.

<br>

## Database changes

Migrations are append-only. Add `00NN_your_change.sql`; never edit a migration
that has already been applied, because other contributors' databases have
already run it.

After a schema change, regenerate the types:

```bash
supabase gen types typescript --linked > web/lib/supabase/database.types.ts
```

Every new table needs row level security enabled and an owner policy, matching
the pattern in `supabase/migrations/0003_rls_policies.sql`. A table without RLS
is readable by anyone holding the anon key, which is published in the client
bundle by design.

<br>

## Updating the README screenshots

The images in `docs/images/screens/` are generated, not hand-captured. If your
change alters a screen that appears in the README, regenerate them:

```bash
npm run shoot-docs
```

A Chrome window opens. Sign in there with your email and password. The script
captures every documented screen at a consistent size once it detects your
session. The profile is remembered, so later runs can use
`npm run shoot-docs -- --headless`.

Email addresses on screen are replaced with `you@example.com` before each
capture. Check the result before committing anyway — screenshots are the easiest
place to leak personal data by accident.

<br>

## Security

Do not open a public issue for a security problem. Use GitHub's private
vulnerability reporting, or email the maintainer.

Note that the Supabase anon key is *designed* to be public; row level security is
the actual boundary. If you find a way to read another owner's rows with an anon
key, that is a real vulnerability and we want to hear about it.
