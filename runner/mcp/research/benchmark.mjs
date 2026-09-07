import { mkdir, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir, cpus, platform, arch } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { callTool, planImport } from '../server.mjs';
import { measure } from '../metrics.mjs';
import { writeFixture, headers } from './fixtures.mjs';
import { createResearchClient } from './client.mjs';

process.env.CAREER_MCP_METRICS_DISABLED = '1';
const output = resolve(process.argv[2] || fileURLToPath(new URL('../../../docs/research/mcp-import/data', import.meta.url)));
const directory = await mkdtemp(join(tmpdir(), 'career-mcp-bench-'));
const repeats = 20, warmups = 3;
const raw = [], cases = [], payloads = [];
const quantile = (values, p) => { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)]; };
const summarize = values => ({ median_ms: quantile(values, .5), p95_ms: quantile(values, .95), min_ms: Math.min(...values), max_ms: Math.max(...values) });
await mkdir(output, { recursive: true });
try {
  for (const language of ['ko', 'en']) for (const count of [10, 100, 1000]) {
    const fixture = await writeFixture(directory, count, language);
    for (const format of ['md', 'xlsx']) {
      const source = fixture[format], key = `${language}-${format}-${count}`;
      const args = { source, dry_run: true };
      const plan = await planImport(args);
      let correct = 0;
      for (let i = 0; i < count; i++) for (const field of headers)
        if (JSON.stringify(plan.rows[i]?.data[field]) === JSON.stringify(fixture.rows[i][field])) correct++;
      if (plan.rows.length !== count || correct !== count * headers.length) throw new Error(`필드 검증 실패: ${key}`);

      const client = createResearchClient();
      try {
        const init = await client.initialize();
        const listing = await client.request('tools/list');
        const schema = measure(JSON.stringify(listing.message.result.tools));
        const cold = await client.request('tools/call', { name: 'import_records', arguments: args });
        if (cold.message.result.isError) throw new Error(cold.message.result.content[0].text);
        const response = JSON.parse(cold.message.result.content[0].text);
        if (!response.dry_run || response.parsed_items !== count) throw new Error('실험은 dry-run이어야 합니다.');
        // A는 실제 LLM 실행이 아니라 같은 행을 모델이 중계한다고 가정한 문자열이다.
        // B와 C의 시간만 실행해서 측정한다. DB·인터넷·모델 추론은 포함하지 않는다.
        const relay = JSON.stringify({ source_text: fixture.markdown, insert_arguments: plan.rows.map(row => ({ table: row.table, data: row.data })) });
        const wire = cold.request_text + cold.response_text;
        const preview = await client.request('tools/call', { name: 'preview_import', arguments: { source } });
        const previewWire = preview.request_text + preview.response_text;
        for (let i = 0; i < warmups; i++) {
          await callTool('import_records', args);
          await client.request('tools/call', { name: 'import_records', arguments: args });
        }
        const direct = [], mcp = [];
        for (let repetition = 0; repetition < repeats; repetition++) {
          // 순서 편향을 줄이기 위해 AB/BA 순서를 번갈아 사용한다.
          for (const condition of repetition % 2 ? ['mcp', 'direct'] : ['direct', 'mcp']) {
            const started = performance.now();
            const observed = condition === 'direct' ? await callTool('import_records', args)
              : await client.request('tools/call', { name: 'import_records', arguments: args });
            const elapsed = performance.now() - started;
            if (condition === 'mcp' && observed.message.result.isError) throw new Error('MCP tool failed');
            (condition === 'direct' ? direct : mcp).push(elapsed);
            raw.push({ case: key, repetition, condition, elapsed_ms: elapsed,
              request_bytes: condition === 'mcp' ? observed.request_bytes : 0,
              response_bytes: condition === 'mcp' ? observed.response_bytes : 0 });
          }
        }
        const before = measure(relay), after = measure(wire), previewMeasure = measure(previewWire);
        const entry = { case: key, language, format, records: count,
          correct_fields: correct, total_fields: count * headers.length, field_accuracy: correct / (count * headers.length),
          input_sha256: createHash('sha256').update(fixture.markdown).digest('hex'),
          source_file_bytes: plan.loaded.source_bytes,
          modeled_relay: before, mcp_call: after, mcp_schema: schema,
          preview_plus_import_tokens_est: previewMeasure.tokens_est + after.tokens_est + schema.tokens_est,
          cold_session_wire_bytes: init.request_bytes + init.response_bytes + listing.request_bytes + listing.response_bytes,
          startup_ms: init.startup_ms, first_call_ms: cold.elapsed_ms,
          direct: summarize(direct), mcp: summarize(mcp),
          modeled_reduction_pct: 100 * (1 - (after.tokens_est + schema.tokens_est) / before.tokens_est),
          workflow_reduction_pct: 100 * (1 - (previewMeasure.tokens_est + after.tokens_est + schema.tokens_est) / before.tokens_est),
        };
        cases.push(entry);
        payloads.push({ case: key, modeled_relay_text: relay, mcp_request_text: cold.request_text,
          mcp_response_text: cold.response_text, preview_request_text: preview.request_text,
          preview_response_text: preview.response_text, tools: listing.message.result.tools });
        console.log(`${key}: fields=${correct}/${count * headers.length}, direct=${entry.direct.median_ms.toFixed(2)}ms, MCP=${entry.mcp.median_ms.toFixed(2)}ms`);
      } finally { await client.close(); }
    }
  }
  const result = { schema_version: 1, generated_at: new Date().toISOString(),
    environment: { node: process.version, platform: platform(), arch: arch(), cpu: cpus()[0]?.model, exceljs: '4.4.0' },
    design: { dataset: 'synthetic; 2 languages × 3 record counts × 2 formats', repeats, warmups,
      order: 'alternating direct/MCP; no parallel requests', operation: 'import_records dry_run=true',
      metrics_logging: false, baseline: 'A: modeled source+row relay; B: actual direct same tool; C: actual MCP stdio same tool',
      limitations: ['No live LLM comparison', 'No provider billing tokens', 'No live Notion or Supabase network timing',
        'Synthetic template-conforming data only', 'Single machine; process startup reported separately',
        'Wire tokens are heuristic, not the host model context; schema added once in reported comparison'] }, cases };
  await writeFile(join(output, 'results.json'), JSON.stringify(result, null, 2) + '\n');
  await writeFile(join(output, 'trials.csv'), 'case,repetition,condition,elapsed_ms,request_bytes,response_bytes\n' + raw.map(row => Object.values(row).join(',')).join('\n') + '\n');
  await writeFile(join(output, 'payloads.jsonl'), payloads.map(row => JSON.stringify(row)).join('\n') + '\n');
  console.log(`Saved ${cases.length} cases / ${raw.length} timed trials to ${output}`);
} finally { await rm(directory, { recursive: true, force: true }); }
