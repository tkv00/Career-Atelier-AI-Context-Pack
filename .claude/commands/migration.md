---
description: Add a Supabase migration that satisfies the append-only and RLS rules
---

Add a database migration: $ARGUMENTS

Migrations are append-only. Every contributor and every deployed instance has
already run the existing files, so editing one produces schemas that silently
disagree and no later migration can reconcile.

## Steps

1. Read the highest-numbered file in `supabase/migrations/` to match the house
   style, then create `supabase/migrations/00NN_snake_case.sql` with **NN one
   past the highest number that exists** — not one past the count, and never a
   number already used.

2. If you create a table, the same migration must also give it row level
   security and an owner policy. Copy the shape from
   `supabase/migrations/0003_rls_policies.sql`:

   ```sql
   alter table <name> enable row level security;
   create policy owner_all on <name> for all
     using (owner_id = auth.uid()) with check (owner_id = auth.uid());
   ```

   The anon key ships inside the client bundle by design. A table without RLS is
   readable by anyone who opens devtools, so this is the actual security
   boundary, not a formality.

3. Regenerate the types, or `web/` keeps typechecking against a database that no
   longer exists:

   ```bash
   supabase gen types typescript --linked > web/lib/supabase/database.types.ts
   ```

   This needs a linked Supabase project. If you do not have one, say so in your
   report rather than hand-editing the generated file.

4. Write the comments in Korean explaining **why** the change is shaped this way,
   matching the surrounding migrations.

5. Confirm the rules pass:

   ```bash
   npm run rules -- --base origin/main
   ```

   CA001, CA002, CA003, and CA009 all apply to what you just did.
