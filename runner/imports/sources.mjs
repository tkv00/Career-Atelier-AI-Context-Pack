import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { readExcel } from '../mcp/excel.mjs';
import { loadSource } from '../mcp/sources.mjs';
import { convertToMarkdown, MARKITDOWN_INPUT_EXTENSIONS } from '../markitdown.mjs';
import { parseTSV } from './normalize.mjs';

export function notionURI(input, kind = 'page') {
  if (!['page','database','data-source'].includes(kind)) throw new Error('Notion 대상 종류를 선택하세요.');
  if (/^notion:\/\/(page|database|data-source)\/[a-f\d-]+$/i.test(input)) return input;
  let id=input;
  if (/^https?:/.test(input)) {
    const url=new URL(input);
    if (url.protocol!=='https:' || !(url.hostname==='notion.so'||url.hostname.endsWith('.notion.so')||url.hostname==='notion.site'||url.hostname.endsWith('.notion.site'))) throw new Error('Notion 주소만 입력할 수 있습니다.');
    id=url.pathname.split('/').filter(Boolean).at(-1)||'';
  }
  const match=id.match(/([a-f\d]{32}|[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12})$/i);
  if (!match) throw new Error('Notion 주소에서 페이지·DB ID를 찾을 수 없습니다.');
  return `notion://${kind}/${match[1]}`;
}

export async function readDocument(batch, localPath) {
  const options=batch.options || {};
  if (batch.source_type==='notion') {
    const loaded=await loadSource(notionURI(batch.source_ref,options.notion_kind), {...options,raw:true});
    return {text:loaded.markdown||'',tables:loaded.tables||[],origin:batch.source_ref,sourceBlocks:loaded.sourceBlocks||[],warnings:loaded.warnings||[],requests:loaded.requests};
  }
  if (batch.source_type==='file' && /\.xlsx$/i.test(batch.name)) {
    // 모든 외부 문서는 먼저 공통 Markdown으로 정규화한다. XLSX는 열 매핑과
    // 수식 경고를 보존해야 하므로 검증된 표 파서를 이어서 사용하되, 모델에는
    // 바이너리가 아니라 아래 표 조각만 전달한다.
    const markdown=await convertToMarkdown(localPath);
    const loaded=await readExcel(localPath,{...options,raw:true});
    return {text:'',tables:loaded.tables,origin:batch.name,converted_markdown_bytes:Buffer.byteLength(markdown)};
  }
  if (batch.source_type==='file' && MARKITDOWN_INPUT_EXTENSIONS.has(extname(batch.name).toLowerCase())) {
    const text=await convertToMarkdown(localPath);
    return {text,tables:[],origin:batch.name,converted_markdown_bytes:Buffer.byteLength(text)};
  }
  const text=localPath ? await readFile(localPath,'utf8') : batch.source_text;
  return batch.source_type==='table' ? {text:'',tables:[{name:'붙여넣기',matrix:parseTSV(text)}],origin:batch.name} : {text,origin:batch.name};
}
