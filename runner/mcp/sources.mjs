import { readFileSync } from 'node:fs';

// 소스 어댑터 — "가져오기"만 담당한다. 어느 소스에서 왔든 결과는 Markdown
// 한 덩어리이고, 그 뒤 파싱·매핑·저장은 하나의 파이프라인을 탄다.
//
// 이렇게 나눠 둔 이유: Notion 자격증명이 없는 상태에서도 파이프라인 전 구간을
// 파일 어댑터로 실제로 검증할 수 있다. Notion은 이 파일의 함수 하나로 좁혀지므로
// 토큰만 생기면 이미 검증된 경로를 그대로 탄다(docs/MCP-DECISION-LOG.md D4).

const NOTION_VERSION = '2022-06-28';

export function describeSource(source) {
  const value = String(source ?? '').trim();
  if (value.startsWith('notion://database/')) return { type: 'notion-database', id: value.slice('notion://database/'.length) };
  if (value.startsWith('notion://page/')) return { type: 'notion-page', id: value.slice('notion://page/'.length) };
  return { type: 'file', path: value };
}

function notionToken() {
  const token = process.env.NOTION_TOKEN || process.env.NOTION_API_KEY;
  if (!token) {
    throw new Error(
      'NOTION_TOKEN이 없습니다. https://www.notion.so/my-integrations 에서 내부 통합을 만들고 ' +
      '가져올 페이지를 그 통합과 공유한 뒤, runner/.env에 NOTION_TOKEN=secret_... 을 추가하세요.',
    );
  }
  return token;
}

async function notionFetch(path, init = {}) {
  const response = await fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${notionToken()}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Notion API ${response.status}: ${body.slice(0, 400)}`);
  }
  return response.json();
}

const richText = (parts) => (parts ?? []).map((part) => part?.plain_text ?? '').join('');

// 블록 → Markdown. 파서가 기대하는 모양(# 섹션 / ## 항목 / - 키: 값)으로
// 떨어지도록, Notion에서 흔히 쓰는 블록만 다룬다.
function blockToMarkdown(block) {
  const type = block.type;
  const data = block[type] ?? {};
  const content = richText(data.rich_text);
  switch (type) {
    case 'heading_1': return `# ${content}`;
    case 'heading_2': return `## ${content}`;
    case 'heading_3': return `### ${content}`;
    case 'bulleted_list_item':
    case 'numbered_list_item':
    case 'to_do': return `- ${content}`;
    case 'paragraph':
    case 'quote':
    case 'callout': return content;
    case 'code': return content;
    case 'toggle': return `- ${content}`;
    case 'child_page': return `## ${data.title ?? ''}`;
    default: return '';
  }
}

async function fetchBlocksAsMarkdown(blockId, depth = 0) {
  if (depth > 3) return [];
  const lines = [];
  let cursor;
  do {
    const query = new URLSearchParams({ page_size: '100', ...(cursor ? { start_cursor: cursor } : {}) });
    const page = await notionFetch(`/blocks/${blockId}/children?${query}`);
    for (const block of page.results ?? []) {
      const line = blockToMarkdown(block);
      if (line) lines.push(line);
      if (block.has_children) lines.push(...(await fetchBlocksAsMarkdown(block.id, depth + 1)));
    }
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return lines;
}

// 데이터베이스 행 하나 → "## 제목" + "- 속성: 값" 묶음.
function propertyToText(property) {
  switch (property?.type) {
    case 'title': return richText(property.title);
    case 'rich_text': return richText(property.rich_text);
    case 'number': return property.number === null ? '' : String(property.number);
    case 'select': return property.select?.name ?? '';
    case 'multi_select': return (property.multi_select ?? []).map((option) => option.name).join(', ');
    case 'date': return [property.date?.start, property.date?.end].filter(Boolean).join(' ~ ');
    case 'url': return property.url ?? '';
    case 'checkbox': return property.checkbox ? 'true' : 'false';
    case 'people': return (property.people ?? []).map((person) => person.name ?? '').join(', ');
    case 'formula': return String(property.formula?.string ?? property.formula?.number ?? '');
    case 'status': return property.status?.name ?? '';
    default: return '';
  }
}

async function fetchDatabaseAsMarkdown(databaseId, section) {
  const lines = section ? [`# ${section}`] : [];
  let cursor;
  do {
    const page = await notionFetch(`/databases/${databaseId}/query`, {
      method: 'POST',
      body: JSON.stringify({ page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }),
    });
    for (const row of page.results ?? []) {
      const entries = Object.entries(row.properties ?? {});
      const titleEntry = entries.find(([, value]) => value?.type === 'title');
      const title = titleEntry ? propertyToText(titleEntry[1]) : '';
      if (!title) continue;
      lines.push(`## ${title}`);
      for (const [name, value] of entries) {
        if (value?.type === 'title') continue;
        const asText = propertyToText(value);
        if (asText) lines.push(`- ${name}: ${asText}`);
      }
    }
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return lines;
}

// 소스에서 Markdown 원문을 가져온다. 이 문자열은 **모델 컨텍스트로 넘어가지
// 않는다** — 서버 안에서 파싱까지 끝내고, 모델에는 압축된 영수증만 준다.
// 이 서버의 존재 이유가 바로 이 지점이다(요구사항 3번).
export async function loadSource(source, { section } = {}) {
  const spec = describeSource(source);

  if (spec.type === 'file') {
    if (!spec.path) throw new Error('source가 비어 있습니다.');
    let markdown;
    try {
      markdown = readFileSync(spec.path, 'utf8');
    } catch (error) {
      throw new Error(`파일을 읽지 못했습니다(${spec.path}): ${error.message}`);
    }
    // JSON으로 준 경우도 받아 준다 — 이미 구조화된 정리본이 있으면 파싱을
    // 거칠 이유가 없다.
    if (spec.path.endsWith('.json')) {
      return { markdown: null, json: JSON.parse(markdown), origin: spec.path, kind: 'file-json' };
    }
    return { markdown, json: null, origin: spec.path, kind: 'file-markdown' };
  }

  if (spec.type === 'notion-page') {
    const lines = await fetchBlocksAsMarkdown(spec.id);
    return { markdown: lines.join('\n'), json: null, origin: `notion://page/${spec.id}`, kind: 'notion-page' };
  }

  const lines = await fetchDatabaseAsMarkdown(spec.id, section);
  return { markdown: lines.join('\n'), json: null, origin: `notion://database/${spec.id}`, kind: 'notion-database' };
}

export function notionConfigured() {
  return Boolean(process.env.NOTION_TOKEN || process.env.NOTION_API_KEY);
}
