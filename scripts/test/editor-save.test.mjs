import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../../web/app/(app)/essays/[id]/editor-client.tsx', import.meta.url), 'utf8');
// checkout의 줄바꿈 정책과 무관하게 소스 계약을 같은 기준으로 검사한다.
const normalizedSource = source.replace(/\r\n/g, '\n');
const body = normalizedSource.split('const performCloudSave = useCallback(async () => {')[1].split('}, [essay.id, maybeSnapshot]);')[0].replace('const result: SaveDraftResult', 'const result');
function editor(saveDraft) {
  const state = { savingRef: { current: false }, recoveredRef: { current: true }, conflictRef: { current: null }, contentRef: { current: 'A' }, revisionRef: { current: 1 }, dirtyRef: { current: true }, lastCloudSaveAt: { current: 0 }, essay: { id: 'test' }, saveDraft, status: null, snapshots: [], local: [] };
  Object.assign(state, { setSaveStatus: value => state.status = value, setRevision: () => {}, setDirty: () => {}, setConflict: () => {}, maybeSnapshot: value => state.snapshots.push(value), saveLocalDraft: async (...args) => state.local.push(args) });
  state.save = new Function(...Object.keys(state), `return (async () => {${body}})();`).bind(null, ...Object.values(state));
  return state;
}

test('editor preserves edits made during a save and snapshots the submitted text', async () => {
  let finish; let calls = 0;
  const state = editor(async () => { calls++; return new Promise(resolve => finish = resolve); });
  const pending = state.save();
  state.contentRef.current = 'B';
  await state.save();
  assert.equal(calls, 1);
  finish({ ok: true, revision: 2 });
  await pending;
  assert.equal(state.dirtyRef.current, true);
  assert.equal(state.revisionRef.current, 2);
  assert.equal(state.status, 'idle');
  assert.deepEqual(state.snapshots, ['A']);
  assert.deepEqual(state.local, [['test', 'B', 2]]);
});

test('editor pauses before recovery and on conflict, and releases failed saves', async () => {
  let calls = 0;
  const state = editor(async () => { calls++; throw new Error('offline'); });
  state.recoveredRef.current = false;
  await state.save();
  assert.equal(calls, 0);
  state.recoveredRef.current = true;
  state.conflictRef.current = {};
  await state.save();
  assert.equal(calls, 0);
  state.conflictRef.current = null;
  await state.save();
  assert.equal(state.savingRef.current, false);
  assert.equal(state.dirtyRef.current, true);
  assert.equal(state.status, 'error');
});

test('recovering a stale or legacy draft preserves its base revision across another reload', async () => {
  const recovery = normalizedSource.split('deviceNameRef.current = getDeviceName();\n    (async () => {')[1].split('})();')[0];
  for (const baseRevision of [1, null]) {
    const state = { loadLocalDraft: async () => ({ content: 'offline draft', baseRevision }), essay: { id: 'essay', draft: 'new server draft', revision: 2, updated_at: 'now' }, contentRef: { current: 'new server draft' }, dirtyRef: { current: false }, revisionRef: { current: 2 }, conflictRef: { current: null }, recoveredRef: { current: false }, lastKeystrokeAt: { current: 0 }, now: 1000, TYPING_QUIET_MS: 2, setContent: () => {}, setDirty: () => {}, setRevision: () => {}, setConflict: () => {}, setSaveStatus: () => {} };
    await new Function(...Object.keys(state), `return (async () => {${recovery}})();`)(...Object.values(state));
    assert.equal(state.revisionRef.current, baseRevision ?? -1);
    assert.equal(state.conflictRef.current.serverRevision, 2);
    assert.equal(state.contentRef.current, 'offline draft');
    assert.equal(state.recoveredRef.current, true);
  }
});
