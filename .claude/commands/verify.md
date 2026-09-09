---
description: Run the project rules and checks, then report only what was actually exercised
---

Verify the current working tree the way this project's CI will.

1. Run the rules first, because they are fast and need no install:

   ```bash
   npm run rules -- --base origin/main
   ```

   If `origin/main` does not resolve (a fresh clone, a detached checkout), drop
   `--base` and say in your report that the history-aware rules were skipped.

2. Fix every failure. Each rule prints the file, the problem, and the fix, and
   [docs/AGENT-RULES.md](../../docs/AGENT-RULES.md) explains why the rule exists.
   Fix the cause, not the check — if you believe a rule is wrong, say so in your
   report and leave it failing rather than editing `scripts/lib/rules.mjs` to
   make it pass.

3. Then run the rest:

   ```bash
   npm run verify
   ```

4. If you touched `runner/`, static checks prove almost nothing. Start it and
   exercise the path you changed:

   ```bash
   npm start
   ```

## Reporting

State what you ran and what it printed. Separate three categories explicitly:

- **Verified.** You ran it and saw the result.
- **Checked statically only.** It typechecks and the rules pass, but nothing
  executed that code.
- **Not verified.** You could not run it. Say why — no Supabase project, no
  subscription for that provider, no tty. An honest gap is more useful than an
  implied pass.

Do not write "should work" or "verified" for anything in the last two groups.
This project's bug history is mostly defects that passed every static check.
