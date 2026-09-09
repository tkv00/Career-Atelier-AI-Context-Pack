---
description: Add a new AI assistant to the runner harness, wired end to end
---

Add a new assistant: $ARGUMENTS

Read `docs/HARNESS-ENGINEERING.md` sections 2, 4, and 7 first. An assistant that
is only half-wired fails at runtime for the user who picks it, and no static
check catches that.

## The four edits

1. **Context pack and schema** — `runner/context-pack.mjs`. Add
   `createXxxContextPack()` and the output JSON schema. Give every schema
   property a `description`: Antigravity fills description-less fields with
   meta-summaries like "task complete" instead of real values. Do not hand-tune
   the schema per provider; `runner/schema-compat.mjs` normalizes it for all
   three.

2. **Handler** — `runner/index.mjs`. Add `processXxxJob()` and call
   `recordAndRun()`.

3. **Dispatch** — the `processJob` switch in `runner/index.mjs`, keyed on
   `job.kind`.

4. **Prompt seed** — a new `supabase/migrations/00NN_seed_xxx_prompt.sql`
   inserting into `prompt_templates`. Append-only, one past the highest number.

## If the assistant asserts facts about the user

Anything that writes prose about the user's experience needs the three layers
that `writer` has, because a model will otherwise invent a plausible
achievement:

- refuse to run when the user has no source rows at all;
- require an `evidence` array in the schema, carrying the source row id;
- compare each returned `evidence[].experience_id` against the user's real id
  set **in plain code** after the run, and record mismatches as violations.

Layers one and three are code. A prompt instruction is not a substitute.

## Verify

```bash
npm run rules -- --base origin/main
npm start
```

Then actually queue a job of the new kind and confirm the row it writes. Say in
your report which provider you ran it against, and name any provider you could
not test because you lack that subscription.
