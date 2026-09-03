#!/usr/bin/env node
// before/after 토큰 벤치마크 (요구사항 6번).
//
// 정직하게 만드는 것이 이 스크립트의 전부다. 세 가지를 지킨다.
//
//  1. before의 숫자를 상상하지 않는다. 에이전트가 뱉었어야 할 INSERT 인자를
//     **같은 입력에서 실제로 직렬화해** 그 길이를 잰다.
//  2. MCP 쪽 오버헤드를 숨기지 않는다. 툴 정의(스키마)는 대화 매 요청마다
//     따라다니는 고정 비용이고, 이걸 빼고 절감률을 자랑하면 과장이 된다.
//  3. 토큰은 추정치임을 이름과 출력에 남긴다. 정확한 값은 문자 수다.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMarkdown } from './parse.mjs';
import { buildRows } from './store.mjs';
import { CHARS_PER_TOKEN, measure } from './metrics.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const source = process.argv[2] ?? resolve(here, 'fixtures/sample-notes.md');

const markdown = readFileSync(source, 'utf8');
const { items, skipped } = parseMarkdown(markdown);
const { rows } = buildRows(items);

// --- before: MCP 없이 에이전트가 직접 하는 경우 --------------------------
// 원문을 컨텍스트로 읽고(1), 구조화해 INSERT 인자로 다시 뱉고(2), 행마다
// 결과를 돌려받는다(3).
const sourceCost = measure(markdown);
const restated = rows.map((row) => ({ tool: `insert_${row.table}`, arguments: row.data }));
const restateCost = measure(JSON.stringify(restated, null, 2));
// 행마다 돌아오는 "저장됨 + id" 응답. uuid 하나가 36자라 대략 이 정도다.
const perRowAck = measure('{"ok":true,"id":"00000000-0000-0000-0000-000000000000"}');
const ackCost = perRowAck.tokens_est * rows.length;

const before = sourceCost.tokens_est + restateCost.tokens_est + ackCost;

// --- after: MCP 툴 한 번 -------------------------------------------------
const callArgs = measure(JSON.stringify({ name: 'import_records', arguments: { source, dry_run: false } }));
// 실제로 이 서버가 돌려주는 영수증과 같은 모양.
const receipt = {
  source,
  dry_run: false,
  parsed_items: items.length,
  skipped,
  rejected: [],
  warnings: [],
  written: { created: rows.length, updated: 0, failed: 0 },
  failures: [],
};
const receiptCost = measure(JSON.stringify(receipt, null, 2));
const after = callArgs.tokens_est + receiptCost.tokens_est;

// --- MCP의 고정 오버헤드 -------------------------------------------------
// 툴 정의는 대화의 매 요청에 실려 간다. 1회 임포트만 하면 이 비용이 절감분을
// 갉아먹고, 여러 번 할수록 희석된다. 손익분기를 같이 낸다.
const serverSource = readFileSync(resolve(here, 'server.mjs'), 'utf8');
const toolsBlock = serverSource.slice(serverSource.indexOf('const TOOLS = ['), serverSource.indexOf('// 파이프라인'));
const schemaCost = measure(toolsBlock);

const saved = before - after;
const net = saved - schemaCost.tokens_est;

const pct = (a, b) => (b ? Number(((a / b) * 100).toFixed(1)) : 0);

console.log(`\n입력: ${source}`);
console.log(`파싱 결과: ${items.length}개 항목 → ${rows.length}행 (건너뜀 ${skipped.length})\n`);

console.log('── 정확한 실측값 (문자 수) ' + '─'.repeat(30));
console.log(`  원문                       ${String(sourceCost.chars).padStart(7)} 자  ${String(sourceCost.bytes).padStart(7)} B`);
console.log(`  에이전트가 재작성할 INSERT 인자 ${String(restateCost.chars).padStart(7)} 자`);
console.log(`  MCP가 돌려주는 영수증        ${String(receiptCost.chars).padStart(7)} 자`);
console.log(`  MCP 툴 정의(고정 오버헤드)    ${String(schemaCost.chars).padStart(7)} 자`);

console.log('\n── 토큰 추정치 ' + '─'.repeat(42));
console.log(`  BEFORE (에이전트 직접)`);
console.log(`    원문 읽기                ${String(sourceCost.tokens_est).padStart(7)}`);
console.log(`    구조화해 다시 뱉기        ${String(restateCost.tokens_est).padStart(7)}`);
console.log(`    행별 응답 ${rows.length}건            ${String(ackCost).padStart(7)}`);
console.log(`    합계                     ${String(before).padStart(7)}`);
console.log(`  AFTER (MCP 툴 1회)`);
console.log(`    툴 호출 인자              ${String(callArgs.tokens_est).padStart(7)}`);
console.log(`    영수증                   ${String(receiptCost.tokens_est).padStart(7)}`);
console.log(`    합계                     ${String(after).padStart(7)}`);

console.log('\n── 결과 ' + '─'.repeat(49));
console.log(`  절감              ${saved} 토큰 (${pct(saved, before)}%)`);
console.log(`  툴 정의 오버헤드    -${schemaCost.tokens_est} 토큰 (요청마다 고정)`);
console.log(`  1회 임포트 순절감   ${net} 토큰 (${pct(net, before)}%)`);
console.log(`  손익분기          ${schemaCost.tokens_est >= saved ? Math.ceil(schemaCost.tokens_est / Math.max(saved, 1)) + '회 임포트부터 이득' : '1회 임포트부터 이득'}`);

console.log('\n── 환산 계수 (재현용) ' + '─'.repeat(36));
console.log(`  토큰 1개당 문자 수: ${Object.entries(CHARS_PER_TOKEN).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
console.log('  문자 수는 실측값이고 토큰은 위 계수로 환산한 추정치다.');
console.log('  양쪽 모두 시스템 프롬프트·대화 이력은 제외했다(양쪽에 동일하게 붙는 상수).\n');
