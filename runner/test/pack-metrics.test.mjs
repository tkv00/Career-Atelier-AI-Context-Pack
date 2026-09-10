import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { countPackReferences, measurePack, packFileNames, summarizeReferences } from '../pack-metrics.mjs';
import { pruneWorkspaces } from '../context-pack.mjs';

function fixturePack() {
  const dir = mkdtempSync(resolve(tmpdir(), 'pack-metrics-'));
  writeFileSync(resolve(dir, '01-questions.md'), '## 문항\n지원 동기를 쓰시오.');
  writeFileSync(resolve(dir, '04-experiences.md'), '### 결제 정산 개선\n- 결과: 응답 2.4초 → 0.38초');
  mkdirSync(resolve(dir, 'nested'));
  return dir;
}

test('팩 계측은 파일만 세고 토큰은 추정값으로 표시한다', () => {
  const dir = fixturePack();
  try {
    const manifest = measurePack(dir);
    assert.equal(manifest.file_count, 2, '하위 디렉터리는 파일로 세지 않는다');
    assert.deepEqual(manifest.files.map(file => file.name), ['01-questions.md', '04-experiences.md']);
    assert.equal(manifest.total_chars, manifest.files.reduce((sum, file) => sum + file.chars, 0));
    assert.ok(manifest.total_tokens_est > 0);
    assert.equal(manifest.measurement, 'chars_measured_tokens_estimated');
    assert.deepEqual(packFileNames(dir).sort(), ['01-questions.md', '04-experiences.md']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('프롬프트를 되돌려 주는 user 이벤트는 참조로 세지 않는다', () => {
  const packFiles = ['01-questions.md', '04-experiences.md'];
  const counts = {};
  // Claude stream-json은 우리가 보낸 프롬프트를 user 이벤트로 그대로 돌려준다.
  const echo = JSON.stringify({ type: 'user', message: { content: '01-questions.md와 04-experiences.md를 읽어라' } });
  countPackReferences(echo, JSON.parse(echo), packFiles, counts);
  assert.deepEqual(counts, {}, 'user 이벤트만으로는 참조가 잡히면 안 된다');

  const toolUse = JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', input: { file_path: '/w/context/01-questions.md' } }] } });
  countPackReferences(toolUse, JSON.parse(toolUse), packFiles, counts);

  const summary = summarizeReferences(counts, packFiles);
  assert.deepEqual(summary.referenced_files, ['01-questions.md']);
  assert.deepEqual(summary.unreferenced_files, ['04-experiences.md']);
  assert.equal(summary.referenced_count, 1);
  assert.equal(summary.file_count, 2);
  assert.equal(summary.measurement, 'name_appeared_in_stream_not_confirmed_read');
});

test('보관 기한이 지난 작업 폴더만 지운다', () => {
  const root = resolve(process.env.HOME ?? tmpdir(), '.career-atelier', 'workspaces');
  const fresh = resolve(root, 'prune-test-fresh');
  const stale = resolve(root, 'prune-test-stale');
  mkdirSync(fresh, { recursive: true });
  mkdirSync(stale, { recursive: true });
  writeFileSync(resolve(stale, 'draft.md'), '개인 자료');
  const old = Date.now() / 1000 - 30 * 24 * 60 * 60;
  utimesSync(stale, old, old);
  try {
    const result = pruneWorkspaces(7);
    assert.ok(result.scanned >= 2);
    assert.throws(() => packFileNames(stale), '기한이 지난 폴더는 사라져야 한다');
    assert.deepEqual(packFileNames(fresh), [], '최근 폴더는 남아 있어야 한다');
  } finally {
    rmSync(fresh, { recursive: true, force: true });
    rmSync(stale, { recursive: true, force: true });
  }
});
