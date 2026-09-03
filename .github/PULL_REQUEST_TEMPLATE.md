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

## Checklist

- [ ] My code follows the project conventions (e.g. Korean comments explaining rationale, English imperative commit messages)
- [ ] `web/` passes static checks: `npx tsc --noEmit && npm run lint && npm run build`
- [ ] No API keys, credentials, or secrets are exposed or required in `web/`
- [ ] If changing database schema, migrations are append-only (`supabase/migrations/00NN_*.sql`) and RLS is enabled
- [ ] If changing documentation, `README.md` and `README.ko.md` are updated in parallel with zero emojis
