import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { readExcel } from '../mcp/excel.mjs';
import { compatibleExcelBuffer, normalizeExcelXml } from '../mcp/xlsx-compat.mjs';
import { analyzeDocument, candidatePayload, validateExtraction } from '../imports/normalize.mjs';
import { parseTags } from '../mcp/parse.mjs';

const directory=await mkdtemp(join(tmpdir(),'career-excel-layout-'));
test.after(()=>rm(directory,{recursive:true,force:true}));
async function analyzeBook(book,options={}) {
  const file=join(directory,`${crypto.randomUUID()}.xlsx`);
  await book.xlsx.writeFile(file);
  const loaded=await readExcel(file,{raw:true});
  return analyzeDocument({tables:loaded.tables,options});
}

test('prefixed OOXML preserves rich text, literal markup, links and relationship attributes',async()=>{
  const book=new ExcelJS.Workbook(), sheet=book.addWorksheet('경험');
  sheet.addRow(['제목','행동','하드 스킬','소프트 스킬']);
  sheet.addRow(['이름 & <x:sheet>','첫 줄\n둘째','C#, Spring Boot','협업']);
  sheet.getCell('B2').value={richText:[{text:'첫 줄\n'},{text:'둘째'}]};
  const zip=await JSZip.loadAsync(await book.xlsx.writeBuffer());
  for(const file of Object.values(zip.files).filter(f=>/^(xl\/workbook|xl\/worksheets\/sheet\d+|xl\/sharedStrings|xl\/styles)\.xml$/.test(f.name))) {
    const xml=(await file.async('string')).replace('xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"','xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"').replace(/<(\/?)([A-Za-z][\w]*)(?=[\s/>])/g,'<$1x:$2');
    zip.file(file.name,xml);
  }
  const file=join(directory,'prefixed.xlsx');
  await writeFile(file,await zip.generateAsync({type:'nodebuffer'}));
  const loaded=await readExcel(file,{raw:true});
  const plan=analyzeDocument({tables:loaded.tables});
  assert.equal(plan.candidates[0].title,'이름 & <x:sheet>');
  assert.equal(plan.candidates[0].fields.action,'첫 줄\n둘째');
  assert.deepEqual(candidatePayload(plan.candidates[0]).row.data.tags,['C#','Spring Boot','협업']);
  assert.match(normalizeExcelXml('<x:sheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:q="http://schemas.openxmlformats.org/officeDocument/2006/relationships" q:id="r1"/>'),/r:id="r1"/);
});

test('merged multirow headers below a preamble keep all SOARA fields and both skill columns',async()=>{
  const book=new ExcelJS.Workbook(),s=book.addWorksheet('나의 경험');
  s.getCell('B2').value='작성 안내';s.mergeCells('B2:I2');
  s.getRow(5).values=['번호','경 험','역 할','SOARA','', '', '', '하드 스킬','소프트 스킬'];
  s.mergeCells('A5:A6');s.mergeCells('B5:B6');s.mergeCells('C5:C6');s.mergeCells('D5:G5');s.mergeCells('H5:H6');s.mergeCells('I5:I6');
  for(const [i,label] of ['상황(S)','문제 / 목표 (O)','행동(A)','결과(R)'].entries())s.getRow(6).getCell(i+4).value=label;
  s.getRow(7).values=[1,'배포','개발자','지연','안정화','로그\n분석','개선','Java; Spring Boot','문제해결\n협업'];
  const p=await analyzeBook(book);
  assert.equal(p.table_previews[0].header_row,5);assert.equal(p.table_previews[0].header_rows,2);
  assert.equal(p.pending.length,0);assert.equal(p.candidates.length,1);
  const item=p.candidates[0];assert.match(item.fields.context,/번호: 1/);assert.match(item.fields.context,/지연/);
  assert.equal(item.fields.action,'로그\n분석');assert.equal(item.fields.problem,'안정화');
  assert.deepEqual(candidatePayload(item).row.data.tags,['Java','Spring Boot','문제해결','협업']);
  for(const evidence of Object.values(item.evidence))assert.ok(p.chunks[0].text.includes(evidence.quote));
});

test('different sheets infer independent kinds and reference sheets require mapping or exclusion',async()=>{
  const b=new ExcelJS.Workbook();
  b.addWorksheet('Sheet1').addRows([['학교명','전공','학점'],['학교 A','전산','3.8 / 4.5']]);
  b.addWorksheet('My notes').addRows([['title','action','result'],['배포','자동화','완료']]);
  b.addWorksheet('참고').addRows([['사용법'],['각자 원하는 표를 작성하세요.']]);
  const p=await analyzeBook(b);
  assert.deepEqual(p.candidates.map(i=>i.kind),['education','experience']);
  assert.ok(p.pending.length);assert.ok(p.pending.every(c=>c.auto_extract===false));
  const excluded=await analyzeBook(b,{sheet_options:{참고:{excluded:true}}});
  assert.equal(excluded.pending.length,0);assert.equal(excluded.table_previews[2].excluded,true);
});

test('manual per-sheet mapping supports duplicate or blank headers, unknown labels and headerless data',()=>{
  const tables=[{name:'A',matrix:[['안내'],['','','내용','내용'],['원문','제목 A','행동 A','결과 A']]},{name:'B',matrix:[['제목 B','Java\nC#']]}];
  const options={sheet_options:{A:{section:'experience',header_row:2,header_rows:1,column_map:{'@A':'ignore','@B':'title','@C':'action','@D':'result'}},B:{section:'experience',header_row:1,header_rows:0,column_map:{'@A':'title','@B':'tags'}}}};
  const p=analyzeDocument({tables,options});
  assert.equal(p.pending.length,0);assert.equal(p.candidates.length,2);
  assert.equal(p.candidates[0].fields.result,'결과 A');
  assert.deepEqual(candidatePayload(p.candidates[1]).row.data.tags,['Java','C#']);
  const invalid=analyzeDocument({tables,options:{header_row:999}});
  assert.equal(invalid.candidates.length,0);assert.ok(invalid.pending.length);assert.equal(invalid.table_previews.length,2);
});

test('formula caches, missing caches and cell errors are isolated to their data rows',async()=>{
  const b=new ExcelJS.Workbook(),s=b.addWorksheet('경험');s.addRow(['제목','결과']);
  s.addRow(['계산됨',{formula:'1+1',result:2}]);
  s.addRow(['미계산',{formula:'1+1'}]);s.addRow(['오류',{error:'#REF!'}]);s.addRow(['정상','완료']);
  const p=await analyzeBook(b);
  assert.deepEqual(p.candidates.map(i=>i.title),['계산됨','정상']);assert.equal(p.candidates[0].fields.result,'2');
  assert.equal(p.pending.length,2);assert.ok(p.pending.every(c=>c.auto_extract===false));
  assert.ok(p.diagnostics.some(d=>d.message.includes('최신 값')));
});

test('data merges do not invent record boundaries; duplicate titles stay separate',async()=>{
  const b=new ExcelJS.Workbook(),s=b.addWorksheet('경험');s.addRows([['제목','행동'],['동일 제목','첫 경험'],['동일 제목','둘째 경험'],['병합 제목','내용'],['','이어서']]);s.mergeCells('A4:A5');
  const p=await analyzeBook(b);
  assert.equal(p.candidates.length,2);assert.notEqual(p.candidates[0].id,p.candidates[1].id);
  assert.equal(p.pending.length,2);assert.ok(p.diagnostics.some(d=>d.message.includes('병합')));
});

test('formatted registration identifiers preserve zeros and custom end rows exclude footnotes',async()=>{
  const b=new ExcelJS.Workbook(),s=b.addWorksheet('자격증');s.addRows([['제목','등록번호'],['자격',123],['합계',1]]);s.getCell('B2').numFmt='000000';
  const p=await analyzeBook(b,{end_row:2});
  assert.equal(p.candidates.length,1);assert.equal(p.candidates[0].fields.registration_number,'000123');
});

test('tags retain technical punctuation and AI can return multiple separately grounded lists',()=>{
  assert.deepEqual(parseTags('#Java #Spring Boot; C# | CI/CD\n• C++\nJava'),['Java','Spring Boot','C#','CI/CD','C++']);
  const chunk={id:'1',digest:'abc',location:'L1',text:'경험 A\n하드: Java, C#\n소프트: 협업'};
  const result=validateExtraction({items:[{kind:'experience',title:'경험 A',title_quote:'경험 A',fields:[{key:'tags',value:'Java, C#',quote:'하드: Java, C#'},{key:'tags',value:'협업',quote:'소프트: 협업'}]}]},chunk);
  assert.deepEqual(candidatePayload(result[0]).row.data.tags,['Java','C#','협업']);
  assert.equal(result[0].evidence.tags.quote,chunk.text);
});

test('a generic numbered roster is not automatically classified as career experiences',()=>{
  const p=analyzeDocument({tables:[{name:'Sheet1',matrix:[['name','No'],['가상 이름','1']]}]});
  assert.equal(p.candidates.length,0);assert.equal(p.table_previews[0].ready,false);
});

test('titleless mapped SOARA clipboard detects both header rows and preserves fields without AI',()=>{
  const table={name:'붙여넣기',matrix:[
    ['역 할','기간','','SOARA 공식','','','','','하드 스킬','소프트 스킬'],
    ['','시작','종료','상황(S)','문제 / 목표 (O)','행동(A)','결과(R)','영향(A)','',''],
    ['개발자','2025.01','2025.02','서비스 지연\n상황 상세','속도 개선','로그 분석','응답 개선','관측의 중요성','Java; Spring Boot','협업'],
    ['개발자','2025.03','2025.04','서비스 지연\n다른 상황','장애 해결','추적','복구','회고','C#','문제해결'],
  ]};
  const map={'@A':'role_scope','@B':'ignore','@C':'ignore','@D':'context','@E':'problem','@F':'action','@G':'result','@H':'reflection','@I':'tags','@J':'tags'};
  const p=analyzeDocument({tables:[table],options:{sheet_options:{붙여넣기:{section:'experience',column_map:map}}}});
  assert.equal(p.table_previews[0].header_row,1);assert.equal(p.table_previews[0].header_rows,2);
  assert.equal(p.pending.length,0);assert.equal(p.candidates.length,2);
  assert.equal(p.candidates[0].title,'서비스 지연');assert.equal(p.candidates[0].fields.context,'서비스 지연\n상황 상세');
  assert.equal(p.candidates[0].fields.action,'로그 분석');assert.equal(p.candidates[0].fields.reflection,'관측의 중요성');
  assert.deepEqual(candidatePayload(p.candidates[0]).row.data.tags,['Java','Spring Boot','협업']);
  assert.notEqual(p.candidates[0].id,p.candidates[1].id);
  assert.equal(p.candidates[0].evidence.title.location,'붙여넣기!A3:J3');
  for(const item of p.candidates)for(const e of Object.values(item.evidence))assert.ok(p.chunks.find(c=>c.id===e.chunk_id).text.includes(e.quote));
  assert.ok(p.diagnostics.some(d=>d.message.includes('임시 제목')));
});

test('blank experience titles use mapped body only; ambiguous columns and cell errors remain unresolved',()=>{
  const p=analyzeDocument({tables:[{name:'경험',matrix:[['제목','행동'],['','원문 행동'],['기존 제목','다른 행동']]}]});
  assert.deepEqual(p.candidates.map(c=>c.title),['원문 행동','기존 제목']);
  for(const table of [
    {name:'경험',matrix:[['제목','제목','행동'],['A','B','C']]},
    {name:'경험',matrix:[['역할','태그'],['개발자','Java']]},
    {name:'경험',matrix:[['행동'],['#REF!']],issues:[{row:2,column:1,blocking:true,reason:'오류'}]},
    {name:'학력',matrix:[['전공','학점'],['전산','3.8']]},
  ]) {
    const result=analyzeDocument({tables:[table]});
    assert.equal(result.candidates.length,0);assert.ok(result.pending.every(c=>c.auto_extract===false));
  }
});

test('invalid XML, non-XLSX archives and expanded size limits stop before loading cells',async()=>{
  assert.throws(()=>normalizeExcelXml('<x:workbook>'),/prefix|namespace/i);
  assert.throws(()=>normalizeExcelXml('<!DOCTYPE a><a/>'),/외부/);
  await assert.rejects(compatibleExcelBuffer(Buffer.from('not zip')),/XLSX/);
  const b=new ExcelJS.Workbook();b.addWorksheet('경험').addRows([['제목','행동'],['A','B']]);
  await assert.rejects(compatibleExcelBuffer(await b.xlsx.writeBuffer(),{maxExpandedBytes:10}),/압축 해제/);
});
