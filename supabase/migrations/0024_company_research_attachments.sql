-- 솔(기업조사) 첨부파일 — 사용자 요청 2026-09-04.
--
-- 지금까지 솔은 기업명·직무·JD·추가 지시(전부 텍스트)만 받았다. DART
-- 공시자료 같은 원문 자료는 사용자가 직접 붙여넣을 수 없을 만큼 길어서,
-- 파일로 올리면 러너가 함께 읽게 한다. record_attachments(0020)와 같은
-- 패턴이지만 essay 한 건에 여러 파일이 달리는 구조라 별도 테이블로 둔다.

create table if not exists company_research_attachments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  essay_id uuid not null references essay_projects(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create index if not exists company_research_attachments_essay_idx
  on company_research_attachments (essay_id);

alter table company_research_attachments enable row level security;
create policy owner_all on company_research_attachments
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- 비공개 버킷 — 공시자료 자체는 공개 정보지만, 사용자가 같은 폼에 다른
-- 민감 자료(내부 문서 등)를 잘못 올릴 수도 있어 records(0020)와 같은
-- 기준으로 비공개로 둔다.
insert into storage.buckets (id, name, public)
values ('company-research', 'company-research', false)
on conflict (id) do nothing;

-- 경로의 첫 폴더를 소유자 uid로 강제한다(0020과 동일 패턴).
create policy "company-research owner read" on storage.objects
  for select using (bucket_id = 'company-research' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "company-research owner insert" on storage.objects
  for insert with check (bucket_id = 'company-research' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "company-research owner delete" on storage.objects
  for delete using (bucket_id = 'company-research' and (storage.foldername(name))[1] = auth.uid()::text);
