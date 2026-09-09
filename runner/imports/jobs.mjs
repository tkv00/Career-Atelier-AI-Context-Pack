import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { createWorkspace } from '../context-pack.mjs';
import { runProvider } from '../execute.mjs';
import { assertSubscriptionProvider } from '../safety.mjs';
import { schemaArgsFor } from '../schema-compat.mjs';
import { TARGETS } from '../mcp/store.mjs';
import { readDocument } from './sources.mjs';
import { refineExperiences } from './metadata.mjs';
import { analyzeDocument, validateExtraction, validateItem, candidatePayload, EXTRACTION_SCHEMA, extractionPrompt, IMPORT_VERSION, hash } from './normalize.mjs';

const checked = async query => { const result=await query; if(result.error) throw new Error(result.error.message); return result.data; };

export async function extractChunk(supabase,ownerId,chunk,options={}) {
  const provider=['codex','claude','gemini'].includes(options.provider)?options.provider:'codex';
  const subscription=await assertSubscriptionProvider(provider);
  const runId=randomUUID();
  const {workspace,contextDir}=createWorkspace(runId,{kind:'import_extract',id:runId,payload:{chunk_id:chunk.id}});
  const schemaPath=resolve(workspace,'extract.json');
  const prompt=extractionPrompt(chunk);
  await checked(supabase.from('agent_runs').insert({id:runId,owner_id:ownerId,agent_id:'import_extract',provider,status:'running',prompt,started_at:new Date().toISOString()}));
  const started=performance.now();
  let result, stage='execution';
  try {
    result=await runProvider({supabase,provider,ownerId,runId,workspace,contextDir,prompt,model:options.model||'',...schemaArgsFor(provider,EXTRACTION_SCHEMA,schemaPath,(p,s)=>writeFileSync(p,JSON.stringify(s)))});
    if(result.status!=='completed') throw new Error(result.error||result.status);
    stage='validation';
    const items=validateExtraction(result.output,chunk);
    await checked(supabase.from('agent_runs').update({status:'completed',output:result.output,finished_at:new Date().toISOString()}).eq('id',runId));
    return {items,measurement:{run_id:runId,provider,cli_version:subscription.version,requested_model:options.model||null,...result.usage,elapsed_ms:performance.now()-started,prompt_bytes:Buffer.byteLength(prompt)}};
  } catch(error) {
    await checked(supabase.from('agent_runs').update({status:result?.status==='completed'?'failed':result?.status||'failed',error:error.message,finished_at:new Date().toISOString()}).eq('id',runId));
    error.failure_kind=stage;
    error.measurement={run_id:runId,provider,requested_model:options.model||null,...result?.usage,elapsed_ms:performance.now()-started,failed:true,failure_kind:stage};
    throw error;
  }
}

export async function processImportJob(supabase,ownerId,job,{extract=extractChunk,refine=refineExperiences}={}) {
  const batch=await checked(supabase.from('source_imports').select('*').eq('id',job.payload.importId).eq('owner_id',ownerId).single());
  if(batch.current_job_id!==job.id || batch.revision!==job.payload.revision) {
    await checked(supabase.from('jobs').update({status:'cancelled'}).eq('id',job.id)); return;
  }
  const update=values=>checked(supabase.from('source_imports').update({...values,updated_at:new Date().toISOString()}).eq('id',batch.id).eq('current_job_id',job.id).eq('revision',batch.revision));
  try {
    if(job.kind==='import_commit') {
      const failures=[];
      for(const [index,item] of batch.candidates.entries()) {
        if(item.action==='skip' || batch.receipts[String(index)]) continue;
        try {
          if(!['create','update'].includes(item.action)) throw new Error('추가 또는 갱신 동작을 선택하세요.');
          const {row,warnings}=candidatePayload(item);
          if(warnings.length) throw new Error(warnings.join('; '));
          if(item.action==='update' && (!item.target_id||!item.expected_updated_at)) throw new Error('갱신할 기존 기록과 비교 버전이 필요합니다.');
          await checked(supabase.rpc('commit_import_candidate',{p_import_id:batch.id,p_revision:batch.revision,p_index:index,p_table:row.table,p_data:row.data,p_target:item.action==='update'?item.target_id:null,p_expected_updated_at:item.action==='update'?item.expected_updated_at:null}));
        } catch(error) { failures.push({index,message:error.message}); }
      }
      await update({status:failures.length?'partial':'completed',diagnostics:failures,error:failures.length?'실패한 항목을 수정한 뒤 다시 저장하세요.':''});
      await checked(supabase.from('jobs').update({status:failures.length?'failed':'completed'}).eq('id',job.id)); return;
    }
    await update({status:'analyzing'});
    const started=performance.now(); let localPath;
    if(batch.source_type==='file') {
      if(!batch.source_ref.startsWith(`${ownerId}/${batch.id}/`) || batch.source_ref.includes('..')) throw new Error('파일 소유 경로가 잘못되었습니다.');
      const blob=await checked(supabase.storage.from('import-sources').download(batch.source_ref));
      if(blob.size>10*1024*1024) throw new Error('파일은 10 MiB 이하로 나눠 주세요.');
      // 모델 작업 폴더에는 전체 원문 파일을 넣지 않는다.
      const {workspace}=createWorkspace(randomUUID(),{kind:'import_source',id:job.id,payload:{}});
      const dir=resolve(workspace,'source'); mkdirSync(dir,{recursive:true});
      localPath=resolve(dir,/\.xlsx$/i.test(batch.name)?'source.xlsx':'source.md');
      writeFileSync(localPath,Buffer.from(await blob.arrayBuffer()));
    }
    const document=await readDocument(batch,localPath);
    const plan=analyzeDocument({...document,options:batch.options});
    for(const chunk of plan.chunks) {
      const ids=(document.sourceBlocks||[]).filter(b=>b.text && chunk.text.includes(b.text)).map(b=>b.id);
      if(ids.length) chunk.location=`Notion blocks: ${ids.join(', ')}`;
    }
    const measurements={version:IMPORT_VERSION,source_digest:plan.digest,source_bytes:Buffer.byteLength(plan.chunks.map(c=>c.text).join('\n')),rules_candidates:plan.candidates.length,ai_chunks:0,cache_hits:0,unresolved_chunks:[],runs:[],source_requests:document.requests||0,table_previews:plan.table_previews};
    const diagnostics=[...plan.diagnostics,...(document.warnings||[]).map(w=>({message:w.reason,location:w.block_id||w.row_id||''}))];
    let candidates=[...plan.candidates];
    // 대규모 문서가 사용자 모르게 수백 번 실행되지 않도록 한 번의 분석을 제한한다.
    let calls=0;
    for(const chunk of plan.pending) {
      if(chunk.auto_extract===false) { measurements.unresolved_chunks.push(chunk.id); continue; }
      const key=hash([IMPORT_VERSION,chunk.digest,batch.options.provider||'codex',batch.options.model||'',EXTRACTION_SCHEMA]);
      const cache=await checked(supabase.from('import_chunk_cache').select('result').eq('owner_id',ownerId).eq('cache_key',key).maybeSingle());
      if(cache) {
        const restored=cache.result.map(item=>({...item,evidence:Object.fromEntries(Object.entries(item.evidence).map(([k,e])=>[k,{...e,chunk_id:chunk.id,location:chunk.location}]))}));
        candidates.push(...restored); measurements.cache_hits++;
        if(!restored.length)measurements.unresolved_chunks.push(chunk.id);
        continue;
      }
      if(batch.options.ai_enabled===false || calls>=20) { measurements.unresolved_chunks.push(chunk.id); continue; }
      calls++;
      try {
        const result=await extract(supabase,ownerId,chunk,batch.options);
        candidates.push(...result.items); measurements.ai_chunks++; measurements.runs.push(result.measurement);
        if(!result.items.length) measurements.unresolved_chunks.push(chunk.id);
        await checked(supabase.from('import_chunk_cache').upsert({owner_id:ownerId,cache_key:key,result:result.items}));
      } catch(error) {
        measurements.unresolved_chunks.push(chunk.id);
        if(error.measurement) measurements.runs.push(error.measurement);
        diagnostics.push({location:chunk.location,message:error.message});
        // 인증/할당량 실패 뒤 다른 조각을 계속 요청하지 않는다. 나머지는 수동 검토로 남긴다.
        if(error.failure_kind!=='validation') calls=20;
      }
      await update({measurements,candidates,chunks:plan.chunks,digest:plan.digest,diagnostics});
    }
    // 모든 입력 경로를 합친 뒤 동일한 제목·역량 규칙을 적용한다. 실패 시 미정리 후보를 저장하지 않는다.
    measurements.metadata_runs=[];
    try { candidates=await refine(candidates,{...batch.options,refine_all:true,supabase,ownerId,budget:{remaining:20-calls},onMeasurement:entry=>measurements.metadata_runs.push(entry)}); }
    catch(error) {
      diagnostics.push({location:'경험 제목·역량',message:error.message});
      measurements.metadata_error=error.message;
    }
    for(const item of candidates) {
      const target=TARGETS[item.kind]; const row=validateItem(item).rows[0];
      let query=supabase.from(target.table).select('*').eq('owner_id',ownerId);
      for(const key of target.key) if(key!=='owner_id') query=row.data[key]==null?query.is(key,null):query.eq(key,row.data[key]);
      item.conflicts=await checked(query.limit(20));
      if(item.kind==='profile' && item.conflicts.length) item.action='skip';
    }
    measurements.elapsed_ms=performance.now()-started;
    await update({status:'review',chunks:plan.chunks,candidates,diagnostics,measurements,digest:plan.digest,error:''});
    await checked(supabase.from('jobs').update({status:'completed'}).eq('id',job.id));
  } catch(error) {
    await update({status:'failed',error:error.message});
    await checked(supabase.from('jobs').update({status:'failed'}).eq('id',job.id));
  }
}
