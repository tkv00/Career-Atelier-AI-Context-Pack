-- 나의 정보(이력 기록) — 사용자 요청 2026-09-02.
--
-- 지원서를 쓸 때마다 학번·학점·자격증 번호·수상 날짜를 매번 다시 찾는다.
-- 한 번 적어 두고 꺼내 쓰도록 항목별 테이블로 만든다. 경험 카드
-- (experience_cards)와는 역할이 다르다 — 그쪽은 "서술형 경험"이고,
-- 여기는 "사실 기록"이다. 뮤즈가 근거로 쓰는 건 여전히 경험 카드다.
--
-- 항목마다 필드가 제각각이라 한 테이블에 몰아넣으면 빈 칸투성이가 된다.
-- 7종을 각각의 테이블로 나눈다.

-- 1. 학력 --------------------------------------------------------------------
-- 고등학교와 대학교를 한 테이블에 두고 school_type으로 가른다. 대학 전용
-- 칸(전공·학점 등)은 고등학교 행에서 그냥 비어 있게 둔다.
create table if not exists education_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  school_type text not null default '대학교',   -- 고등학교 | 대학교
  school_name text not null,
  started_on date,
  ended_on date,
  status text,                                  -- 재학 | 졸업 | 휴학 | 중퇴 | 수료
  -- 대학 전용
  major text,
  secondary_major text,                         -- 부전공·복수전공
  secondary_major_type text,                    -- 부전공 | 복수전공
  gpa numeric(4, 2),
  gpa_scale numeric(4, 2),                      -- 4.5 / 4.3 / 100 등
  hanja_name text,                              -- 증명서에 한자 이름이 필요한 경우가 있다
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 들은 전공과목. 학력 한 건에 여러 과목이 달린다.
create table if not exists education_courses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  education_id uuid not null references education_records(id) on delete cascade,
  course_name text not null,
  credits numeric(4, 1),
  grade text,                                   -- A+ / B0 ...
  term text,                                    -- 2024-1학기
  detail text,
  created_at timestamptz not null default now()
);

-- 2. 자격증 ------------------------------------------------------------------
create table if not exists certifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  registration_number text,
  acquired_on date,
  issuer text,
  grade text,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. 대외활동 ----------------------------------------------------------------
create table if not exists external_activities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  organizer text,
  started_on date,
  ended_on date,
  role text,
  detail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. 교육활동 ----------------------------------------------------------------
create table if not exists training_programs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  organizer text,
  started_on date,
  ended_on date,
  detail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. 프로젝트 ----------------------------------------------------------------
create table if not exists project_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  organizer text,
  started_on date,
  ended_on date,
  role text,
  detail text,
  repo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6. 경력사항 ----------------------------------------------------------------
create table if not exists work_experiences (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  company text not null,
  employment_type text,                         -- 체험형인턴 | 연계형인턴 | 계약직 | 정규직 ...
  started_on date,
  ended_on date,
  leave_reason text,
  detail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 7. 수상내역 ----------------------------------------------------------------
create table if not exists awards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  awarded_on date,
  issuer text,
  grade text,                                   -- 대상 | 최우수상 ...
  detail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 첨부파일 -------------------------------------------------------------------
-- 성적증명서·졸업증명서 등. 파일 자체는 Storage에 두고 여기엔 경로만 남긴다.
-- record_type + record_id로 어떤 항목의 첨부인지 가리킨다(테이블마다 첨부
-- 테이블을 따로 만들면 7벌이 된다).
create table if not exists record_attachments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  record_type text not null,                    -- education | certification | award ...
  record_id uuid not null,
  kind text,                                    -- 성적증명서 | 졸업증명서 | 기타
  file_name text not null,
  storage_path text not null,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create index if not exists record_attachments_owner_record_idx
  on record_attachments (owner_id, record_type, record_id);

-- RLS — 나머지 테이블과 같은 owner_all 패턴(§5).
alter table education_records   enable row level security;
alter table education_courses   enable row level security;
alter table certifications      enable row level security;
alter table external_activities enable row level security;
alter table training_programs   enable row level security;
alter table project_records     enable row level security;
alter table work_experiences    enable row level security;
alter table awards              enable row level security;
alter table record_attachments  enable row level security;

create policy owner_all on education_records   for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy owner_all on education_courses   for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy owner_all on certifications      for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy owner_all on external_activities for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy owner_all on training_programs   for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy owner_all on project_records     for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy owner_all on work_experiences    for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy owner_all on awards              for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy owner_all on record_attachments  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- 첨부파일 보관용 비공개 버킷. 증명서에는 학번·주민번호 앞자리 같은 게 찍혀
-- 나오는 경우가 있어 공개 버킷으로 두지 않는다.
insert into storage.buckets (id, name, public)
values ('records', 'records', false)
on conflict (id) do nothing;

-- 파일 경로의 첫 폴더를 소유자 uid로 강제해, 남의 폴더를 읽거나 쓰지 못하게 한다.
create policy "records owner read" on storage.objects
  for select using (bucket_id = 'records' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "records owner insert" on storage.objects
  for insert with check (bucket_id = 'records' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "records owner delete" on storage.objects
  for delete using (bucket_id = 'records' and (storage.foldername(name))[1] = auth.uid()::text);
