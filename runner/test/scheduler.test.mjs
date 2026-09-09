import assert from 'node:assert/strict';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { enqueueDailySearch } from '../scheduler.mjs';

test('daily search executes HTTP, observes approval, retries failures and deduplicates across runners', async () => {
  let approved = false; let fail = false; let inserts = 0;
  const ids = new Set();
  const db = createClient('https://test.invalid', 'test-key', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (_url, options) => {
    if (options.method === 'GET') return Response.json({ approved });
    inserts++;
    if (fail) return Response.json({ message: 'unavailable', code: '500' }, { status: 500 });
    const { id } = JSON.parse(options.body);
    if (ids.has(id)) return Response.json({ code: '23505', message: 'duplicate' }, { status: 409 });
    ids.add(id);
    return new Response(null, { status: 201 });
  } } });
  const now = new Date('2026-09-09T06:00:00Z');
  assert.equal(await enqueueDailySearch(db, 'owner', 'runner', now), false);
  assert.equal(inserts, 0);
  approved = true; fail = true;
  await assert.rejects(enqueueDailySearch(db, 'owner', 'runner', now));
  fail = false;
  assert.equal(await enqueueDailySearch(db, 'owner', 'runner', now), true);
  assert.equal(await enqueueDailySearch(db, 'owner', 'other-runner', now), false);
  assert.equal(await enqueueDailySearch(db, 'other-owner', 'runner', now), true);
  assert.equal(ids.size, 2);
});
