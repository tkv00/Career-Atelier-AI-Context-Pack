const kinds=['experience','education','certification','activity','training','project','work','award','profile'];

function object(value:unknown):Record<string,unknown> {
  if(!value||typeof value!=='object'||Array.isArray(value)) throw new Error('시트 설정 형식을 확인하세요.');
  return value as Record<string,unknown>;
}

function integer(value:unknown,min:number,max:number,label:string):number|null {
  if(value===undefined||value===null||value==='') return null;
  const result=Number(value);
  if(!Number.isInteger(result)||result<min||result>max) throw new Error(`${label}을 확인하세요.`);
  return result;
}

export function tableOptions(value:unknown) {
  const input=object(value), map=object(input.column_map??{});
  if(Object.keys(map).length>100||Object.entries(map).some(([key,value])=>key.length>500||typeof value!=='string'||value.length>100)) throw new Error('열 매핑 형식을 확인하세요.');
  const section=String(input.section||'');
  if(section&&!kinds.includes(section)) throw new Error('자료 분류를 확인하세요.');
  if(input.excluded!==undefined&&typeof input.excluded!=='boolean') throw new Error('시트 제외 설정을 확인하세요.');
  return {section,header_row:integer(input.header_row,1,10001,'헤더 행 번호'),header_rows:integer(input.header_rows,0,5,'헤더 줄 수'),end_row:integer(input.end_row,1,10001,'마지막 행 번호'),column_map:map as Record<string,string>,excluded:input.excluded===true};
}

export function sheetOptions(value:unknown) {
  const entries=Object.entries(object(value));
  if(entries.length>100||entries.some(([name])=>!name||name.length>200)) throw new Error('시트 설정 개수를 확인하세요.');
  return Object.fromEntries(entries.map(([name,options])=>[name,tableOptions(options)]));
}
