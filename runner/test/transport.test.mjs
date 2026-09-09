import test from 'node:test';
import assert from 'node:assert/strict';
import spawn from 'cross-spawn';
import { fileURLToPath } from 'node:url';
import { buildClaudeArgs, extractOutput } from '../providers/claude.mjs';
import { buildCodexArgs } from '../providers/codex.mjs';
import { buildGeminiArgs, encodeGeminiInput, extractOutput as extractGeminiOutput } from '../providers/gemini.mjs';

test('provider options exclude prompt text and retain search and JSON flags', () => {
  const prompt = 'FIRST\nSEARCH\nLAST';
  const schema = JSON.stringify({ type: 'object', properties: {} });
  const claude = buildClaudeArgs({ prompt, jsonSchema: schema });
  const codex = buildCodexArgs({ workspace: process.cwd(), prompt, model: 'gpt-6-astra', liveWebSearch: true });
  assert.ok(!claude.includes(prompt) && !codex.includes(prompt));
  assert.ok(claude.includes('stream-json') && claude.includes(schema));
  assert.ok(claude.includes('WebSearch') && claude.includes('Read'));
  assert.deepEqual(codex.slice(0, 2), ['--search', 'exec']);
  assert.deepEqual(codex.slice(codex.indexOf('-m'), codex.indexOf('-m') + 2), ['-m', 'gpt-6-astra']);
  assert.equal(codex.at(-1), '-');
});

test('Claude structured output takes priority over conversational result', () => {
  const structured = { items: [{ title: 'news' }] };
  assert.deepEqual(extractOutput({ type: 'result', result: 'Done', structured_output: structured }), structured);
  assert.equal(extractOutput({ type: 'result', is_error: true, result: 'failed' }), '');
});

test('Windows CMD drops multiline argv and following flags (regression evidence)', { skip: process.platform !== 'win32' }, () => {
  const file = fileURLToPath(new URL('../fixtures/argv-probe.cmd', import.meta.url));
  const r = spawn.sync(file, ['-p', 'FIRST\nSECOND', '--output-format', 'stream-json'], { encoding: 'utf8', input: '', timeout: 5000 });
  assert.equal(r.status, 0);
  assert.deepEqual(JSON.parse(r.stdout).args, ['-p', 'FIRST']);
});

test('stdin preserves long Korean prompts and flags across process boundaries', () => {
  const windows = process.platform === 'win32';
  const file = fileURLToPath(new URL(`../fixtures/argv-probe.${windows ? 'cmd' : 'cjs'}`, import.meta.url));
  const args = ['-p', '--output-format', 'stream-json'];
  const prompt = ('루미\r\n실제 검색하세요\n"인용" %PATH% & | < > ^ ! 한글\n').repeat(1000);
  const r = spawn.sync(windows ? file : process.execPath, windows ? args : [file, ...args], { encoding: 'utf8', input: prompt, timeout: 5000 });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), { args, input: prompt });
});

test('Gemini preserves long Korean input through NDJSON and uses a schema path', () => {
  const windows = process.platform === 'win32';
  const file = fileURLToPath(new URL(`../fixtures/argv-probe.${windows ? 'cmd' : 'cjs'}`, import.meta.url));
  const prompt = ('한글\r\n두 번째 줄 "인용" %PATH% & | < > ^ !\n').repeat(1000);
  const args = buildGeminiArgs({ model: 'gemini-3.7-flash-medium', schemaPath: 'schema/gemini-output.json' });
  assert.ok(args.join(' ').length < 1000);
  assert.ok(!args.includes(prompt));
  const input = encodeGeminiInput(prompt);
  const result = spawn.sync(windows ? file : process.execPath, windows ? args : [file, ...args], { encoding: 'utf8', input, timeout: 5000 });
  assert.equal(result.status, 0, result.stderr);
  const received = JSON.parse(result.stdout);
  assert.deepEqual(received.args, args);
  assert.equal(JSON.parse(received.input).message.content[0].text, prompt);
  assert.equal(JSON.parse(received.input).event, 'user');
  assert.throws(() => buildGeminiArgs({ model: 'bad\nmodel' }), /줄바꿈/);
});

test('Gemini extracts the nested final result and refuses ERROR responses', () => {
  const structured = { probe: 'token' };
  assert.deepEqual(extractGeminiOutput({ event: 'result', result: { status: 'SUCCESS', structured_output: structured, response: 'Done' } }, ''), structured);
  assert.equal(extractGeminiOutput({ event: 'result', result: { status: 'ERROR', response: 'failed' } }, ''), '');
});
