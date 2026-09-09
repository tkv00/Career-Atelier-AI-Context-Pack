import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { runBackup } from '../backup.mjs';

test('backup paginates all records and preserves the previous file on read failure', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'atelier-backup-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const rows = Array.from({ length: 1201 }, (_, id) => ({ id }));
  let fail = false;
  const db = { from: table => ({ select: () => ({ order: () => ({ range: async (start, end) => {
    if (fail) return { error: { message: 'unavailable' } };
    return { data: table === 'education_records' ? rows.slice(start, end + 1) : [] };
  } }) }) }) };
  const result = await runBackup(db, directory);
  const original = await readFile(result.filePath, 'utf8');
  const payload = JSON.parse(original);
  assert.equal(payload.tables.education_records.length, 1201);
  assert.ok('record_attachments' in payload.tables);
  assert.ok('company_research_attachments' in payload.tables);
  assert.equal(payload.format_version, 2);
  fail = true;
  await assert.rejects(runBackup(db, directory), /unavailable/);
  assert.equal(await readFile(result.filePath, 'utf8'), original);
  assert.equal((await readdir(directory)).length, 1);
});
