import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../index.mjs', import.meta.url), 'utf8');
const handler = source.slice(source.indexOf('async function processWriterJob('), source.indexOf('async function processNewsJob('));

test('writer receives company research and propagates failed artifact writes', async () => {
  const research = [{ body: 'Verified company fact', sources: ['https://example.invalid'] }];
  let pack; let options;
  const tables = { essay_projects: { id: 'essay', job_id: 'job', draft: '', question: 'Why?', title: 'test' }, experience_cards: [{ id: 'experience' }], prompt_templates: { body: 'write', provider: 'codex' }, essay_revision_requests: [], job_posts: { role: 'engineer' }, research_notes: research };
  const db = { from: table => {
    const builder = new Proxy({}, { get: (_, key) => key === 'then'
      ? resolve => resolve({ data: tables[table], error: null })
      : key === 'throwOnError' && table === 'artifacts'
        ? async () => { throw new Error('artifact denied'); }
        : () => builder });
    return builder;
  } };
  const deps = { REVISION_HISTORY_LIMIT: 6, providerFor: () => 'codex', modelFor: () => '', effortFor: () => '', randomUUID: () => 'run', selectExperiences: experiences => ({ experiences, manifest: {} }), experienceCardMarkdown: () => '', createWriterContextPack: (_id, context) => { pack = context; return { workspace: '/unused', contextDir: '/unused/context', schemaPath: '/unused/schema' }; }, writeFileSync: () => {}, resolve: (...parts) => parts.join('/'), systemRulesFor: () => '', schemaArgsFor: () => ({}), WRITER_OUTPUT_SCHEMA: {}, writeSchema: () => {}, recordAndRun: async (_db, _owner, _job, value) => { options = value; }, continuePipeline: async () => {} };
  const run = new Function(...Object.keys(deps), `return ${handler}`)(...Object.values(deps));
  await run(db, 'owner', { id: 'job', payload: { essayId: 'essay' } });
  assert.deepEqual(pack.companyResearch, research);
  assert.match(options.prompt, /03-company-research/);
  await assert.rejects(options.onComplete({ output: '{"draft":"text","evidence":[]}' }, { id: 'run', provider: 'codex' }), /artifact denied/);
});
