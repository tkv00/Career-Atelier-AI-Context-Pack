import { readFile } from 'node:fs/promises';
import { readExcel } from '../mcp/excel.mjs';
import { loadSource } from '../mcp/sources.mjs';
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
    const loaded=await readExcel(localPath,{...options,raw:true});
    return {text:'',tables:loaded.tables,origin:batch.name};
  }
  const text=localPath ? await readFile(localPath,'utf8') : batch.source_text;
  return batch.source_type==='table' ? {text:'',tables:[{name:'붙여넣기',matrix:parseTSV(text)}],origin:batch.name} : {text,origin:batch.name};
}
