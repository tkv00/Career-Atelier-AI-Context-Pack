import { fieldFor, kindForSection } from './parse.mjs';
import { mappedColumns, columnName } from './table-layout.mjs';

// 셀 내용을 Markdown으로 재파싱하면 줄바꿈·# 문자가 다른 행의 경계가 된다.
// 표의 행 경계를 유지한 채 기존 필드 별칭만 공유한다.
export function tableToItems(headers, records, { section, column_map = {}, origin = '', allow_titleless_experience = false } = {}) {
  const kind = kindForSection(section ?? '');
  if (!kind) throw new Error(`종류를 지정하세요: section=경험/학력/자격증 등 (${origin})`);
  const names = headers.map(h => String(h ?? '').trim());
  const used = names.filter(Boolean);
  if (new Set(used).size !== used.length && names.some((name,i)=>name&&names.indexOf(name)!==i&&column_map[`@${columnName(i+1)}`]===undefined)) throw new Error(`중복 열 이름이 있습니다. 열 위치(@A 등)로 매핑하세요 (${origin})`);
  for (const [source, target] of Object.entries(column_map)) {
    if (!names.includes(source) && !names.some((_,i)=>source===`@${columnName(i+1)}`)) throw new Error(`매핑할 열이 없습니다: ${source}`);
    if (!['title','ignore'].includes(target) && !fieldFor(kind, target)) throw new Error(`지원하지 않는 매핑 필드: ${target}`);
  }
  const mapped = mappedColumns(names,kind,column_map);
  const titleColumns = mapped.map((name, i) => name==='title' ? i : -1).filter(i => i >= 0);
  const allowExcerpt=allow_titleless_experience&&kind==='experience';
  if (titleColumns.length !== 1 && !(allowExcerpt&&titleColumns.length===0)) throw new Error(`제목 열이 하나 필요합니다. column_map으로 title을 지정하세요 (${origin})`);
  const titleIndex = titleColumns[0];
  const fields = mapped.map((name, i) => i === titleIndex || name==='ignore' ? null : name);
  // 스킬 분류 열은 하나의 태그 목록으로 모으되 서술 필드의 중복 매핑은 막는다.
  const known = fields.filter(field => field && field !== 'tags' && !(kind==='experience'&&field==='context'));
  if (new Set(known).size !== known.length) throw new Error(`여러 열이 같은 필드에 매핑됩니다 (${origin})`);
  const items = [], skipped = [], warnings = [];
  for (const [index, record] of records.entries()) {
    const line = index + 2;
    if (record.every(value => value === '' || value === null || value === undefined)) continue;
    let title = String(record[titleIndex] ?? '').trim();
    let titleFromExcerpt=false;
    // 제목 누락 때문에 확정된 열 매핑을 버리지 않는다. 사실을 생성하지 않고 본문 일부를 임시 제목으로 쓴다.
    if(!title&&allowExcerpt) {
      for(const field of ['context','action','problem','result','reflection']) {
        const value=mapped.map((f,i)=>f===field?String(record[i]??'').trim():'').find(Boolean);
        if(value) { title=value.split(/\r?\n/)[0].slice(0,80); titleFromExcerpt=true; break; }
      }
    }
    if (!title) { skipped.push({ line, origin, reason: '제목 없음' }); continue; }
    const item = { kind, title, fields: {}, line };
    if(titleFromExcerpt)item.title_from_excerpt=true;
    for (let i = 0; i < record.length; i++) {
      if (i === titleIndex || mapped[i]==='ignore' || record[i] === '' || record[i] === null || record[i] === undefined) continue;
      const value = String(record[i]);
      if (fields[i]) {
        const field = fields[i];
        const labeled=field==='context' && (fields.filter(f=>f===field).length>1 || /^(no|번호|구분|기간|시작|종료|시작일|종료일)$/i.test(names[i])) ? `${names[i]||columnName(i+1)}: ${value}` : value;
        item.fields[field] = item.fields[field] ? `${item.fields[field]}${field==='tags'?', ':'\n'}${labeled}` : labeled;
        if (fields[i] === 'secondary_major') item.fields.secondary_major_type = /복수|이중/.test(names[i]) ? '복수전공' : '부전공';
      } else {
        warnings.push({ line, origin, column: names[i] || `열 ${i + 1}`, reason: '지원하지 않는 열; 값은 저장하지 않음' });
      }
    }
    items.push(item);
  }
  return { items, skipped, warnings };
}
