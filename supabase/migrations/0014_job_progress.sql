alter table job_posts
  add column if not exists application_type text not null default '서류접수',
  add column if not exists company_type text not null default '미분류',
  add column if not exists submission_status text not null default '미제출',
  add column if not exists result_status text not null default '아직';
