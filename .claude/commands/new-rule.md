---
description: Turn a project convention into an executable rule the pipeline enforces
---

Add a rule: $ARGUMENTS

A convention that lives only in prose is a convention that drifts. Rules live in
`scripts/lib/rules.mjs`, and `docs/AGENT-RULES.md` is generated from them, so the
description and the check cannot disagree.

## Write the rule

Append one object to the `rules` array with the next `CA0NN` id:

- `title` — what holds when the rule passes, in the present tense.
- `what` — the precise condition, specific enough to argue with.
- `why` — the consequence of breaking it. Prefer a consequence this project has
  actually hit over a general principle.
- `fix` — the command or edit that resolves it. This line is printed to whoever
  fails the check, so make it actionable.
- `check(context)` — returns `[{ file, line?, message }]`. Return `[]` to pass.
- `severity: 'warn'` for anything needing human judgement rather than a verdict.
- `needs: 'diff' | 'commits' | 'base'` if it compares against history. The runner
  then reports it as **skipped** on a shallow clone rather than passing it, which
  is what keeps a green CI from being meaningless.

`check` receives a context, never raw `fs` or `git`: `read(path)`, `exists`,
`under(prefix)`, `text()`, `files`, `changed`, `changedPaths([statuses])`,
`commits`, and `baseRead(path)`. Keep it pure so it can be tested against a temp
directory.

## Test that it fires

Add a case to `scripts/test/rules.test.mjs`. A test that only asserts the clean
fixture passes proves nothing — an empty check passes too. Build a fixture that
**violates** the rule and assert on the message, then assert that a legitimate
near-miss does not trip it:

```js
assert.match(check('CA0NN', fixture(t, { 'path/to/bad.ts': '...' })).messages, /expected phrase/);
assert.equal(check('CA0NN', fixture(t, { 'path/to/fine.ts': '...' })).violations.length, 0);
```

False positives are worse than a missing rule. A check that cries wolf gets
ignored, and then the real failures are ignored with it.

## Finish

```bash
npm run rules:docs      # regenerate docs/AGENT-RULES.md (CA012 fails without this)
npm test
npm run rules
```

Then check the rule against the existing repository, not just your fixture: if it
fails on code that is already correct, the rule is wrong.
