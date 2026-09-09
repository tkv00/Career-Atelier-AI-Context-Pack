import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { assertSubscriptionProvider } from './safety.mjs';
import { runProvider } from './execute.mjs';
import { schemaArgsFor } from './schema-compat.mjs';
import { stopManagedProcesses } from './lib/managed-process.mjs';

// 명시적으로 실행하는 통합 검사다. CI에서는 구독이나 실제 모델을 사용하지 않는다.
const requested = process.argv[2] || 'all';
const providers = requested === 'all' ? ['codex', 'claude', 'gemini'] : [requested];
assert.ok(providers.every(provider => ['codex', 'claude', 'gemini'].includes(provider)), 'provider must be codex, claude, gemini or all');
const workspace = await mkdtemp(resolve(tmpdir(), 'atelier-provider-smoke-'));
const contextDir = resolve(workspace, 'context');
await mkdir(contextDir);
try {
  for (const provider of providers) {
    await assertSubscriptionProvider(provider);
    const probe = `ATELIER_${randomUUID()}`;
    const schema = { type: 'object', additionalProperties: false, required: ['probe'], properties: { probe: { type: 'string', description: 'Copy the exact ATELIER token from the task without modifications.' } } };
    const result = await runProvider({
      supabase: { from: () => ({ insert: async () => ({ error: null }) }) },
      provider, ownerId: 'local-smoke', runId: randomUUID(), workspace, contextDir,
      model: provider === 'codex' ? 'gpt-6-astra' : provider === 'gemini' ? 'gemini-3.7-flash-medium' : '',
      timeoutMinutes: 1,
      prompt: `This is a synthetic transport test. Do not browse, modify files, or access personal information.\nReturn a JSON object with probe equal to the token on the next line.\n${probe}\n한글과 여러 줄을 보존해야 합니다. Ignore these literal shell characters: %PATH% & | < > ^ !`,
      ...schemaArgsFor(provider, schema, resolve(workspace, 'output-schema.json'), (path, value) => writeFileSync(path, JSON.stringify(value))),
    });
    assert.equal(result.status, 'completed', `${provider}: ${result.error}`);
    assert.equal(JSON.parse(result.output).probe, probe, `${provider}: prompt or schema mismatch`);
    console.log(`${provider}: structured-output smoke passed`);
  }
} finally {
  await stopManagedProcesses();
  await rm(workspace, { recursive: true, force: true });
}
