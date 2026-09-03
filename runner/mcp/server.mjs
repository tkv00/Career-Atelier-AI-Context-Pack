#!/usr/bin/env node
// Career Atelier MCP 서버 — 외부 정리본(Notion·파일)을 읽어 Supabase에 바로
// 저장한다. MCP 클라이언트(Claude Code 등)가 stdio로 붙는다.
//
// 이 서버의 존재 이유는 "에이전트를 편하게 쓰기"가 아니라 **원문이 모델
// 컨텍스트를 통과하지 않게 하는 것**이다. 기성 Notion MCP로 페이지를 읽으면
// 본문 전체가 컨텍스트에 들어오고, 모델이 그걸 다시 구조화해 INSERT 인자로
// 뱉어야 해서 원문이 두 번 토큰이 된다. 여기서는 서버가 소스를 직접 읽고 DB에
// 직접 써서, 모델은 "어디서 가져와라"와 압축된 영수증만 주고받는다.
//
// SDK를 쓰지 않고 JSON-RPC를 직접 구현한다(AGENTS.md "새 의존성 금지").
// 쓰는 메서드는 initialize / tools/list / tools/call / ping 넷뿐이다.
//
// stdout은 JSON-RPC 전용이다 — 로그를 한 줄이라도 여기 쓰면 클라이언트의
// 프레이밍이 깨진다. 모든 로그는 stderr로 보낸다.

import { buildRows, connect, countRows, writeRows } from './store.mjs';
import { loadSource, notionConfigured } from './sources.mjs';
import { measure, record } from './metrics.mjs';
import { parseMarkdown } from './parse.mjs';

const SERVER_NAME = 'career-atelier';
const SERVER_VERSION = '0.1.0';
const SUPPORTED_PROTOCOLS = ['2025-06-18', '2024-11-05'];

const log = (message) => process.stderr.write(`[mcp] ${message}\n`);

// 툴 정의 ------------------------------------------------------------------
const TOOLS = [
  {
    name: 'preview_import',
    description:
      '외부 정리본(로컬 파일 또는 Notion 페이지/DB)을 읽어 어떤 행이 저장될지 미리 보여준다. ' +
      'DB에 아무것도 쓰지 않는다. 원문은 반환하지 않고 표별 건수·제목·건너뛴 항목만 돌려주므로 토큰을 거의 쓰지 않는다.',
    inputSchema: {
      type: 'object',
      required: ['source'],
      additionalProperties: false,
      properties: {
        source: {
          type: 'string',
          description: '로컬 파일 절대경로(.md/.json), 또는 notion://page/<id> · notion://database/<id>',
        },
        section: {
          type: 'string',
          description: 'Notion 데이터베이스를 읽을 때 어느 종류로 볼지(예: 경험, 학력, 자격증). 파일 소스에서는 무시된다.',
        },
      },
    },
  },
  {
    name: 'import_records',
    description:
      '외부 정리본을 읽어 Career Atelier의 각 표(경험 카드·학력·자격증·대외활동·교육활동·프로젝트·경력·수상·프로필)에 저장한다. ' +
      '기본값은 dry_run=true라 실제로 쓰려면 dry_run=false를 명시해야 한다. 같은 제목이 이미 있으면 지우지 않고 갱신한다.',
    inputSchema: {
      type: 'object',
      required: ['source'],
      additionalProperties: false,
      properties: {
        source: {
          type: 'string',
          description: '로컬 파일 절대경로(.md/.json), 또는 notion://page/<id> · notion://database/<id>',
        },
        section: { type: 'string', description: 'Notion 데이터베이스용 종류 지정. 파일 소스에서는 무시된다.' },
        dry_run: {
          type: 'boolean',
          description: 'true(기본)면 계산만 하고 저장하지 않는다. 실제 저장하려면 false를 명시한다.',
        },
        only: {
          type: 'array',
          items: { type: 'string' },
          description: '특정 종류만 가져올 때 지정(experience/education/certification/activity/training/project/work/award/profile).',
        },
      },
    },
  },
  {
    name: 'db_snapshot',
    description: '현재 각 표에 몇 행이 있는지 센다. 임포트 전후 비교에 쓴다.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
  },
];

// 파이프라인 ---------------------------------------------------------------
// 소스를 읽고 파싱해 저장할 행까지 만든다. 저장은 하지 않는다.
async function planImport({ source, section, only }) {
  const loaded = await loadSource(source, { section });

  const parsed = loaded.json
    ? { items: normalizeJsonItems(loaded.json), skipped: [] }
    : parseMarkdown(loaded.markdown);

  const filtered = Array.isArray(only) && only.length
    ? parsed.items.filter((item) => only.includes(item.kind))
    : parsed.items;

  const { rows, rejected, warnings } = buildRows(filtered);
  const sourceText = loaded.markdown ?? JSON.stringify(loaded.json);

  return { loaded, parsed, rows, rejected, warnings, sourceText };
}

// JSON 소스는 [{kind, title, fields}] 형태를 그대로 받는다.
function normalizeJsonItems(json) {
  const list = Array.isArray(json) ? json : Array.isArray(json?.items) ? json.items : [];
  return list
    .filter((item) => item && item.kind && item.title)
    .map((item) => ({ kind: String(item.kind), title: String(item.title), fields: item.fields ?? {}, line: 0 }));
}

function summarize(rows) {
  const byTable = {};
  for (const row of rows) {
    byTable[row.table] ??= { count: 0, titles: [] };
    byTable[row.table].count += 1;
    const title = row.data.title ?? row.data.name ?? row.data.company ?? row.data.school_name ?? row.data.display_name;
    // 제목만 돌려준다 — 본문을 돌려주면 이 서버를 만든 이유가 사라진다.
    if (byTable[row.table].titles.length < 20) byTable[row.table].titles.push(title);
  }
  return byTable;
}

// 에이전트 방식이었다면 모델이 뱉어야 했을 INSERT 인자를 실제로 직렬화한다.
// before 수치를 상상으로 적지 않기 위한 장치다 — 같은 입력에서 파생된 실제
// 문자열이라 재현 가능하다(docs/MCP-DECISION-LOG.md D8).
function agentEquivalentPayload(rows) {
  return JSON.stringify(
    rows.map((row) => ({ tool: `insert_${row.table}`, arguments: row.data })),
    null,
    2,
  );
}

async function handlePreview(args) {
  const { loaded, parsed, rows, rejected, warnings, sourceText } = await planImport(args);

  const result = {
    source: loaded.origin,
    source_kind: loaded.kind,
    parsed_items: parsed.items.length,
    would_write: summarize(rows),
    skipped: parsed.skipped.slice(0, 20),
    rejected,
    warnings,
    note: 'DB에 아무것도 쓰지 않았습니다. 실제 저장은 import_records(dry_run=false)로 하세요.',
  };

  return attachMetrics('preview_import', { sourceText, rows, result });
}

async function handleImport(args) {
  const dryRun = args.dry_run !== false;
  const { loaded, parsed, rows, rejected, warnings, sourceText } = await planImport(args);

  const result = {
    source: loaded.origin,
    dry_run: dryRun,
    parsed_items: parsed.items.length,
    skipped: parsed.skipped.slice(0, 20),
    rejected,
    warnings,
  };

  if (dryRun) {
    result.would_write = summarize(rows);
    result.note = 'dry_run=true라 저장하지 않았습니다. 실제로 저장하려면 dry_run=false로 다시 호출하세요.';
  } else {
    const { supabase, user } = await connect();
    const before = await countRows(supabase);
    const outcomes = await writeRows(supabase, user.id, rows);
    const after = await countRows(supabase);

    result.written = {
      created: outcomes.filter((o) => o.action === 'created').length,
      updated: outcomes.filter((o) => o.action === 'updated').length,
      failed: outcomes.filter((o) => o.action === 'failed').length,
    };
    result.failures = outcomes.filter((o) => o.action === 'failed');
    result.row_counts = { before, after };
  }

  return attachMetrics('import_records', { sourceText, rows, result });
}

async function handleSnapshot() {
  const { supabase } = await connect();
  const counts = await countRows(supabase);
  return { result: { row_counts: counts }, metrics: null };
}

// 계측 — 이 호출이 토큰을 얼마나 아꼈는지 같이 돌려준다. 포트폴리오 지표가
// 사후 추정이 아니라 호출 시점 실측이 되도록 서버가 직접 남긴다(요구사항 6번).
function attachMetrics(tool, { sourceText, rows, result }) {
  const source = measure(sourceText);
  const agentPayload = measure(agentEquivalentPayload(rows));
  const resultText = JSON.stringify(result, null, 2);
  const mcpResult = measure(resultText);

  // before: 원문을 읽고(=source) 구조화해 INSERT 인자로 다시 뱉는(=agentPayload) 양.
  // after: 모델이 실제로 받는 영수증(=mcpResult)뿐.
  const beforeTokens = source.tokens_est + agentPayload.tokens_est;
  const afterTokens = mcpResult.tokens_est;

  const metrics = {
    tool,
    rows: rows.length,
    source_chars: source.chars,
    source_tokens_est: source.tokens_est,
    agent_restate_chars: agentPayload.chars,
    agent_restate_tokens_est: agentPayload.tokens_est,
    mcp_result_chars: mcpResult.chars,
    mcp_result_tokens_est: mcpResult.tokens_est,
    before_tokens_est: beforeTokens,
    after_tokens_est: afterTokens,
    saved_tokens_est: beforeTokens - afterTokens,
    reduction_pct: beforeTokens ? Number((((beforeTokens - afterTokens) / beforeTokens) * 100).toFixed(1)) : 0,
  };

  record(metrics);
  return { result: { ...result, token_metrics: metrics }, metrics };
}

async function callTool(name, args) {
  if (name === 'preview_import') return (await handlePreview(args ?? {})).result;
  if (name === 'import_records') return (await handleImport(args ?? {})).result;
  if (name === 'db_snapshot') return (await handleSnapshot()).result;
  throw new Error(`알 수 없는 툴: ${name}`);
}

// JSON-RPC ------------------------------------------------------------------
function reply(id, result) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, result })}\n`);
}

function replyError(id, code, message) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } })}\n`);
}

async function handleMessage(message) {
  const { id, method, params } = message;
  const isNotification = id === undefined || id === null;

  try {
    if (method === 'initialize') {
      const requested = params?.protocolVersion;
      reply(id, {
        protocolVersion: SUPPORTED_PROTOCOLS.includes(requested) ? requested : SUPPORTED_PROTOCOLS[0],
        capabilities: { tools: {} },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
      });
      log(`initialize — 클라이언트 요청 프로토콜 ${requested ?? '(미지정)'}, Notion 토큰 ${notionConfigured() ? '있음' : '없음'}`);
      return;
    }

    if (method === 'notifications/initialized') return;
    if (method === 'ping') { if (!isNotification) reply(id, {}); return; }

    if (method === 'tools/list') { reply(id, { tools: TOOLS }); return; }

    // 이 서버는 tools만 제공한다. 규약대로면 클라이언트가 initialize의
    // capabilities를 보고 resources/prompts를 아예 안 물어봐야 하지만, 확인해
    // 보니 그냥 물어보는 클라이언트가 있다. "Method not found"로 돌려주면
    // 클라이언트 로그에 오류로 쌓여 사용자가 고장으로 오해하므로, 빈 목록으로
    // 조용히 답한다.
    if (method === 'resources/list') { reply(id, { resources: [] }); return; }
    if (method === 'resources/templates/list') { reply(id, { resourceTemplates: [] }); return; }
    if (method === 'prompts/list') { reply(id, { prompts: [] }); return; }

    if (method === 'tools/call') {
      const name = params?.name;
      log(`tools/call ${name}`);
      try {
        const result = await callTool(name, params?.arguments);
        reply(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] });
      } catch (error) {
        // 툴 실패는 프로토콜 오류가 아니라 결과로 돌려준다 — 모델이 읽고
        // 대응할 수 있어야 한다.
        log(`tools/call ${name} 실패: ${error.message}`);
        reply(id, { content: [{ type: 'text', text: `실패: ${error.message}` }], isError: true });
      }
      return;
    }

    if (!isNotification) replyError(id, -32601, `지원하지 않는 메서드: ${method}`);
  } catch (error) {
    log(`처리 중 오류: ${error.stack ?? error.message}`);
    if (!isNotification) replyError(id, -32603, error.message);
  }
}

function serve() {
  let buffer = '';
  // 처리 중인 요청을 세어 둔다. stdin이 닫혔다고 곧바로 죽이면 DB를 오가는
  // 비동기 툴 호출이 응답을 못 내고 잘린다 — 파이프로 메시지를 한꺼번에
  // 밀어 넣었을 때 실제로 db_snapshot 응답이 통째로 사라지는 걸 겪었다.
  const inFlight = new Set();
  let inputEnded = false;

  const exitWhenIdle = () => {
    if (inputEnded && inFlight.size === 0) process.exit(0);
  };

  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        log(`JSON 파싱 실패, 건너뜀: ${line.slice(0, 120)}`);
        continue;
      }
      const task = handleMessage(message).finally(() => {
        inFlight.delete(task);
        exitWhenIdle();
      });
      inFlight.add(task);
    }
  });
  process.stdin.on('end', () => {
    inputEnded = true;
    exitWhenIdle();
  });
  log(`${SERVER_NAME} MCP 서버 시작 (툴 ${TOOLS.length}개)`);
}

// CLI — MCP 클라이언트 없이도 손으로 돌려볼 수 있게 해 둔다. 이 프로젝트의
// 검증 기준이 "실제로 돌려 봤는가"라서, 붙이기 전에 여기서 먼저 확인한다.
async function cli() {
  const [, , command, ...rest] = process.argv;
  const argOf = (flag) => {
    const at = rest.indexOf(flag);
    return at >= 0 ? rest[at + 1] : undefined;
  };

  if (command === 'preview') {
    console.log(JSON.stringify(await callTool('preview_import', { source: argOf('--source') }), null, 2));
    return;
  }
  if (command === 'import') {
    console.log(JSON.stringify(await callTool('import_records', {
      source: argOf('--source'),
      dry_run: !rest.includes('--write'),
    }), null, 2));
    return;
  }
  if (command === 'snapshot') {
    console.log(JSON.stringify(await callTool('db_snapshot', {}), null, 2));
    return;
  }
  console.log('사용법: node mcp/server.mjs [preview|import|snapshot] --source <경로> [--write]');
  console.log('인자 없이 실행하면 MCP 서버(stdio)로 동작합니다.');
}

if (process.argv.length > 2) {
  cli().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
} else {
  serve();
}
