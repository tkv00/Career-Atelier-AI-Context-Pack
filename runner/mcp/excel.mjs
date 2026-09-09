import ExcelJS from 'exceljs';
import { stat, readFile } from 'node:fs/promises';
import { tableToItems } from './tabular.mjs';
import { compatibleExcelBuffer } from './xlsx-compat.mjs';
import { cellPosition, resolveTableLayout, rowMergeIssue } from './table-layout.mjs';

export async function readExcel(path, options = {}) {
  const info = await stat(path);
  if (info.size > 10 * 1024 * 1024) throw new Error('엑셀 파일은 10 MiB 이하로 나눠 주세요.');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await compatibleExcelBuffer(await readFile(path)));
  const sheets = options.sheet ? [workbook.getWorksheet(options.sheet)] : workbook.worksheets.filter(s => s.state === 'visible');
  if (!sheets.length || sheets.some(s => !s)) throw new Error('읽을 시트가 없습니다. sheet 이름을 확인하세요.');
  const items = [], skipped = [], warnings = [], tables = [];
  for (const sheet of sheets) {
    if (!sheet.rowCount) continue;
    if (sheet.rowCount > 10001 || sheet.columnCount > 100) throw new Error('시트당 10,000개 데이터 행·100개 열까지 지원합니다.');
    const issues=[];
    const cellText = cell => {
      if (cell.isMerged && cell.master.address!==cell.address) return '';
      const value = cell.value;
      if (value === null || value === undefined) return '';
      if (value instanceof Date) return value.toISOString().slice(0, 10);
      if (typeof value !== 'object') {
        // 자격번호처럼 00000 표시 형식으로 보존한 앞자리 0을 잃지 않는다.
        if(typeof value==='number'&&Number.isInteger(value)&&value>=0&&/^0+$/.test(cell.numFmt||'')) return String(value).padStart(cell.numFmt.length,'0');
        return String(value);
      }
      if (value.formula || value.sharedFormula) {
        const cached=value.result;
        const usable=cached!==undefined&&cached!==null&&(typeof cached!=='object'||cached instanceof Date);
        const reason=usable?'수식은 실행하지 않고 파일에 저장된 계산 결과를 읽었습니다. 최신 값인지 확인하세요.':'저장된 계산 결과가 없는 수식입니다. Excel에서 재계산·저장하거나 값을 직접 입력하세요.';
        issues.push({row:cell.row,column:cell.col,location:`${sheet.name}!${cell.address}`,reason,blocking:!usable});
        return usable ? cached instanceof Date?cached.toISOString().slice(0,10):String(cached) : `[수식 결과 없음: ${value.formula||value.sharedFormula}]`;
      }
      if (value.richText) return value.richText.map(part => part.text).join('');
      if (value.hyperlink) return value.text || value.hyperlink;
      issues.push({row:cell.row,column:cell.col,location:`${sheet.name}!${cell.address}`,reason:'오류 또는 지원하지 않는 셀 값입니다. 원본을 확인하세요.',blocking:true});
      return `[셀 오류: ${value.error||'지원하지 않는 값'}]`;
    };
    const matrix = Array.from({ length: sheet.rowCount }, (_, i) =>
      Array.from({ length: sheet.columnCount }, (_, j) => cellText(sheet.getRow(i + 1).getCell(j + 1))));
    while(matrix.length&&!matrix.at(-1).some(v=>String(v).trim())) matrix.pop();
    if(!matrix.length) continue;
    const width=Math.max(...matrix.map(row=>row.reduce((last,value,i)=>String(value).trim()?i+1:last,0)));
    for(const row of matrix) row.length=width;
    const merges=(sheet.model.merges||[]).map(range=>{const [a,b]=range.split(':').map(cellPosition);return {top:a.row,left:a.col,bottom:b.row,right:b.col};});
    const table={name:sheet.name,matrix,merges,issues};
    tables.push(table);
    warnings.push(...issues);
    if (options.raw) continue;
    const layout=resolveTableLayout(table,options);
    if(!layout.ready) { skipped.push({origin:sheet.name,reason:layout.message}); continue; }
    const result = tableToItems(layout.headers, matrix.slice(layout.data_start,layout.end_row), { ...options, section:layout.kind, origin: sheet.name });
    // MCP의 직접 저장 경로에서도 오류 셀을 실제 경험 값으로 쓰지 않는다.
    result.items=result.items.filter(item=>{
      const row=layout.data_start+item.line-2;
      const reason=rowMergeIssue(table,layout,row);
      if(reason) warnings.push({origin:sheet.name,line:row+1,reason});
      return !reason&&!issues.some(issue=>issue.blocking&&issue.row===row+1);
    });
    items.push(...result.items); skipped.push(...result.skipped); warnings.push(...result.warnings);
  }
  return { markdown: null, json: { items }, skipped, warnings, tables, origin: path, kind: 'file-xlsx', source_bytes: info.size };
}
