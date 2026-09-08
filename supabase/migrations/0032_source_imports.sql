-- 원문과 검토본을 분리해 재시도와 사용자 수정이 기존 기록을 덮어쓰지 않게 한다.
-- 0031_source_imports를 먼저 적용한 기존 인스턴스와 새 설치를 함께 지원한다.
create table if not exists source_imports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  source_type text not null check (source_type in ('file','text','table','notion')),
  source_ref text not null default '',
  source_text text not null default '',
  options jsonb not null default '{}',
  status text not null default 'queued',
  revision integer not null default 0,
  digest text not null default '',
  chunks jsonb not null default '[]',
  candidates jsonb not null default '[]',
  diagnostics jsonb not null default '[]',
  measurements jsonb not null default '{}',
  receipts jsonb not null default '{}',
  error text not null default '',
  current_job_id uuid references jobs(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists source_imports_owner_created on source_imports(owner_id, created_at desc);
alter table source_imports enable row level security;
drop policy if exists owner_all on source_imports;
create policy owner_all on source_imports for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create table if not exists import_chunk_cache (
  owner_id uuid not null references auth.users(id) on delete cascade,
  cache_key text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (owner_id, cache_key)
);
alter table import_chunk_cache enable row level security;
drop policy if exists owner_all on import_chunk_cache;
create policy owner_all on import_chunk_cache for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

insert into storage.buckets(id,name,public,file_size_limit) values ('import-sources','import-sources',false,10485760) on conflict (id) do nothing;
drop policy if exists "import source owner read" on storage.objects;
create policy "import source owner read" on storage.objects for select using (bucket_id='import-sources' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "import source owner insert" on storage.objects;
create policy "import source owner insert" on storage.objects for insert with check (bucket_id='import-sources' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "import source owner delete" on storage.objects;
create policy "import source owner delete" on storage.objects for delete using (bucket_id='import-sources' and (storage.foldername(name))[1]=auth.uid()::text);

alter table essay_projects add column if not exists pinned_experience_ids uuid[] not null default '{}';

-- 기록 저장과 영수증을 같은 트랜잭션으로 묶어 중복 생성을 막는다.
create or replace function commit_import_candidate(p_import_id uuid, p_revision integer, p_index integer, p_table text, p_data jsonb, p_target uuid default null, p_expected_updated_at text default null)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare
  batch source_imports; receipt jsonb; target_id uuid; prior_stamp text;
  cols text; vals text; assignments text;
begin
  select * into batch from source_imports where id=p_import_id and owner_id=auth.uid() for update;
  if not found or batch.revision<>p_revision or batch.status not in ('committing','partial','completed') then raise exception '검토 버전 또는 상태가 변경되었습니다'; end if;
  if p_index<0 or p_index>=jsonb_array_length(batch.candidates) then raise exception '후보 인덱스 오류'; end if;
  receipt := batch.receipts->p_index::text;
  if receipt is not null then return receipt; end if;
  if p_table not in ('profiles','experience_cards','education_records','certifications','external_activities','training_programs','project_records','work_experiences','awards') then raise exception '지원하지 않는 저장 대상'; end if;
  if jsonb_typeof(p_data)<>'object' or p_data ?| array['id','owner_id','created_at'] then raise exception '허용되지 않는 필드'; end if;
  if exists(select 1 from jsonb_object_keys(p_data) k where not exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name=p_table and c.column_name=k)) then raise exception '알 수 없는 필드'; end if;
  select string_agg(format('%I',k),','),string_agg(format('v.%I',k),','),string_agg(format('%I=v.%I',k,k),',') into cols,vals,assignments from jsonb_object_keys(p_data) k;
  if cols is null then raise exception '빈 저장 내용'; end if;
  if p_target is null then
    execute format('insert into public.%I(owner_id,%s) select $1,%s from jsonb_populate_record(null::public.%I,$2) v returning id',p_table,cols,vals,p_table) into target_id using auth.uid(),p_data;
  else
    execute format('select updated_at::text from public.%I where id=$1 and owner_id=$2 for update',p_table) into prior_stamp using p_target,auth.uid();
    if prior_stamp is null or p_expected_updated_at is null or prior_stamp::timestamptz<>p_expected_updated_at::timestamptz then raise exception '기존 기록이 변경되었습니다. 다시 비교해 주세요'; end if;
    execute format('update public.%I t set %s from jsonb_populate_record(null::public.%I,$1) v where t.id=$2 and t.owner_id=$3 returning t.id',p_table,assignments,p_table) into target_id using p_data,p_target,auth.uid();
  end if;
  receipt:=jsonb_build_object('id',target_id,'table',p_table,'action',case when p_target is null then 'created' else 'updated' end);
  update source_imports set receipts=receipts||jsonb_build_object(p_index::text,receipt),updated_at=now() where id=batch.id;
  return receipt;
end $$;
revoke all on function commit_import_candidate(uuid,integer,integer,text,jsonb,uuid,text) from public;
grant execute on function commit_import_candidate(uuid,integer,integer,text,jsonb,uuid,text) to authenticated;

-- 큐 등록과 현재 작업 참조를 한 번에 바꿔 이중 클릭과 네트워크 재전송을 막는다.
create or replace function queue_source_import(p_id uuid,p_revision integer,p_mode text,p_candidates jsonb default null,p_options jsonb default null)
returns uuid language plpgsql security invoker set search_path=public as $$
declare batch source_imports; job_id uuid:=gen_random_uuid(); receipt_key text;
begin
  select * into batch from source_imports where id=p_id and owner_id=auth.uid() for update;
  if not found or batch.revision<>p_revision then raise exception '다른 화면에서 수정되었습니다. 새로고침해 주세요'; end if;
  if batch.current_job_id is not null and exists(select 1 from jobs where id=batch.current_job_id and status in ('queued','running')) then raise exception '이미 처리 중입니다'; end if;
  if p_mode not in ('analyze','commit') then raise exception '알 수 없는 작업'; end if;
  if p_mode='analyze' and batch.receipts<>'{}'::jsonb then raise exception '저장된 자료는 새 가져오기로 분석하세요'; end if;
  if p_mode='commit' then
    if batch.status not in ('review','partial','failed') or jsonb_typeof(p_candidates)<>'array' or jsonb_array_length(p_candidates)>10000 then raise exception '검토할 후보가 필요합니다'; end if;
    for receipt_key in select jsonb_object_keys(batch.receipts) loop
      if p_candidates->receipt_key::integer is distinct from batch.candidates->receipt_key::integer then raise exception '이미 저장한 후보는 변경할 수 없습니다'; end if;
    end loop;
  end if;
  insert into jobs(id,owner_id,kind,payload,harness_snapshot) values(job_id,auth.uid(),'import_'||p_mode,jsonb_build_object('importId',p_id,'revision',batch.revision+1),'{}');
  update source_imports set current_job_id=job_id,revision=revision+1,status=case when p_mode='analyze' then 'queued' else 'committing' end,
    candidates=case when p_mode='commit' then p_candidates else '[]'::jsonb end,
    options=coalesce(p_options,options),error='',updated_at=now() where id=p_id;
  return job_id;
end $$;
revoke all on function queue_source_import(uuid,integer,text,jsonb,jsonb) from public;
grant execute on function queue_source_import(uuid,integer,text,jsonb,jsonb) to authenticated;
