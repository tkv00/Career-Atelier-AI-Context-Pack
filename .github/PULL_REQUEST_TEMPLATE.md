## Summary

Describe the goal and rationale of your changes. What problem does this PR solve, and why is this approach chosen?

## Related Issue

Closes #
<!-- or: Relates to # -->

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Refactoring / Code style improvement
- [ ] Documentation update
- [ ] Database migration

## Verification & Testing

Static checks (`tsc`, `lint`) are necessary but not sufficient. Describe what you actually ran and exercised:

- [ ] What runtime steps did you perform? (e.g. "Started runner, submitted review job, confirmed output saved to artifacts table")
- [ ] Which AI CLI provider(s) did you test against, if runner changes were made? (e.g. Codex, Claude Code, Antigravity)

Was this pull request written with an AI agent? If so, say which one, and say plainly what it could not run. An honest gap is easier to review than an implied pass.

## Checklist

- [ ] `npm run rules -- --base origin/main` passes. Any warning it reported (for example a new dependency) is justified above
- [ ] `npm run verify` passes: version consistency, rules, tests, and `web/`'s typecheck, lint, and build
- [ ] My code follows the project conventions (e.g. Korean comments explaining rationale, English imperative commit messages)
- [ ] No API keys, credentials, or secrets are exposed or required in `web/`
- [ ] If changing database schema, migrations are append-only (`supabase/migrations/00NN_*.sql`), RLS is enabled, and `web/lib/supabase/database.types.ts` is regenerated
- [ ] If changing documentation, Korean `README.md` and `README.ko.md` match, and `README.en.md` is updated in parallel

The rules above are checked automatically and explained in [docs/AGENT-RULES.md](../docs/AGENT-RULES.md). If one of them is wrong for your change, leave it failing and say why here rather than editing the check.
