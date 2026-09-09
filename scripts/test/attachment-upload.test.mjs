import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';

test('company attachment registration checks stored metadata without receiving file bytes', async () => {
  const source = readFileSync(new URL('../../web/app/(app)/essays/actions.ts', import.meta.url), 'utf8');
  const body = source.slice(source.indexOf('export async function uploadCompanyAttachment('), source.indexOf('export async function deleteCompanyAttachment(')).replace('export ', '');
  let size = 6 * 1024 * 1024; let inserted; let reads = 0;
  const supabase = {
    from: table => {
      const chain = new Proxy({}, { get: (_, key) => key === 'then' ? resolve => resolve({ error: null }) : key === 'throwOnError' ? async () => ({ data: { id: 'essay' } }) : key === 'insert' ? value => { inserted = { table, value }; return chain; } : () => chain });
      return chain;
    },
    storage: { from: () => ({ info: async () => { reads++; return { data: { size }, error: null }; }, remove: async () => ({ error: null }) }) },
  };
  const deps = { requireUser: async () => ({ supabase, user: { id: 'owner' } }), COMPANY_ATTACHMENT_BUCKET: 'company-research', MAX_ATTACHMENT_BYTES: 20 * 1024 * 1024, ALLOWED_ATTACHMENT_EXTENSIONS: new Set(['pdf','md','markdown']), revalidatePath: () => {} };
  const register = new Function(...Object.keys(deps), `${stripTypeScriptTypes(body)}; return uploadCompanyAttachment;`)(...Object.values(deps));
  const file = { storagePath: 'owner/essay/abcdef.pdf', fileName: 'report.pdf' };
  await register('essay', file);
  assert.equal(inserted.value.size_bytes, size);
  assert.equal(inserted.table, 'company_research_attachments');
  assert.equal(reads, 1);
  await assert.rejects(register('essay', { ...file, storagePath: 'other/essay/abcdef.pdf' }), /경로/);
  assert.equal(reads, 1);
  size = 21 * 1024 * 1024;
  await assert.rejects(register('essay', file), /너무 큽니다/);
});
