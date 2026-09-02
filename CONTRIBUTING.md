# Contributing to Career Atelier

Thanks for taking the time to contribute. This document covers how to get a
development environment running and what we expect from a change.

## Getting set up

You need Node.js 22+ and the [Supabase CLI](https://supabase.com/docs/guides/cli).
Every contributor runs against **their own** Supabase project — there is no shared
development database.

```bash
git clone https://github.com/tkv00/Career-Atelier-AI-Context-Pack.git
cd Career-Atelier-AI-Context-Pack
npm run setup
```

`npm run setup` checks your tooling, links your Supabase project, applies the
migrations, and writes `web/.env.local` and `runner/.env`. See
[docs/USER-GUIDE.md](docs/USER-GUIDE.md) for the full walkthrough.

## Project layout

| Path | What lives there |
|---|---|
| `web/` | Next.js app deployed to Vercel. Never calls an LLM, never holds a provider key. |
| `runner/` | Local Node process that runs the agents through your own CLI subscriptions. Never deployed. |
| `supabase/migrations/` | Append-only SQL migrations. |
| `docs/` | Architecture, setup, and verification notes. |

The split matters: **`web/` must stay free of AI credentials.** `web/lib/env.ts`
throws at build time if a key like `OPENAI_API_KEY` is present. That is a
safety rail, not an obstacle to route around.

## Making a change

1. Branch from `main`.
2. Keep migrations append-only — add `00NN_your_change.sql`, never edit an
   applied file. Regenerate `web/lib/supabase/database.types.ts` after a schema
   change.
3. Run the checks below before opening a PR.
4. Describe what you verified, not just what you wrote. "Typechecks" is not
   verification; "created a job post, toggled the stage chip, confirmed
   `stage_results` in the database" is.

```bash
cd web && npx tsc --noEmit && npm run lint && npm run build
```

## Style

- Match the surrounding code. The codebase uses Korean comments that explain
  *why* a decision was made — especially where something non-obvious was learned
  the hard way. Keep that habit; English comments are fine in new files if the
  surrounding file is English.
- No new dependencies without a reason that cannot be met by the standard
  library or what is already installed.
- Comments explain reasoning, not mechanics. Do not narrate what the next line
  obviously does.

## Reporting bugs

Open an issue with your OS, Node version, and which part failed (web, runner, or
setup). Runner problems: include the console output from `npm run start`.
Redact your Supabase URL and any email addresses.

## Security

Do not open a public issue for a security problem. Email the maintainer or use
GitHub's private vulnerability reporting.

Note that the anon key is *designed* to be public — row level security is the
actual boundary. If you find a way to read another owner's rows with an anon
key, that is a real vulnerability and we want to hear about it.
