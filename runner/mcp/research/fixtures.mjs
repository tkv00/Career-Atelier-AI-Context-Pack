import ExcelJS from 'exceljs';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

export function examples(count, language = 'ko') {
  return Array.from({ length: count }, (_, i) => ({
    title: `${language === 'ko' ? '가상 경험' : 'Synthetic experience'} ${String(i + 1).padStart(4, '0')}`,
    context: language === 'ko' ? '가상 서비스에서 사용자 요청이 늘어나 응답 지연이 발생했다.' : 'A synthetic service saw increased requests and slower responses.',
    problem: language === 'ko' ? '반복 쿼리가 지연의 원인이었고 측정 기준도 없었다.' : 'Repeated queries caused latency and there was no measurement baseline.',
    role_scope: language === 'ko' ? '분석 및 구현 담당' : 'Analysis and implementation',
    judgment: language === 'ko' ? '동일한 부하에서 전후를 비교하기로 했다.' : 'Compare before and after under the same load.',
    action: language === 'ko' ? '쿼리 계측을 추가하고 중복 호출을 줄였다.' : 'Instrumented queries and reduced duplicate calls.',
    result: language === 'ko' ? '가상 실험에서 지연이 감소했다.' : 'Latency decreased in the synthetic experiment.',
    trial_error: language === 'ko' ? '캐시 갱신 누락을 발견해 무효화 조건을 수정했다.' : 'Fixed a missing cache invalidation condition.',
    reflection: language === 'ko' ? '체감보다 재현 가능한 측정이 중요했다.' : 'Reproducible measurement mattered more than impressions.',
    metrics: [`sample=${i + 1}`, 'latency=120ms'],
    tags: ['문제해결', '정보분석'],
  }));
}

export const headers = ['title', 'context', 'problem', 'role_scope', 'judgment', 'action', 'result', 'trial_error', 'reflection', 'metrics', 'tags'];
export const fieldText = value => Array.isArray(value) ? value.join(', ') : value;

export async function writeFixture(directory, count, language) {
  await mkdir(directory, { recursive: true });
  const rows = examples(count, language);
  const basename = `${language}-${count}`;
  const markdown = '# Experience\n\n' + rows.map(row => '## ' + row.title + '\n' + headers.slice(1).map(h => '- ' + h + ': ' + fieldText(row[h])).join('\n')).join('\n\n') + '\n';
  const workbook = new ExcelJS.Workbook();
  // 표본에 실사용자 정보가 섞이지 않도록 생성값만 사용한다.
  workbook.creator = 'Career Atelier synthetic benchmark';
  const sheet = workbook.addWorksheet('Experience');
  sheet.addRow(headers);
  for (const row of rows) sheet.addRow(headers.map(h => fieldText(row[h])));
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.columns.forEach(column => { column.width = 25; });
  const md = join(directory, basename + '.md'), xlsx = join(directory, basename + '.xlsx');
  await writeFile(md, markdown);
  await workbook.xlsx.writeFile(xlsx);
  return { rows, markdown, md, xlsx };
}

export function notionRow(row, index = 0) {
  const properties = {};
  for (const key of headers) properties[key] = key === 'title'
    ? { type: 'title', title: [{ plain_text: row.title }] }
    : { type: 'rich_text', rich_text: [{ plain_text: fieldText(row[key]) }] };
  return { id: `fixture-${index}`, properties };
}
