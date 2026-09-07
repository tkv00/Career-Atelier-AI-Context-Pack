import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { planImport, callTool } from '../mcp/server.mjs';
import { loadSource, NOTION_VERSION } from '../mcp/sources.mjs';
import { tableToItems } from '../mcp/tabular.mjs';
import { writeFixture, examples, notionRow, headers } from '../mcp/research/fixtures.mjs';
import { createResearchClient } from '../mcp/research/client.mjs';
import { writeRows, buildRows } from '../mcp/store.mjs';

process.env.CAREER_MCP_METRICS_DISABLED = '1';
const directory = await mkdtemp(join(tmpdir(), 'career-mcp-test-'));
test.after(() => rm(directory, { recursive: true, force: true }));

test('Markdown and real XLSX preserve all fixture fields', async () => {
  for (const language of ['ko', 'en']) {
    const fixture = await writeFixture(directory, 12, language);
    for (const source of [fixture.md, fixture.xlsx]) {
      const plan = await planImport({ source });
      assert.equal(plan.rows.length, 12);
      assert.deepEqual(plan.rejected, []); assert.deepEqual(plan.warnings, []);
      plan.rows.forEach((row, i) => headers.forEach(key => assert.deepEqual(row.data[key], fixture.rows[i][key], `${language}/${key}`)));
    }
  }
});

test('custom column mapping preserves multiline strings and reports missing titles and unknown columns', () => {
  const result = tableToItems(['기록', '성과', '기타'], [['가상 경험', '첫 줄\n# 데이터 그대로', '참고'], ['', '누락', '']],
    { section: '경험', column_map: { 기록: 'title', 성과: 'result' } });
  assert.equal(result.items[0].fields.result, '첫 줄\n# 데이터 그대로');
  assert.equal(result.skipped.length, 1); assert.equal(result.warnings.length, 1);
  assert.throws(() => tableToItems(['제목', '결과', '성과'], [], { section: '경험' }), /같은 필드/);
  assert.throws(() => tableToItems(['title', 'title'], [], { section: '경험' }), /중복/);
});

test('Excel formulas and merged cells fail before writes; dates are ISO; sheet selection works', async () => {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('자격증');
  sheet.addRow(['제목', '취득일']); sheet.addRow(['가상 자격', new Date('2024-06-02T00:00:00Z')]);
  const path = join(directory, 'date.xlsx'); await book.xlsx.writeFile(path);
  assert.equal((await planImport({ source: path })).rows[0].data.acquired_on, '2024-06-02');
  await assert.rejects(planImport({ source: path, sheet: '없는 시트' }), /시트/);
  sheet.getCell('B2').value = { formula: '1+1', result: 2 }; await book.xlsx.writeFile(path);
  await assert.rejects(planImport({ source: path }), /수식/);
  sheet.getCell('B2').value = ''; sheet.mergeCells('A2:B2'); await book.xlsx.writeFile(path);
  await assert.rejects(planImport({ source: path }), /병합/);
});

test('Notion DB discovers data source and follows pagination with exact properties', async () => {
  process.env.NOTION_TOKEN = 'test-only';
  const expected = examples(2), calls = [];
  const responses = [{ data_sources: [{ id: 'source-1' }] },
    { results: [notionRow(expected[0])], has_more: true, next_cursor: 'cursor-2' },
    { results: [notionRow(expected[1], 1)], has_more: false }];
  const result = await loadSource('notion://database/' + 'a'.repeat(32), { section: '경험', fetchImpl: async (url, init) => {
    calls.push({ url, init }); assert.equal(init.headers['Notion-Version'], NOTION_VERSION);
    return { ok: true, json: async () => responses.shift() };
  } });
  assert.equal(result.json.items.length, 2); assert.equal(result.requests, 3);
  assert.match(calls[1].url, /data_sources\/source-1\/query/);
  assert.equal(JSON.parse(calls[2].init.body).start_cursor, 'cursor-2');
  assert.equal(result.json.items[1].fields.context, expected[1].context);
});

test('Notion ambiguity, HTTP failures and repeated cursors are explicit', async () => {
  process.env.NOTION_TOKEN = 'test-only';
  const source = 'notion://database/' + 'a'.repeat(32);
  await assert.rejects(loadSource(source, { section: '경험', fetchImpl: async () => ({ ok: true, json: async () => ({ data_sources: [{ id: 'a' }, { id: 'b' }] }) }) }), /하나 선택/);
  await assert.rejects(loadSource(source, { section: '경험', fetchImpl: async () => ({ ok: false, status: 403 }) }), /403/);
  await assert.rejects(loadSource('notion://data-source/' + 'b'.repeat(32), { section: '경험', fetchImpl: async () => ({ ok: true, json: async () => ({ results: [], has_more: true, next_cursor: 'same' }) }) }), /반복/);
});

test('Notion page reads nested blocks and reports unsupported image blocks', async () => {
  process.env.NOTION_TOKEN = 'test-only';
  const block = (type, content, extra = {}) => ({ id: content, type, [type]: { rich_text: [{ plain_text: content }] }, ...extra });
  const pages = [{ results: [block('heading_1', '경험'), block('heading_2', '가상'), block('paragraph', '상황: 예시', { has_children: true }), block('image', '')] },
    { results: [block('bulleted_list_item', '결과: 완료')] }];
  const loaded = await loadSource('notion://page/' + 'c'.repeat(32), { fetchImpl: async () => ({ ok: true, json: async () => pages.shift() }) });
  assert.match(loaded.markdown, /# 경험\n## 가상/); assert.match(loaded.markdown, /결과: 완료/);
  assert.equal(loaded.warnings.length, 1);
});

test('digest rejects changed content and bad arguments never reach storage', async () => {
  const path = join(directory, 'digest.md'); await writeFile(path, '# 경험\n## 가상\n- 결과: 전');
  const preview = await callTool('preview_import', { source: path });
  const dry = await callTool('import_records', { source: path, expected_digest: preview.source_digest });
  assert.equal(dry.dry_run, true);
  await writeFile(path, '# 경험\n## 가상\n- 결과: 후');
  await assert.rejects(callTool('import_records', { source: path, dry_run: false, expected_digest: preview.source_digest }), /변경/);
  await assert.rejects(callTool('import_records', { source: path, dry_run: 'false' }), /형식/);
  await assert.rejects(callTool('import_records', { source: path, only: ['typo'] }), /종류/);
  const json = join(directory, 'bad.json'); await writeFile(json, JSON.stringify([{title: 'missing kind'}]));
  assert.equal((await callTool('preview_import', { source: json })).diagnostic_counts.skipped, 1);
});

test('real MCP stdio initialization, discovery, preview, dry-run and tool error', async () => {
  const fixture = await writeFixture(directory, 3, 'ko');
  const client = createResearchClient();
  try {
    const init = await client.initialize(); assert.equal(init.message.result.protocolVersion, '2025-06-18');
    const list = await client.request('tools/list'); assert.equal(list.message.result.tools.length, 3);
    const response = await client.request('tools/call', { name: 'preview_import', arguments: { source: fixture.xlsx } });
    const result = JSON.parse(response.message.result.content[0].text); assert.equal(result.parsed_items, 3);
    const dry = await client.request('tools/call', { name: 'import_records', arguments: { source: fixture.xlsx } });
    assert.equal(JSON.parse(dry.message.result.content[0].text).dry_run, true);
    const error = await client.request('tools/call', { name: 'preview_import', arguments: {} });
    assert.equal(error.message.result.isError, true);
    assert.ok(response.response_bytes > 0);
  } finally { await client.close(); }
});

test('store adds, updates matching owner rows and reports partial failure (in-memory database double)', async () => {
  const records = [{ id: 'other', owner_id: 'other-owner', title: '가상 경험', result: '유지' }];
  const database = { from(table) {
    let filters = [], update, inserted;
    const query = {
      select() { return query; }, eq(key, value) { filters.push([key, value]); return query; },
      is(key, value) { filters.push([key, value]); return query; }, limit() { return query; },
      maybeSingle: async () => ({ data: records.find(row => filters.every(([k, v]) => row[k] === v)) ?? null, error: null }),
      update(value) { update = value; return query; }, insert(value) { inserted = value; return query; },
      async single() { if (inserted.title === '실패') return { error: { message: 'injected failure' } }; const row = { id: String(records.length), ...inserted }; records.push(row); return { data: row, error: null }; },
      then(resolve) { const row = records.find(row => filters.every(([k, v]) => row[k] === v)); if (row) Object.assign(row, update); resolve({ error: null }); },
    }; return query;
  } };
  const rows = buildRows([{ kind: 'experience', title: '가상 경험', fields: { result: '첫 저장' } }]).rows;
  assert.equal((await writeRows(database, 'owner', rows))[0].action, 'created');
  rows[0].data.result = '수정';
  assert.equal((await writeRows(database, 'owner', rows))[0].action, 'updated');
  assert.equal(records.length, 2); assert.equal(records[0].result, '유지'); assert.equal(records[1].result, '수정');
  const failed = buildRows([{kind: 'experience', title: '실패', fields: {}}]).rows;
  const outcomes = await writeRows(database, 'owner', [...rows, ...failed]);
  assert.deepEqual(outcomes.map(row => row.action), ['updated', 'failed']);
});
