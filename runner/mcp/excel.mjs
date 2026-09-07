import ExcelJS from 'exceljs';
import { stat } from 'node:fs/promises';
import { tableToItems } from './tabular.mjs';

export async function readExcel(path, options = {}) {
  const info = await stat(path);
  if (info.size > 10 * 1024 * 1024) throw new Error('엑셀 파일은 10 MiB 이하로 나눠 주세요.');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path);
  const sheets = options.sheet ? [workbook.getWorksheet(options.sheet)] : workbook.worksheets.filter(s => s.state === 'visible');
  if (!sheets.length || sheets.some(s => !s)) throw new Error('읽을 시트가 없습니다. sheet 이름을 확인하세요.');
  const items = [], skipped = [], warnings = [];
  for (const sheet of sheets) {
    if (!sheet.rowCount) continue;
    if (sheet.rowCount > 10001 || sheet.columnCount > 100) throw new Error('시트당 10,000개 데이터 행·100개 열까지 지원합니다.');
    const cellText = cell => {
      if (cell.isMerged) throw new Error(`병합 셀을 풀어 주세요: ${sheet.name}!${cell.address}`);
      const value = cell.value;
      if (value === null || value === undefined) return '';
      if (value instanceof Date) return value.toISOString().slice(0, 10);
      if (typeof value !== 'object') return String(value);
      if (value.formula || value.sharedFormula) throw new Error(`수식은 값으로 붙여넣어 주세요: ${sheet.name}!${cell.address}`);
      if (value.richText) return value.richText.map(part => part.text).join('');
      if (value.hyperlink) return value.text || value.hyperlink;
      throw new Error(`지원하지 않는 셀 값: ${sheet.name}!${cell.address}`);
    };
    const matrix = Array.from({ length: sheet.rowCount }, (_, i) =>
      Array.from({ length: sheet.columnCount }, (_, j) => cellText(sheet.getRow(i + 1).getCell(j + 1))));
    const result = tableToItems(matrix[0], matrix.slice(1), { ...options, section: options.section || sheet.name, origin: sheet.name });
    items.push(...result.items); skipped.push(...result.skipped); warnings.push(...result.warnings);
  }
  return { markdown: null, json: { items }, skipped, warnings, origin: path, kind: 'file-xlsx', source_bytes: info.size };
}
