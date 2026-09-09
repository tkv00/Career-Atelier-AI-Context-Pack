import type { Json } from './supabase/database.types';
import { assertExperienceMetadata } from './experience-policy.mjs';

export const IMPORT_KINDS = ['experience','education','certification','activity','training','project','work','award','profile'] as const;
export const KIND_LABELS: Record<string,string> = {experience:'경험',education:'학력',certification:'자격증',activity:'활동',training:'교육',project:'프로젝트',work:'경력',award:'수상',profile:'프로필'};
export type ImportCandidate = {
  id: string; kind: string; title: string; fields: Record<string,string>; method: string;
  evidence: Record<string,{chunk_id:string;location:string;quote:string}>;
  action: 'create'|'update'|'skip'; target_id: string|null; expected_updated_at: string|null;
  conflicts: Array<Record<string,Json>>;
  reviewed_fields?: string[];
};
export type ImportChunk = {id:string;text:string;location:string;digest:string};
export type ImportTablePreview = {
  name:string;rows:number;excluded:boolean;ready:boolean;section:string;
  header_row:number;header_rows:number;end_row:number;
  columns:Array<{key:string;label:string;target:string}>;
  sample:Array<{row:number;values:string[]}>;
};
export type ImportRow = {
  id:string;owner_id:string;name:string;source_type:string;source_ref:string;source_text:string;
  options:Json;status:string;revision:number;digest:string;chunks:Json;candidates:Json;diagnostics:Json;
  measurements:Json;receipts:Json;error:string;current_job_id:string|null;created_at:string;updated_at:string;
};

export function validateCandidates(value: unknown): ImportCandidate[] {
  if(!Array.isArray(value)||value.length>10000) throw new Error('후보 목록 형식 오류');
  for(const item of value) {
    if(!item || !IMPORT_KINDS.includes(item.kind) || typeof item.title!=='string' || !item.title.trim() || item.title.length>500) throw new Error('분류와 제목을 확인하세요.');
    if(!item.fields || typeof item.fields!=='object' || Array.isArray(item.fields) || Object.values(item.fields).some(v=>typeof v!=='string')) throw new Error('필드는 문자열 값으로 입력하세요.');
    if(!['create','update','skip'].includes(item.action)) throw new Error('저장 방식을 선택하세요.');
    if(item.kind==='experience'&&item.action!=='skip') assertExperienceMetadata(item.title,(item.fields.tags||'').split(/[,\n]/).map((tag:string)=>tag.trim()).filter(Boolean));
    if(item.action==='update' && (!item.target_id||!item.expected_updated_at)) throw new Error('갱신할 기존 항목을 선택하세요.');
  }
  return value;
}
