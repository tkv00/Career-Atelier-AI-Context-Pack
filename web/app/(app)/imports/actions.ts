'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { validateCandidates } from '@/lib/imports';
import type { ImportCandidate } from '@/lib/imports';
import type { Json } from '@/lib/supabase/database.types';
import { tableOptions, sheetOptions } from '@/lib/import-options';

const IMPORT_FILE_PATTERN = /\.(md|markdown|pdf|xlsx|xls|docx|pptx|csv|html|htm)$/i;

async function session() {
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) throw new Error('로그인이 필요합니다.');
  return {supabase,user};
}

function optionsFrom(form:FormData) {
  const provider=String(form.get('provider')||'codex');
  if(!['codex','claude','gemini'].includes(provider)) throw new Error('지원하지 않는 실행 도구입니다.');
  const mapText=String(form.get('column_map')||'{}');
  const column_map=JSON.parse(mapText);
  if(!column_map||Array.isArray(column_map)||typeof column_map!=='object'||Object.values(column_map).some(v=>typeof v!=='string')) throw new Error('열 매핑 형식을 확인하세요.');
  const layout=tableOptions({section:form.get('section')||'',header_row:form.get('header_row'),header_rows:form.get('header_rows'),end_row:form.get('end_row'),column_map});
  const perSheet=sheetOptions(JSON.parse(String(form.get('sheet_options')||'{}')));
  return {provider,model:String(form.get('model')||'').trim(),ai_enabled:form.get('ai_enabled')==='on',...layout,sheet:String(form.get('sheet')||''),sheet_options:perSheet,notion_kind:String(form.get('notion_kind')||'page')};
}

export async function createImport(form:FormData) {
  const {supabase,user}=await session();
  const id=randomUUID(), source_type=String(form.get('source_type')||'text');
  if(!['text','table','file','notion'].includes(source_type)) throw new Error('지원하지 않는 입력입니다.');
  const options=optionsFrom(form);
  const source_text=['text','table'].includes(source_type)?String(form.get('text')||''):'';
  if(Buffer.byteLength(source_text)>1024*1024) throw new Error('텍스트는 1 MiB 이하로 나눠 주세요.');
  let name=String(form.get('name')||'가져온 자료').slice(0,200),source_ref=source_type==='notion'?String(form.get('notion_url')||'').trim():'';
  if(['text','table'].includes(source_type)&&!source_text.trim()) throw new Error('내용을 붙여넣어 주세요.');
  if(source_type==='notion'&&!source_ref) throw new Error('Notion 주소를 입력하세요.');
  if(source_type==='file') {
    const file=form.get('file');
    if(!(file instanceof File)||!file.size||file.size>10*1024*1024) throw new Error('10 MiB 이하 파일을 선택하세요.');
    const extension=file.name.match(IMPORT_FILE_PATTERN)?.[1]?.toLowerCase();
    if(!extension) throw new Error('MD, PDF, Excel, Word, PowerPoint, CSV, HTML 파일만 지원합니다.');
    name=file.name.slice(0,200); source_ref=`${user.id}/${id}/source.${extension}`;
    const {error}=await supabase.storage.from('import-sources').upload(source_ref,file,{upsert:false});
    if(error) throw new Error(error.message);
  }
  const {error}=await supabase.from('source_imports').insert({id,owner_id:user.id,name,source_type,source_ref,source_text,options});
  if(error) {
    if(source_type==='file') await supabase.storage.from('import-sources').remove([source_ref]);
    throw new Error(error.message);
  }
  const queued=await supabase.rpc('queue_source_import',{p_id:id,p_revision:0,p_mode:'analyze'});
  if(queued.error) throw new Error(`자료는 보관했지만 분석 요청에 실패했습니다. 목록에서 다시 분석하세요: ${queued.error.message}`);
  revalidatePath('/imports'); return id;
}

export async function prepareImportUpload(form:FormData) {
  const {supabase,user}=await session();
  const id=randomUUID(),name=String(form.get('file_name')||'');
  const extension=name.match(IMPORT_FILE_PATTERN)?.[1]?.toLowerCase();
  const size=Number(form.get('file_size'));
  if(!extension||!Number.isFinite(size)||size<=0||size>10*1024*1024) throw new Error('10 MiB 이하 MD, PDF, Office, CSV 또는 HTML 파일을 선택하세요.');
  const path=`${user.id}/${id}/source.${extension}`;
  const {error}=await supabase.from('source_imports').insert({id,owner_id:user.id,name:name.slice(0,200),source_type:'file',source_ref:path,options:optionsFrom(form),status:'uploading'});
  if(error) throw new Error(error.message);
  return {id,path};
}

export async function finishImportUpload(id:string) {
  const {supabase,user}=await session();
  const {data:batch,error}=await supabase.from('source_imports').select('*').eq('id',id).eq('owner_id',user.id).single();
  if(error||!batch||batch.status!=='uploading') throw new Error('업로드 요청을 확인할 수 없습니다.');
  const {data:files,error:listError}=await supabase.storage.from('import-sources').list(`${user.id}/${id}`,{limit:10});
  const stored=files?.find(f=>f.name===batch.source_ref.split('/').at(-1));
  if(listError||!stored||!stored.metadata?.size||stored.metadata.size>10*1024*1024) throw new Error('파일 업로드를 완료하지 못했습니다. 새 자료로 다시 시도하세요.');
  const queued=await supabase.rpc('queue_source_import',{p_id:id,p_revision:batch.revision,p_mode:'analyze'});
  if(queued.error) throw new Error(queued.error.message);
  revalidatePath('/imports');return id;
}

export async function retryImport(id:string,revision:number,form:FormData) {
  const {supabase}=await session();
  const {error}=await supabase.rpc('queue_source_import',{p_id:id,p_revision:revision,p_mode:'analyze',p_options:optionsFrom(form)});
  if(error) throw new Error(error.message);
  revalidatePath('/imports');
}

export async function commitImport(id:string,revision:number,candidates:unknown) {
  const reviewed=validateCandidates(candidates);
  if(Buffer.byteLength(JSON.stringify(reviewed))>2*1024*1024) throw new Error('검토 결과가 너무 큽니다. 자료를 나눠 주세요.');
  const {supabase}=await session();
  const {error}=await supabase.rpc('queue_source_import',{p_id:id,p_revision:revision,p_mode:'commit',p_candidates:reviewed as unknown as Json});
  if(error) throw new Error(error.message);
  revalidatePath('/imports');
}

export async function refreshImportConflicts(candidates:unknown):Promise<ImportCandidate[]> {
  const reviewed=validateCandidates(candidates);
  const {supabase,user}=await session();
  const targets={experience:['experience_cards','title'],education:['education_records','school_name'],certification:['certifications','name'],activity:['external_activities','name'],training:['training_programs','name'],project:['project_records','name'],work:['work_experiences','company'],award:['awards','name'],profile:['profiles','display_name']} as const;
  return Promise.all(reviewed.map(async item=>{
    const [table,key]=targets[item.kind as keyof typeof targets];
    let query=supabase.from(table).select('*').eq('owner_id',user.id);
    if(item.kind!=='profile')query=query.filter(key,'eq',item.title);
    const {data,error}=await query.limit(20);
    if(error)throw new Error(error.message);
    return {...item,conflicts:(data||[]) as unknown as Array<Record<string,Json>>,action:item.action==='update'?'skip':item.action,target_id:null,expected_updated_at:null};
  }));
}
