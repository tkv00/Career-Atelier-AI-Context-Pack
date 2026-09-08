'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createImport, retryImport, commitImport, prepareImportUpload, finishImportUpload, refreshImportConflicts } from './actions';
import { createClient } from '@/lib/supabase/client';
import { IMPORT_KINDS, KIND_LABELS, type ImportCandidate, type ImportChunk, type ImportRow } from '@/lib/imports';
import type { Json } from '@/lib/supabase/database.types';
import styles from './imports.module.css';

const LABELS:Record<string,string>={context:'상황',problem:'문제',role_scope:'내 역할',judgment:'판단',action:'행동',result:'결과',trial_error:'시행착오',reflection:'회고',metrics:'정량 지표',tags:'태그',school_type:'학교 구분',major:'전공',secondary_major:'부·복수전공',gpa:'학점',period:'기간',started_on:'시작일',ended_on:'종료일',status:'상태',hanja_name:'한자 이름',memo:'메모',registration_number:'등록번호',acquired_on:'취득일',issuer:'발급·주관기관',grade:'등급',organizer:'기관',role:'역할',detail:'상세 내용',repo_url:'저장소 주소',employment_type:'고용 형태',leave_reason:'퇴사 사유',awarded_on:'수상일',display_name:'이름',target_roles:'목표 직무',interests:'관심사',summary:'소개'};
const FIELDS:Record<string,string[]>={experience:['context','problem','role_scope','judgment','action','result','trial_error','reflection','metrics','tags'],education:['school_type','major','secondary_major','gpa','period','started_on','ended_on','status','hanja_name','memo'],certification:['registration_number','acquired_on','issuer','grade','memo'],activity:['organizer','period','started_on','ended_on','role','detail'],training:['organizer','period','started_on','ended_on','detail'],project:['organizer','period','started_on','ended_on','role','detail','repo_url'],work:['employment_type','period','started_on','ended_on','leave_reason','detail'],award:['awarded_on','issuer','grade','detail'],profile:['display_name','target_roles','interests','summary']};
const STATES:Record<string,string>={queued:'분석 대기',analyzing:'분석 중',review:'검토 필요',committing:'저장 중',partial:'일부 저장 실패',completed:'저장 완료',failed:'처리 실패'};
const active=(s:string)=>['queued','analyzing','committing'].includes(s);
function asObject(value:Json):Record<string,Json|undefined>{return value && typeof value==='object'&&!Array.isArray(value)?value:{};}

function ImportOptions({options={}}:{options?:Record<string,Json|undefined>}) {
  const [section,setSection]=useState(String(options.section||''));
  const [mapping,setMapping]=useState<Array<{source:string;target:string}>>(()=>Object.entries(asObject(options.column_map||{})).map(([source,target])=>({source,target:String(target)})));
  return <details><summary>분류·시트·열 맞추기 및 AI 설정</summary>
    <div className={styles.grid}>
      <label>자료 분류<select name="section" value={section} onChange={e=>setSection(e.target.value)}><option value="">자동 분류</option>{IMPORT_KINDS.map(k=><option key={k} value={k}>{KIND_LABELS[k]}</option>)}</select></label>
      <label>엑셀 시트 이름 (비우면 전체)<input name="sheet" defaultValue={String(options.sheet||'')}/></label>
      <label>표 제목이 있는 행<input name="header_row" type="number" min="1" defaultValue={Number(options.header_row||1)}/></label>
      <label>AI 실행 도구<select name="provider" defaultValue={String(options.provider||'codex')}><option value="codex">Codex</option><option value="claude">Claude Code</option><option value="gemini">Antigravity</option></select></label>
      <label>모델 (비우면 CLI 기본값)<input name="model" defaultValue={String(options.model||'')}/></label>
    </div>
    <label className={styles.check}><input name="ai_enabled" type="checkbox" defaultChecked={options.ai_enabled!==false}/>자유로운 기록은 로컬 AI로 정리</label>
    <p className={styles.muted}>해석이 필요한 부분만 전달합니다. 분석 한 번에 최대 20개 조각을 처리하며, 나머지는 다음 분석에서 이어서 처리할 수 있습니다.</p>
    <p>내 표의 열 이름 맞추기</p>
    {mapping.map((m,i)=><div key={i} className={styles.row}><label>원래 열 이름<input value={m.source} onChange={e=>setMapping(mapping.map((x,j)=>j===i?{...x,source:e.target.value}:x))}/></label><label>저장할 항목<select value={m.target} onChange={e=>setMapping(mapping.map((x,j)=>j===i?{...x,target:e.target.value}:x))}><option value="title">제목</option>{(FIELDS[section]||Object.keys(LABELS)).map(k=><option key={k} value={k}>{LABELS[k]}</option>)}</select></label><button type="button" onClick={()=>setMapping(mapping.filter((_,j)=>j!==i))}>열 매핑 삭제</button></div>)}
    <button type="button" onClick={()=>setMapping([...mapping,{source:'',target:'title'}])}>열 매핑 추가</button>
    <input type="hidden" name="column_map" value={JSON.stringify(Object.fromEntries(mapping.filter(m=>m.source).map(m=>[m.source,m.target])))}/>
  </details>;
}

export function ImportsClient({initialImports,runnerOnline}:{initialImports:ImportRow[];runnerOnline:boolean}) {
  const router=useRouter(); const [mode,setMode]=useState('file'); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  const [selected,setSelected]=useState(initialImports[0]?.id||'');
  const polling=initialImports.some(i=>active(i.status));
  useEffect(()=>{if(!polling)return;const timer=setInterval(()=>router.refresh(),3000);return()=>clearInterval(timer);},[polling,router]);
  const selectedBatch=initialImports.find(i=>i.id===selected)||initialImports[0];
  async function submit(form:FormData) {
    setBusy(true);setError('');
    try {
      let id:string;
      if(mode==='file') {
        const file=form.get('file');
        if(!(file instanceof File)||!file.size) throw new Error('파일을 선택하세요.');
        form.delete('file');form.set('file_name',file.name);form.set('file_size',String(file.size));
        const upload=await prepareImportUpload(form);
        const {error}=await createClient().storage.from('import-sources').upload(upload.path,file,{upsert:false});
        if(error) throw new Error(error.message);
        id=await finishImportUpload(upload.id);
      } else id=await createImport(form);
      setSelected(id);router.refresh();
    } catch(e){setError(e instanceof Error?e.message:String(e));router.refresh();} finally{setBusy(false);}
  }
  return <div data-import-workspace className={styles.root}>
    <h1>자료 가져오기</h1><p className={styles.lead}>내가 기록한 방식 그대로 가져오세요. 원문과 근거를 확인한 뒤 경험·학력·경력 등 원하는 이력으로 저장합니다.</p>
    {!runnerOnline&&<p className={styles.notice}>현재 연결된 러너가 없습니다. 자료는 보관되며, 승인된 로컬 러너가 실행되면 분석을 시작합니다. 6시간이 지난 대기 작업은 다시 분석을 요청하세요.</p>}
    <section className={styles.card}><h2>새 자료</h2>
      <div className={styles.tabs}>{([['file','파일 업로드'],['text','텍스트 붙여넣기'],['table','엑셀 셀 붙여넣기'],['notion','Notion 주소']] as const).map(([value,label])=><button type="button" key={value} aria-pressed={mode===value} onClick={()=>setMode(value)}>{label}</button>)}</div>
      <form action={submit} key={mode}><input type="hidden" name="source_type" value={mode}/>
        {mode==='file'?<label>Markdown 또는 Excel 파일<input name="file" type="file" accept=".md,.markdown,.xlsx" required/><span className={styles.muted}>최대 10 MiB. 수식·병합 셀은 일반 값으로 정리해 주세요.</span></label>:<label>자료 이름<input name="name" placeholder="프로젝트 회고와 경력 기록"/></label>}
        {['text','table'].includes(mode)&&<label>{mode==='table'?'엑셀에서 셀을 복사해 붙여넣으세요':'내용을 붙여넣으세요'}<textarea name="text" rows={8} required/></label>}
        {mode==='notion'&&<><label>Notion 페이지·DB 주소<input name="notion_url" placeholder="https://www.notion.so/..." required/></label><label>대상 종류<select name="notion_kind"><option value="page">페이지 본문</option><option value="database">데이터베이스 속성</option><option value="data-source">데이터 소스</option></select></label><p className={styles.muted}>최초 한 번 로컬 러너의 Notion 연결과 페이지 읽기 권한이 필요합니다. DB 행 본문·첨부파일은 포함하지 않습니다.</p></>}
        <ImportOptions/><p><button type="submit" disabled={busy}>{busy?'자료 보관 중…':'분석하고 미리보기'}</button></p>
      </form>{error&&<p role="alert" className={styles.notice}>{error}</p>}
    </section>
    <section className={styles.card}><h2>가져오기 기록</h2>
      {!initialImports.length?<p className={styles.muted}>자료를 넣으면 이곳에서 진행 상태와 결과를 확인할 수 있습니다.</p>:<>
        <label>최근 자료<select value={selectedBatch?.id} onChange={e=>setSelected(e.target.value)}>{initialImports.map(i=><option key={i.id} value={i.id}>{i.name} · {STATES[i.status]||i.status}</option>)}</select></label>
        {selectedBatch&&<Review key={`${selectedBatch.id}:${selectedBatch.revision}:${selectedBatch.status}`} batch={selectedBatch}/>}</>}
    </section>
  </div>;
}

function Review({batch}:{batch:ImportRow}) {
  const router=useRouter();const [items,setItems]=useState<ImportCandidate[]>(batch.candidates as unknown as ImportCandidate[]);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const openedAt=useRef(0);
  useEffect(()=>{openedAt.current=Date.now();},[]);
  const chunks=batch.chunks as unknown as ImportChunk[],receipts=asObject(batch.receipts),stats=asObject(batch.measurements);
  const editable=!active(batch.status)&&batch.status!=='completed';
  const patch=(i:number,update:Partial<ImportCandidate>)=>setItems(prev=>prev.map((item,j)=>{
    if(i!==j)return item;
    const changed=[...(update.title!==undefined&&update.title!==item.title?['title']:[]),...(update.kind!==undefined&&update.kind!==item.kind?['kind']:[]),...Object.keys(update.fields||{}).filter(k=>update.fields?.[k]!==item.fields[k])];
    return {...item,...update,reviewed_fields:[...new Set([...(item.reviewed_fields||[]),...changed])]};
  }));
  async function run(action:()=>Promise<void>) {setBusy(true);setError('');try{await action();router.refresh();}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
  function exportEvidence() {
    const data={...batch,candidates:items,review_elapsed_ms:Date.now()-openedAt.current,review_timing:'browser_session_only'};
    const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download=`import-${batch.id}.json`;a.click();URL.revokeObjectURL(url);
  }
  return <div><div className={styles.row}><h3>{STATES[batch.status]||batch.status}</h3><button type="button" onClick={()=>router.refresh()}>새로고침</button><button type="button" onClick={exportEvidence}>원문·근거·측정 기록 내려받기</button></div>
    {batch.error&&<p className={styles.notice}>{batch.error}</p>}{error&&<p role="alert" className={styles.notice}>{error}</p>}
    <div className={styles.stats}><p><strong>{chunks.length}</strong>원문 조각</p><p><strong>{items.length}</strong>정리된 항목</p><p><strong>{String(stats.cache_hits||0)}</strong>재사용한 분석</p><p><strong>{Object.keys(receipts).length}</strong>저장 완료</p></div>
    {Array.isArray(stats.unresolved_chunks)&&stats.unresolved_chunks.length>0&&<p className={styles.notice}>{stats.unresolved_chunks.length}개 조각은 아직 미분류입니다. 아래 원문에서 직접 항목을 추가하거나 다시 분석하세요.</p>}
    <details><summary>진단과 실행 측정값</summary><pre>{JSON.stringify({diagnostics:batch.diagnostics,measurements:batch.measurements},null,2)}</pre><p className={styles.muted}>실제 토큰은 제공자가 보고한 실행에만 표시됩니다. 분석 재사용 횟수는 토큰 절감률이 아닙니다.</p></details>
    <details><summary>원문 전체 보기 · {chunks.length}개 조각</summary>{chunks.map(c=><article key={c.id}><p>{c.location}</p><pre className={styles.source}>{c.text}</pre>{editable&&<button type="button" onClick={()=>setItems([...items,{id:crypto.randomUUID(),kind:'experience',title:'새 항목',fields:{},method:'manual',evidence:{title:{chunk_id:c.id,location:c.location,quote:''}},action:'create',target_id:null,expected_updated_at:null,conflicts:[]}])}>이 원문에서 항목 추가</button>}</article>)}</details>
    {items.map((item,i)=>{
      const saved=Boolean(receipts[String(i)]), disabled=!editable||saved||busy;
      const cited=chunks.filter(c=>Object.values(item.evidence).some(e=>e.chunk_id===c.id));
      return <article key={item.id+':'+i} className={styles.candidate}>
        <h4>{i+1}. {item.title} {saved?'· 저장 완료':''}</h4>{Boolean(item.reviewed_fields?.length)&&<p className={styles.muted}>사용자 수정: {item.reviewed_fields?.map(k=>LABELS[k]||k).join(', ')} · 인용문은 최초 원문을 표시합니다.</p>}<div className={styles.grid}><div>
          <label>분류<select value={item.kind} disabled={disabled} onChange={e=>patch(i,{kind:e.target.value,action:'create',target_id:null,expected_updated_at:null,conflicts:[]})}>{IMPORT_KINDS.map(k=><option key={k} value={k}>{KIND_LABELS[k]}</option>)}</select></label>
          <label>제목<input value={item.title} disabled={disabled} onChange={e=>patch(i,{title:e.target.value})}/></label>
          {Object.entries(item.fields).map(([key,value])=><div key={key}><label>{LABELS[key]||key}<textarea value={value} disabled={disabled} onChange={e=>patch(i,{fields:{...item.fields,[key]:e.target.value}})}/></label>{item.evidence[key]&&<p className={styles.quote}>{item.evidence[key].quote}<br/>{item.evidence[key].location}</p>}{editable&&!saved&&<button type="button" disabled={busy} onClick={()=>{const fields={...item.fields};delete fields[key];patch(i,{fields});}}>필드 삭제</button>}</div>)}
          {!disabled&&<label>추가할 필드<select value="" onChange={e=>{if(e.target.value)patch(i,{fields:{...item.fields,[e.target.value]:''}});}}><option value="">선택하세요</option>{FIELDS[item.kind]?.filter(k=>!(k in item.fields)).map(k=><option key={k} value={k}>{LABELS[k]}</option>)}</select></label>}
          <label>저장 방식<select value={item.action} disabled={disabled} onChange={e=>patch(i,{action:e.target.value as ImportCandidate['action']})}><option value="create">새 항목 추가</option><option value="update" disabled={!item.conflicts.length}>기존 항목 갱신</option><option value="skip">이번에는 저장하지 않기</option></select></label>
          {item.conflicts.length>0&&<p className={styles.notice}>같은 제목의 기존 기록 {item.conflicts.length}건이 있습니다. 갱신하려면 아래 내용과 비교하세요.</p>}
          {item.action==='update'&&<label>갱신할 기존 항목<select value={item.target_id||''} disabled={disabled} onChange={e=>{const target=item.conflicts.find(c=>c.id===e.target.value);patch(i,{target_id:e.target.value||null,expected_updated_at:target?String(target.updated_at):null});}}><option value="">선택하세요</option>{item.conflicts.map(c=><option key={String(c.id)} value={String(c.id)}>{String(c.title||c.name||c.company||c.display_name||c.school_name)} · {String(c.updated_at)}</option>)}</select></label>}
          {item.conflicts.map(c=><details key={String(c.id)}><summary>기존 기록 내용</summary>{Object.entries(c).filter(([k,v])=>!['id','owner_id','created_at','updated_at'].includes(k)&&v!==null&&v!=='').map(([k,v])=><p key={k}><strong>{LABELS[k]||k}</strong>: {typeof v==='string'?v:JSON.stringify(v)}</p>)}</details>)}
        </div><aside><p className={styles.muted}>원문 대조 · {item.method==='rules'?'규칙으로 정리':item.method==='ai'?'AI로 추출':'직접 입력'}</p>{cited.map(c=><div key={c.id}><p className={styles.muted}>{c.location}</p><pre className={styles.source}>{c.text}</pre></div>)}</aside></div>
      </article>;
    })}
    {editable&&items.length>0&&<p className={styles.row}><button disabled={busy} type="button" onClick={()=>run(()=>commitImport(batch.id,batch.revision,items))}>{busy?'요청 중…':'검토한 내용 저장'}</button><button disabled={busy} type="button" onClick={()=>run(async()=>{
      const refreshed=await refreshImportConflicts(items);
      setItems(refreshed.map((item,i)=>receipts[String(i)]?items[i]!:item));
    })}>기존 기록 다시 비교</button></p>}
    {!Object.keys(receipts).length&&<details><summary>설정을 바꾸어 다시 분석</summary><form action={form=>run(()=>retryImport(batch.id,batch.revision,form))}><input name="notion_kind" type="hidden" value={String(asObject(batch.options).notion_kind||'page')}/><ImportOptions options={asObject(batch.options)}/><p><button disabled={busy||active(batch.status)}>다시 분석</button></p><p className={styles.muted}>아직 저장하지 않은 수정 내용은 새 분석 결과로 바뀝니다.</p></form></details>}
  </div>;
}
