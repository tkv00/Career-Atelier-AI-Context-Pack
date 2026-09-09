import { fieldFor, kindForSection, FIELD_ALIASES } from './parse.mjs';

const compact = value => String(value ?? '').replace(/\s/g, '').toLowerCase();
const TITLES = new Set(['title','name','제목','이름','경험','경험명','경험이름','항목명','학교명','회사명','자격증명','프로젝트명','활동명','교육명','수상명']);
export const isTitleHeader = value => TITLES.has(compact(value));
export function columnName(n) { let name=''; for(;n>0;n=Math.floor((n-1)/26)) name=String.fromCharCode(65+(n-1)%26)+name; return name; }
export function cellPosition(address) {
  const match=address.match(/^([A-Z]+)(\d+)$/i);
  if(!match) throw new Error(`셀 주소를 확인하세요: ${address}`);
  return { row:Number(match[2])-1, col:[...match[1].toUpperCase()].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0)-1 };
}

export function rowMergeIssue(table,layout,row) {
  const ambiguous=(table.merges||[]).find(m=>{
    const fields=new Set(layout.columns.slice(m.left,m.right+1).filter(f=>f&&f!=='ignore'));
    return m.top>=layout.data_start&&m.top<=row&&row<=m.bottom&&fields.size>0&&(m.bottom>m.top||fields.size>1);
  });
  return ambiguous?`${columnName(ambiguous.left+1)}${ambiguous.top+1}:${columnName(ambiguous.right+1)}${ambiguous.bottom+1} 병합이 여러 데이터 행 또는 필드에 걸쳐 있습니다. 원본을 확인하고 직접 항목을 추가하세요.`:'';
}

export function mappedColumns(headers, kind, columnMap={}) {
  return headers.map((header,index)=>{
    const key=`@${columnName(index+1)}`;
    const target=columnMap[key] ?? columnMap[header];
    if(target!==undefined) return target==='ignore' ? 'ignore' : target==='title' ? 'title' : fieldFor(kind,target);
    return isTitleHeader(header) ? 'title' : fieldFor(kind,header);
  });
}

function headersAt(table, start, depth) {
  const width=Math.max(0,...table.matrix.map(row=>row.length));
  return Array.from({length:width},(_,col)=>{
    const values=[];
    for(let row=start;row<start+depth;row++) {
      let value=table.matrix[row]?.[col];
      if(!value) {
        const merge=(table.merges||[]).find(m=>m.top>=start && m.top<start+depth && m.top<=row && row<=m.bottom && m.left<=col && col<=m.right);
        if(merge) value=table.matrix[merge.top]?.[merge.left];
      }
      if(String(value??'').trim()) values.push(String(value).trim());
    }
    return values.at(-1)||'';
  });
}

// 파일명이나 고정 행 번호 대신 인식 가능한 필드 조합으로 후보를 비교한다. 동률 분류는 사용자가 정한다.
export function resolveTableLayout(table, options={}) {
  const {matrix}=table;
  const requested=options.section||'';
  const namedKind=kindForSection(requested || table.name);
  if(requested&&!namedKind) throw new Error('자료 분류를 확인하세요.');
  const manual=options.header_row!==undefined && options.header_row!==null && options.header_row!=='' && Number(options.header_row)!==0;
  const start=manual ? Number(options.header_row)-1 : 0;
  if(!Number.isInteger(start)||start<0||start>=matrix.length) throw new Error('헤더 행을 확인하세요.');
  const explicitDepth=options.header_rows!==undefined&&options.header_rows!==null&&options.header_rows!=='';
  const depth=explicitDepth?Number(options.header_rows):null;
  if(explicitDepth&&(!Number.isInteger(depth)||depth<0||depth>5)) throw new Error('헤더 줄 수는 0~5로 입력하세요.');
  const possibilities=[];
  for(let r=start;r<(manual?start+1:Math.min(matrix.length,100));r++) {
    for(const d of explicitDepth?[depth]:[1,2,3]) {
      if(r+d>matrix.length) continue;
      const headers=headersAt(table,r,d);
      const kinds=namedKind?[namedKind]:Object.keys(FIELD_ALIASES);
      const scored=kinds.map(kind=>{
        const columns=mappedColumns(headers,kind,options.column_map);
        // 번호·기간만 있는 일반 명단을 경험으로 단정하지 않는다.
        const unique=new Set(columns.filter((f,i)=>f&&f!=='ignore'&&f!=='title'&&!(kind==='experience'&&!namedKind&&/^(no|번호|구분|기간|시작|종료|시작일|종료일)$/.test(compact(headers[i])))));
        // 위치 매핑은 모든 행에서 같으므로 실제 헤더 이름도 비교해야 안내·두 줄 헤더를 구분한다.
        const headerScore=new Set(mappedColumns(headers,kind).filter(f=>f&&f!=='ignore')).size;
        return {kind,columns,score:unique.size*10+(columns.filter(f=>f==='title').length===1?5:0),headerScore};
      }).sort((a,b)=>b.score-a.score);
      const best=scored[0];
      const ambiguous=!namedKind&&scored[1]?.score===best.score;
      const titles=best.columns.filter(f=>f==='title').length;
      const titleless=options.allow_titleless_experience===true&&best.kind==='experience'&&titles===0&&best.columns.some(f=>['context','problem','action','result','reflection'].includes(f));
      const valid=(titles===1||titleless)&&!ambiguous;
      possibilities.push({header_row:r+1,header_rows:d,headers,...best,valid,score:best.score+best.headerScore/2-d/10});
    }
  }
  possibilities.sort((a,b)=>Number(b.valid)-Number(a.valid)||b.score-a.score||a.header_row-b.header_row);
  const selected=possibilities[0];
  const ready=selected?.valid&&(manual||namedKind||selected.score>=14);
  const end=options.end_row?Number(options.end_row):matrix.length;
  if(!Number.isInteger(end)||end<1||end>matrix.length) throw new Error('마지막 행 번호를 확인하세요.');
  if(ready&&end<selected.header_row+selected.header_rows) throw new Error('헤더 다음에 데이터 행이 필요합니다.');
  return {
    ...selected, ready:Boolean(ready), end_row:end,
    kind:ready?selected.kind:namedKind||'',
    data_start:ready?selected.header_row-1+selected.header_rows:0,
    message:ready?'':'헤더와 분류를 확정하지 못했습니다. 시트 미리보기에서 헤더 행·분류·제목 열을 지정하세요.',
  };
}
