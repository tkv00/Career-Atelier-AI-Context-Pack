// 규칙이 "통과한다"는 것만으로는 아무것도 증명하지 못한다. 검사가 비어 있어도
// 통과하기 때문이다. 그래서 모든 테스트는 위반을 일부러 만들어 두고 그 규칙이
// 실제로 잡아내는지를 본다.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { rules, runRules, createContext, rulesDocument, rulesDocumentPath, sqlStatements, migrationTables } from '../lib/rules.mjs';

const manifest = { version: '0.1.0', private: true, license: 'MIT', packageManager: 'npm@10.9.2', engines: { node: '>=22.13.0' } };
const goodMigration = 'create table notes (id uuid primary key, owner_id uuid);\nalter table notes enable row level security;\ncreate policy owner_all on notes for all using (owner_id = auth.uid());\n';

function fixture(t, overrides = {}) {
  const root = mkdtempSync(join(tmpdir(), 'career-rules-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const files = {
    'README.md': '# Title\n\n## One\n',
    'README.ko.md': '# Title\n\n## One\n',
    'README.en.md': '# Title\n\n## One\n',
    'AGENTS.md': 'Run `npm run verify` and `npx tsc --noEmit` before you report.\n',
    'CLAUDE.md': 'See AGENTS.md.\n',
    'package.json': JSON.stringify(manifest),
    'web/package.json': JSON.stringify(manifest),
    'runner/package.json': JSON.stringify(manifest),
    '.nvmrc': '22\n',
    '.node-version': '22\n',
    'web/lib/env.ts': 'const forbidden = ["SUPABASE_SERVICE_ROLE_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY"];\n',
    'runner/safety.mjs': "if (!['codex', 'claude'].includes(provider)) throw new Error('bad');\n",
    'runner/execute.mjs': "import { spawnCodex } from './providers/codex.mjs';\nimport { spawnClaude } from './providers/claude.mjs';\n",
    'runner/providers/codex.mjs': 'export const spawnCodex = () => {};\n',
    'runner/providers/claude.mjs': 'export const spawnClaude = () => {};\n',
    'supabase/migrations/0001_init.sql': goodMigration,
    [rulesDocumentPath]: rulesDocument(),
    ...overrides,
  };
  for (const [path, content] of Object.entries(files)) {
    if (content === null) continue;
    mkdirSync(join(root, dirname(path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

function check(id, root, extra = {}) {
  const outcome = runRules(createContext({ root, ...extra }), [id]);
  const [result] = outcome.results;
  return { violations: result.violations, skipped: result.skipped, messages: result.violations.map(violation => `${violation.file} ${violation.message}`).join('\n') };
}

test('a clean tree passes every rule that does not need history', t => {
  const outcome = runRules(createContext({ root: fixture(t) }));
  const failing = outcome.results.filter(result => result.violations.length);
  assert.deepEqual(failing.map(result => `${result.rule.id}: ${result.violations[0].message}`), []);
  assert.equal(outcome.errors, 0);
  assert.equal(outcome.skipped, rules.filter(rule => rule.needs).length);
});

test('rules needing history are skipped rather than silently passing', t => {
  const root = fixture(t);
  for (const rule of rules.filter(rule => rule.needs)) assert.ok(check(rule.id, root).skipped, `${rule.id} should skip without a base`);
  // 얕은 클론에서 규칙이 통과로 보고되면 CI는 초록불인데 아무것도 검사하지 않은 셈이 된다.
  assert.ok(check('CA001', root, { changed: [] }).skipped === undefined);
});

test('CA001 rejects edits to migrations that were already applied', t => {
  const root = fixture(t);
  const edited = [{ status: 'M', path: 'supabase/migrations/0001_init.sql' }];
  assert.match(check('CA001', root, { changed: edited }).messages, /modified/);
  assert.match(check('CA001', root, { changed: [{ status: 'D', path: 'supabase/migrations/0001_init.sql' }] }).messages, /deleted/);
  assert.equal(check('CA001', root, { changed: [{ status: 'A', path: 'supabase/migrations/0002_next.sql' }] }).violations.length, 0);
});

test('CA002 rejects bad names, duplicate numbers, and numbers that jump backwards', t => {
  assert.match(check('CA002', fixture(t, { 'supabase/migrations/add_notes.sql': goodMigration })).messages, /00NN_snake_case/);
  assert.match(check('CA002', fixture(t, { 'supabase/migrations/0001_other.sql': goodMigration })).messages, /already used/);
  const root = fixture(t, { 'supabase/migrations/0007_late.sql': goodMigration, 'supabase/migrations/0003_early.sql': goodMigration });
  assert.match(check('CA002', root, { changed: [{ status: 'A', path: 'supabase/migrations/0003_early.sql' }] }).messages, /not above the highest existing migration 0007/);
  assert.equal(check('CA002', root, { changed: [{ status: 'A', path: 'supabase/migrations/0007_late.sql' }] }).violations.length, 0);
});

test('CA003 catches a table with no RLS and one with RLS but no policy', t => {
  assert.match(check('CA003', fixture(t, { 'supabase/migrations/0002_open.sql': 'create table leaks (id uuid);\n' })).messages, /never gets "enable row level security"/);
  assert.match(check('CA003', fixture(t, { 'supabase/migrations/0002_half.sql': 'create table half (id uuid);\nalter table half enable row level security;\n' })).messages, /no policy/);
  // RLS를 나중 마이그레이션에서 켜는 실제 패턴(0001~0002 생성, 0003에서 일괄 적용)을 통과시켜야 한다.
  const split = fixture(t, { 'supabase/migrations/0002_later.sql': 'create table split (id uuid);\n', 'supabase/migrations/0003_rls.sql': 'alter table split enable row level security;\ncreate policy owner_all on split for all using (true);\n' });
  assert.equal(check('CA003', split).violations.length, 0);
  // 만들었다가 지운 테이블에는 정책이 필요 없다.
  assert.equal(check('CA003', fixture(t, { 'supabase/migrations/0002_temp.sql': 'create table scratch (id uuid);\ndrop table scratch;\n' })).violations.length, 0);
});

test('CA003 does not attribute RLS across statements or count commented-out SQL', t => {
  const commented = 'create table notes2 (id uuid);\n-- alter table notes2 enable row level security;\n';
  assert.match(check('CA003', fixture(t, { 'supabase/migrations/0002_commented.sql': commented })).messages, /notes2/);
  const { created, secured } = migrationTables([{ path: 'x.sql', sql: 'create table a (id uuid);\ncreate table b (id uuid);\nalter table a enable row level security;\n' }]);
  assert.deepEqual([...created.keys()], ['a', 'b']);
  assert.deepEqual([...secured], ['a']);
  assert.equal(sqlStatements('-- comment\nselect 1;\n').length, 1);
});

test('CA004 and CA005 keep credentials and model calls out of web/', t => {
  assert.match(check('CA004', fixture(t, { 'web/app/route.ts': 'const key = process.env.OPENAI_API_KEY;\n' })).messages, /OPENAI_API_KEY/);
  assert.match(check('CA004', fixture(t, { 'web/lib/env.ts': 'const forbidden = [];\n' })).messages, /no longer rejects/);
  assert.equal(check('CA004', fixture(t, { 'runner/keys.mjs': 'process.env.OPENAI_API_KEY;\n' })).violations.length, 0, 'runner/ is allowed to hold credentials');
  assert.match(check('CA005', fixture(t, { 'web/lib/ai.ts': "await fetch('https://api.anthropic.com/v1/messages');\n" })).messages, /api\.anthropic\.com/);
  assert.match(check('CA005', fixture(t, { 'web/lib/ai.ts': "import OpenAI from 'openai';\n" })).messages, /openai/);
});

test('CA006 keeps the three README editions level', t => {
  assert.match(check('CA006', fixture(t, { 'README.ko.md': '# Title\n' })).messages, /byte for byte/);
  assert.match(check('CA006', fixture(t, { 'README.en.md': '# Title\n\n## One\n\n## Two\n' })).messages, /one edition is ahead/);
});

test('CA008 reports only dependencies the base revision did not have', t => {
  const root = fixture(t, { 'package.json': JSON.stringify({ ...manifest, dependencies: { left: '1.0.0', pad: '2.0.0' } }) });
  const base = { base: 'abc123', baseRead: path => (path === 'package.json' ? JSON.stringify({ ...manifest, dependencies: { left: '1.0.0' } }) : null) };
  assert.match(check('CA008', root, base).messages, /adds dependency "pad"/);
  assert.doesNotMatch(check('CA008', root, base).messages, /left/);
  assert.equal(runRules(createContext({ root, ...base }), ['CA008']).errors, 0, 'CA008 is a warning, not a failure');
  assert.equal(runRules(createContext({ root, ...base, strict: true }), ['CA008']).errors, 1, '--strict promotes it');
});

test('CA009 requires regenerated types whenever a migration lands', t => {
  const root = fixture(t);
  const added = [{ status: 'A', path: 'supabase/migrations/0002_new.sql' }];
  assert.match(check('CA009', root, { changed: added }).messages, /database\.types\.ts was not regenerated/);
  assert.equal(check('CA009', root, { changed: [...added, { status: 'M', path: 'web/lib/supabase/database.types.ts' }] }).violations.length, 0);
  assert.equal(check('CA009', root, { changed: [{ status: 'M', path: 'README.md' }] }).violations.length, 0);
});

test('CA010 finds committed keys and ignores ordinary prose', t => {
  // 진짜 키처럼 한 토큰으로 이어 붙여야 한다. 문자열을 쪼개면 파일에는 따옴표가 끼어 패턴이 빗나간다.
  assert.match(check('CA010', fixture(t, { 'runner/config.mjs': `const key = 'sk-ant-api03-${'A'.repeat(40)}';\n` })).messages, /Anthropic/);
  assert.match(check('CA010', fixture(t, { 'docs/notes.md': 'AIza' + 'B'.repeat(35) + '\n' })).messages, /Google/);
  // 확장자 없는 키 파일이 그물을 빠져나가지 않는지 본다. 표식은 런타임에 이어 붙인다 —
  // 이 파일 자체에 완전한 형태로 적으면 CA010이 자기 테스트를 유출로 신고한다.
  assert.match(check('CA010', fixture(t, { 'web/id_rsa': `-----BEGIN OPENSSH PRIVATE ${'KEY'}-----\n` })).messages, /private key/);
  assert.equal(check('CA010', fixture(t, { 'docs/notes.md': 'Set ANTHROPIC_API_KEY in runner/.env, never in web/.\n' })).violations.length, 0);
});

test('CA011 catches agent context files that stopped pointing at each other', t => {
  assert.match(check('CA011', fixture(t, { 'CLAUDE.md': 'Do whatever.\n' })).messages, /does not point at AGENTS\.md/);
  assert.match(check('CA011', fixture(t, { 'AGENTS.md': 'No commands here.\n' })).messages, /npm run verify/);
  assert.match(check('CA011', fixture(t, { '.mcp.json': '{"mcpServers":{"x":{"command":"node","args":["runner/mcp/gone.mjs"]}}}' })).messages, /does not exist/);
  assert.match(check('CA011', fixture(t, { '.mcp.json': '{ not json' })).messages, /valid JSON/);
});

test('CA012 fails when the generated rule document drifts from the rules', t => {
  assert.match(check('CA012', fixture(t, { [rulesDocumentPath]: '# Agent rules\n' })).messages, /out of date/);
  // core.autocrlf=true인 Windows 체크아웃에서는 같은 내용이 CRLF로 떨어진다.
  // 여기서 실패하면 Windows 기여자 전원이 고칠 수 없는 오탐을 만나게 된다.
  const windows = { [rulesDocumentPath]: rulesDocument().replace(/\n/g, '\r\n'), 'README.md': '# T\r\n\r\n## One\r\n', 'README.ko.md': '# T\r\n\r\n## One\r\n', 'README.en.md': '# T\n\n## One\n' };
  assert.equal(check('CA012', fixture(t, windows)).violations.length, 0);
  assert.equal(check('CA006', fixture(t, windows)).violations.length, 0);
  // 문서에는 규칙 번호와 고치는 방법이 모두 들어 있어야 에이전트가 스스로 복구한다.
  const document = rulesDocument();
  for (const rule of rules) assert.ok(document.includes(rule.id) && document.includes(rule.fix), `${rule.id} is missing from the generated document`);
});

test('CA013 enforces English imperative commit subjects', t => {
  const root = fixture(t);
  const subjects = commits => check('CA013', root, { commits: commits.map((subject, index) => ({ sha: `${index}`.repeat(8), subject })) }).messages;
  assert.match(subjects(['Added the calendar']), /not imperative/);
  assert.match(subjects(['add the calendar']), /capital letter/);
  assert.match(subjects(['Add the calendar.']), /period/);
  assert.match(subjects(['캘린더 추가']), /English ASCII/);
  assert.match(subjects([`Add ${'x'.repeat(80)}`]), /keep it under 72/);
  assert.equal(check('CA013', root, { commits: [{ sha: 'a'.repeat(8), subject: 'Add per-stage outcome tracking to the calendar' }] }).violations.length, 0);
  assert.equal(check('CA013', root, { commits: [{ sha: 'b'.repeat(8), subject: "Merge branch 'main' into feature." }] }).violations.length, 0, 'merge commits are git-generated');
});

test('CA014 and CA015 catch a split toolchain and a half-wired provider', t => {
  assert.match(check('CA014', fixture(t, { 'runner/package.json': JSON.stringify({ ...manifest, engines: { node: '>=20' } }) })).messages, /engines\.node is >=20/);
  assert.match(check('CA014', fixture(t, { '.nvmrc': '20\n' })).messages, /\.node-version/);
  assert.match(check('CA015', fixture(t, { 'runner/safety.mjs': "if (!['codex', 'claude', 'gemini'].includes(provider)) throw new Error('bad');\n" })).messages, /runner\/providers\/gemini\.mjs does not exist/);
  assert.match(check('CA015', fixture(t, { 'runner/execute.mjs': "import { spawnCodex } from './providers/codex.mjs';\n" })).messages, /"claude" is allowed but never imported/);
  assert.match(check('CA015', fixture(t, { 'runner/safety.mjs': 'export const anything = 1;\n' })).messages, /no provider allowlist/);
});

test('a rule that throws is reported instead of quietly passing', () => {
  const broken = { id: 'CAX', title: 'Broken', what: '', why: '', fix: '', check: () => { throw new Error('boom'); } };
  rules.push(broken);
  try {
    const outcome = runRules(createContext({ root: process.cwd(), files: [] }), ['CAX']);
    assert.equal(outcome.errors, 1);
    assert.match(outcome.results[0].violations[0].message, /check threw: boom/);
  } finally { rules.pop(); }
});
