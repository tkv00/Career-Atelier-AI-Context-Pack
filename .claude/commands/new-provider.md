---
description: Wire a new AI CLI provider into the runner harness
---

Add a CLI provider: $ARGUMENTS

Read `docs/HARNESS-ENGINEERING.md` sections 5 through 7 first. That section is a
list of things that cost real debugging time; assume the new CLI has its own.

## The four edits

1. **Harness** — `runner/providers/<slug>.mjs` exporting `spawn<Provider>` and
   `extractOutput`.
2. **Login check** — `runner/safety.mjs`: add the slug to the allowlist and add a
   `providerStatus` branch that detects both "CLI installed" and "signed in".
3. **Schema rules** — `runner/schema-compat.mjs`, if the tool rejects schema
   shapes the other three accept.
4. **Execution** — `runner/execute.mjs`: import the harness and map the process
   and its output.

Rule CA015 fails the build when the allowlist and these files disagree, which is
the failure mode this checklist exists to prevent.

## Non-negotiables

- **Strip API keys from the child environment.** The premise of this project is
  that agents run on the user's own subscription. If the CLI falls back to a
  metered API key when its login is missing, it will silently bill the user.
  Remove `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` and the like
  from the spawned environment, and refuse to run when the subscription login
  cannot be confirmed.
- **Block paid overage.** If the CLI reports overage in its stream the way
  Claude Code does with `isUsingOverage`, kill the process and stop the job.
- **Windows.** `codex`, `claude`, and `agy` are `.cmd` shims there, so the runner
  spawns through `cross-spawn`, and long prompts go over stdin rather than argv
  because `.cmd` truncates multi-line arguments. Send EOF explicitly: a headless
  child with `stdin: 'ignore'` fails with `os error 2`.

## Verify

```bash
npm run rules -- --base origin/main
npm start
```

Run one job of each kind through the new provider. Report what you ran; if you
could not sign in to that CLI, say that instead of implying it works.
