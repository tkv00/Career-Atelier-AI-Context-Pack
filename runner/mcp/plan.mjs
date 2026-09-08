import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { buildRows } from './store.mjs';
import { loadSource } from './sources.mjs';
import { parseMarkdown } from './parse.mjs';

// 전송 방식과 무관한 정형 자료 처리 서비스. MCP와 직접 호출이 같은 결과를 사용한다.
export async function planImport({ source, section, only, sheet, column_map, expected_digest }) {
  const started = performance.now();
  const loaded = await loadSource(source, { section, sheet, column_map });

  const parsed = loaded.json
    ? normalizeJsonItems(loaded.json)
    : parseMarkdown(loaded.markdown);
  parsed.skipped.push(...(loaded.skipped ?? []));

  const filtered = Array.isArray(only) && only.length
    ? parsed.items.filter((item) => only.includes(item.kind))
    : parsed.items;

  const { rows, rejected, warnings } = buildRows(filtered);
  warnings.push(...(loaded.warnings ?? []));
  const sourceText = loaded.markdown ?? JSON.stringify(loaded.json);
  const digest = createHash('sha256').update(JSON.stringify({ sourceText, section, sheet, column_map })).digest('hex');
  if (expected_digest && digest !== expected_digest) throw new Error('미리보기 이후 소스 또는 매핑이 변경되었습니다. 다시 미리보기 하세요.');

  return { loaded, parsed, rows, rejected, warnings, sourceText, digest, processing_ms: performance.now() - started };
}

// JSON 소스는 [{kind, title, fields}] 형태를 그대로 받는다.
function normalizeJsonItems(json) {
  const list = Array.isArray(json) ? json : json?.items;
  if (!Array.isArray(list)) throw new Error('JSON은 [{kind,title,fields}] 또는 {items:[...]} 형식이어야 합니다.');
  const items = [], skipped = [];
  list.forEach((item, i) => {
    if (!item || typeof item.kind !== 'string' || typeof item.title !== 'string' || !item.title.trim() || !item.fields || typeof item.fields !== 'object' || Array.isArray(item.fields)) {
      skipped.push({ line: i + 1, reason: 'JSON 항목에 kind·title·fields가 필요합니다.' });
    } else items.push({ kind: item.kind, title: item.title, fields: item.fields, line: i + 1 });
  });
  return { items, skipped };
}
