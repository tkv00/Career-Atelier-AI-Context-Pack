import './env.mjs';
import { readFileSync, statSync } from 'node:fs';
import { extname } from 'node:path';
import { tableToItems } from './tabular.mjs';

export const NOTION_VERSION = '2025-09-03';

export function describeSource(source) {
  const value = String(source ?? '').trim();
  const spec = value.match(/^notion:\/\/(page|database|data-source)\/(.+)$/);
  if (spec) {
    const id = spec[2].replaceAll('-', '');
    if (!/^[a-f0-9]{32}$/i.test(id)) throw new Error('Notion 페이지·DB·데이터 소스 ID는 32자리 16진수여야 합니다.');
    return { type: 'notion-' + spec[1], id };
  }
  if (/^https?:\/\//.test(value)) throw new Error('공유 URL에서 ID를 추출해 notion://page/<ID> 또는 notion://database/<ID>로 전달하세요.');
  return { type: 'file', path: value };
}

const richText = parts => (parts ?? []).map(part => part?.plain_text ?? part?.text?.content ?? '').join('');

function propertyToText(property) {
  switch (property?.type) {
    case 'title': return richText(property.title);
    case 'rich_text': return richText(property.rich_text);
    case 'number': return property.number === null ? '' : String(property.number);
    case 'select': return property.select?.name ?? '';
    case 'multi_select': return (property.multi_select ?? []).map(option => option.name).join(', ');
    case 'date': return [property.date?.start?.slice(0, 10), property.date?.end?.slice(0, 10)].filter(Boolean).join(' ~ ');
    case 'url': return property.url ?? '';
    case 'checkbox': return property.checkbox ? 'true' : 'false';
    case 'status': return property.status?.name ?? '';
    default: return null;
  }
}

export async function loadSource(source, options = {}) {
  const spec = describeSource(source);
  if (spec.type === 'file') {
    if (!spec.path) throw new Error('source가 비어 있습니다.');
    const extension = extname(spec.path).toLowerCase();
    if (extension === '.xlsx') {
      const { readExcel } = await import('./excel.mjs');
      return readExcel(spec.path, options);
    }
    if (!['.md', '.markdown', '.json'].includes(extension)) throw new Error('지원 형식: .xlsx, .md, .markdown, .json. 구형 .xls는 .xlsx로 저장하세요.');
    const info = statSync(spec.path);
    if (info.size > 10 * 1024 * 1024) throw new Error('파일은 10 MiB 이하로 나눠 주세요.');
    const content = readFileSync(spec.path, 'utf8');
    return { markdown: extension === '.json' ? null : content, json: extension === '.json' ? JSON.parse(content) : null,
      origin: spec.path, kind: extension === '.json' ? 'file-json' : 'file-markdown', source_bytes: info.size };
  }

  const token = process.env.NOTION_TOKEN || process.env.NOTION_API_KEY;
  if (!token) throw new Error('NOTION_TOKEN이 없습니다. runner/.env에 저장하고 MCP를 재연결하세요.');
  // 테스트는 fetch만 주입한다. 공개 도구에는 임의 API 주소나 인증 우회 옵션을 노출하지 않는다.
  const fetchImpl = options.fetchImpl || fetch;
  let requests = 0, blocks = 0;
  const warnings = [], skipped = [], sourceBlocks = [], tables = [];
  async function request(path, init = {}) {
    if (++requests > 200) throw new Error('Notion 요청 200회 한도를 넘었습니다. 소스를 나눠 주세요.');
    const response = await fetchImpl('https://api.notion.com/v1' + path, { ...init, signal: AbortSignal.timeout(20000),
      headers: { Authorization: 'Bearer ' + token, 'Notion-Version': NOTION_VERSION, 'Content-Type': 'application/json' } });
    if (!response.ok) throw new Error('Notion API ' + response.status + ': 권한·ID·호출 한도를 확인하세요.');
    return response.json();
  }
  function nextCursor(page, seen) {
    if (!page.has_more) return null;
    if (!page.next_cursor || seen.has(page.next_cursor)) throw new Error('Notion 페이지네이션 커서가 비어 있거나 반복됩니다.');
    seen.add(page.next_cursor);
    return page.next_cursor;
  }
  async function readBlocks(id, depth = 0) {
    if (depth > 8) throw new Error('Notion 중첩 깊이 8을 넘었습니다. 페이지를 나눠 주세요.');
    const lines = [], seen = new Set();
    let cursor;
    do {
      const query = new URLSearchParams({ page_size: '100', ...(cursor ? { start_cursor: cursor } : {}) });
      const page = await request('/blocks/' + id + '/children?' + query);
      for (const block of page.results ?? []) {
        if (++blocks > 10000) throw new Error('Notion 블록 10,000개 한도를 넘었습니다.');
        const type = block.type, data = block[type] ?? {}, text = richText(data.rich_text);
        sourceBlocks.push({ id: block.id, text });
        if (/^heading_[123]$/.test(type)) lines.push('#'.repeat(Number(type.at(-1))) + ' ' + text);
        else if (['bulleted_list_item', 'numbered_list_item', 'to_do'].includes(type)) lines.push('- ' + text);
        else if (['paragraph', 'quote', 'callout', 'code', 'toggle'].includes(type)) lines.push(text);
        else warnings.push({ block_id: block.id, type, reason: '지원하지 않는 블록; 본문은 가져오지 않음' });
        if (block.has_children) lines.push(...await readBlocks(block.id, depth + 1));
      }
      cursor = nextCursor(page, seen);
    } while (cursor);
    return lines;
  }
  if (spec.type === 'notion-page') {
    const lines = await readBlocks(spec.id);
    return { markdown: lines.join('\n'), json: null, warnings, skipped, sourceBlocks, origin: source, kind: spec.type, requests };
  }
  if (!options.section && !options.raw) throw new Error('Notion DB에는 section(예: 경험)을 지정하세요.');
  let dataSourceId = spec.id;
  if (spec.type === 'notion-database') {
    const database = await request('/databases/' + spec.id);
    const sources = database.data_sources ?? [];
    if (sources.length !== 1) throw new Error('데이터 소스를 하나 선택해 notion://data-source/<ID>로 전달하세요: ' + sources.map(s => s.name + '=' + s.id).join(', '));
    dataSourceId = sources[0].id;
  }
  const items = [], seen = new Set();
  let cursor, rowCount = 0;
  do {
    const page = await request('/data_sources/' + dataSourceId + '/query', {
      method: 'POST', body: JSON.stringify({ page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }),
    });
    for (const row of page.results ?? []) {
      if (++rowCount > 10000) throw new Error('Notion DB 10,000행 한도를 넘었습니다.');
      const headers = [], values = [], column_map = { ...options.column_map };
      for (const [name, property] of Object.entries(row.properties ?? {})) {
        const value = propertyToText(property);
        if (value === null) { warnings.push({ row_id: row.id, column: name, reason: '지원하지 않는 Notion 속성: ' + property.type }); continue; }
        headers.push(name); values.push(value);
        if (property.type === 'title') column_map[name] = 'title';
      }
      tables.push({ name: row.id, matrix: [headers, values] });
      if (options.raw) continue;
      const result = tableToItems(headers, [values], { ...options, column_map, origin: row.id });
      items.push(...result.items); skipped.push(...result.skipped); warnings.push(...result.warnings);
    }
    cursor = nextCursor(page, seen);
  } while (cursor);
  return { markdown: null, json: { items }, warnings, skipped, tables, origin: source, kind: spec.type, requests };
}

export function notionConfigured() {
  return Boolean(process.env.NOTION_TOKEN || process.env.NOTION_API_KEY);
}
