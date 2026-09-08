-- RLS 정책은 행을 제한하지만 테이블 자체 권한을 대신 주지는 않는다. 예전 설치
-- 경로에서 만든 프로젝트 일부는 authenticated 권한이 빠져 로그인 직후 runners
-- 조회부터 permission denied가 났다. 앱 테이블만 명시해 다른 public 테이블은 건드리지 않는다.
grant select, insert, update, delete on table
  public.profiles,
  public.experience_cards,
  public.job_posts,
  public.research_notes,
  public.prompt_templates,
  public.prompt_versions,
  public.harness_configs,
  public.essay_projects,
  public.essay_versions,
  public.agent_runs,
  public.run_events,
  public.artifacts,
  public.jobs,
  public.runners,
  public.calendar_events,
  public.essay_questions,
  public.essay_autosaves,
  public.essay_suggestions,
  public.interview_questions,
  public.education_records,
  public.education_courses,
  public.certifications,
  public.external_activities,
  public.training_programs,
  public.project_records,
  public.work_experiences,
  public.awards,
  public.record_attachments,
  public.essay_revision_requests,
  public.company_research_attachments,
  public.source_imports,
  public.import_chunk_cache
to authenticated;

-- identity 컬럼의 nextval도 테이블 권한과 별도다.
grant usage, select on sequence public.run_events_id_seq to authenticated;
