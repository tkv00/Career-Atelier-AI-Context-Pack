'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { deriveResultStatus, nextStageStatus, parseStageResults, STAGES, type Stage } from '@/lib/stage-results';

export type CalendarJobInput = {
  jobPostId?: string;
  company: string;
  role: string;
  url: string;
  jd: string;
  deadline: string;
  /** "HH:MM" — 비워 두면 예전처럼 정오(all_day)로 저장한다(요청 2026-09-06:
      마감 시·분까지 기록). */
  deadlineTime?: string;
  applicationType?: string;
  companyType?: string;
  submissionStatus?: string;
};

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { supabase, user };
}

export async function saveCalendarJob(input: CalendarJobInput) {
  const company = input.company.trim();
  const role = input.role.trim();
  const deadline = input.deadline.trim();
  const deadlineTime = (input.deadlineTime ?? '').trim();
  const url = input.url.trim();
  if (!company || !role || !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) throw new Error('회사명, 지원 직무, 마감일을 확인해 주세요.');
  if (deadlineTime && !/^\d{2}:\d{2}$/.test(deadlineTime)) throw new Error('마감 시각 형식이 올바르지 않습니다.');
  const date = new Date(`${deadline}T${deadlineTime || '12:00'}:00+09:00`);
  if (!Number.isFinite(date.getTime()) || new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 16) !== `${deadline}T${deadlineTime || '12:00'}`) {
    throw new Error('실제 존재하는 마감일과 시각을 입력해 주세요.');
  }
  const startsAt = date.toISOString();
  if (url) {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('채용 사이트는 HTTP(S) 주소만 입력할 수 있습니다.');
  }

  const { supabase, user } = await requireUser();
  let jobPostId = input.jobPostId || '';
  if (!jobPostId && url) {
    const { data: existingByUrl } = await supabase.from('job_posts').select('id').eq('url', url).limit(1).maybeSingle();
    jobPostId = existingByUrl?.id || '';
  }

  // result_status는 여기서 직접 안 건드린다 — cycleStageResult가 stage_results로부터
  // 다시 계산해서 쓰는 값이라, 여기서 같이 쓰면 두 값이 어긋난다. 신규 생성 시엔
  // 컬럼 기본값('아직')을 그대로 둔다.
  if (jobPostId) {
    const { error } = await supabase.from('job_posts').update({
      company, role, url, deadline, description: input.jd.trim(), application_type: input.applicationType || '서류접수', company_type: input.companyType || '미분류',
      submission_status: input.submissionStatus || '미제출', updated_at: new Date().toISOString(),
    }).eq('id', jobPostId);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase.from('job_posts').insert({
      owner_id: user.id, company, role, url, deadline, description: input.jd.trim(), status: 'saved', source: '캘린더 직접 입력', requirements: [], fit_score: 0,
      application_type: input.applicationType || '서류접수', company_type: input.companyType || '미분류', submission_status: input.submissionStatus || '미제출',
    }).select('id').single();
    if (error || !data) throw new Error(error?.message ?? '채용공고 저장 실패');
    jobPostId = data.id;
  }

  // 시각을 지정하면 그 시각으로, 아니면 예전처럼 정오·종일 일정으로 둔다 —
  // 시각 없이 날짜만 아는 공고를 억지로 "몇 시 마감"처럼 보이게 하지 않는다.
  const payload = {
    owner_id: user.id,
    job_post_id: jobPostId,
    title: `${company} · ${role} 지원 마감`,
    company,
    event_type: 'deadline',
    starts_at: startsAt,
    all_day: !deadlineTime,
    source_url: url || null,
    confidence: 'confirmed',
    raw_deadline_text: deadlineTime ? `${deadline} ${deadlineTime}` : deadline,
    memo: input.jd.trim() || null,
  };
  const { data: existingEvent } = await supabase.from('calendar_events').select('id').eq('job_post_id', jobPostId).eq('event_type', 'deadline').limit(1).maybeSingle().throwOnError();
  const result = existingEvent
    ? await supabase.from('calendar_events').update(payload).eq('id', existingEvent.id)
    : await supabase.from('calendar_events').insert(payload);
  if (result.error) throw new Error(result.error.message);

  revalidatePath('/calendar');
  revalidatePath('/dashboard');
  return { ok: true as const, jobPostId };
}

// result_status는 여기 없다 — cycleStageResult 전용이다(위 주석 참고).
export async function updateJobProgress(jobPostId: string, field: 'application_type' | 'company_type' | 'submission_status', value: string) {
  const { supabase } = await requireUser();
  const allowed = {
    application_type: ['서류접수', '시험 응시', '과제 전형', '1차 면접', '2차 면접', '최종 면접'],
    company_type: ['미분류', '대기업', '중견기업', '공기업', '스타트업', '외국계', '기타기업'],
    submission_status: ['미제출', '작성중', '검토중', '제출 완료'],
  } as const;
  if (!(allowed[field] as readonly string[]).includes(value)) throw new Error('지원 상태 값이 올바르지 않습니다.');
  const updatedAt = new Date().toISOString();
  const result = field === 'application_type'
    ? await supabase.from('job_posts').update({ application_type: value, updated_at: updatedAt }).eq('id', jobPostId)
    : field === 'company_type'
      ? await supabase.from('job_posts').update({ company_type: value, updated_at: updatedAt }).eq('id', jobPostId)
      : await supabase.from('job_posts').update({ submission_status: value, updated_at: updatedAt }).eq('id', jobPostId);
  const { error } = result;
  if (error) throw new Error(error.message);
  revalidatePath('/calendar');
  revalidatePath('/dashboard');
}

// job_posts를 지우면 calendar_events·interview_questions는 FK cascade로 함께
// 지워지고, essay_projects.job_id는 on delete set null이라 이미 쓴 자소서는
// 남는다(0001_init_schema.sql) — 여기서 따로 정리할 게 없다.
export async function deleteJobPost(jobPostId: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from('job_posts').delete().eq('id', jobPostId).eq('owner_id', user.id);
  if (error) throw new Error(error.message);

  revalidatePath('/calendar');
  revalidatePath('/dashboard');
}

// 전형 단계 하나를 클릭할 때마다 대기→합격→불합격→대기로 순환시킨다.
// stage_results를 갱신하면서 result_status도 같이 재계산해 써 둔다 —
// 캘린더 칩·현황판 색이 이 컬럼만 보고 있어서, 한 번의 업데이트에 두
// 컬럼을 같이 반영해야 화면 전체가 어긋나지 않는다.
export async function cycleStageResult(jobPostId: string, stage: Stage) {
  if (!STAGES.includes(stage)) throw new Error('알 수 없는 전형 단계입니다.');
  const { supabase } = await requireUser();

  const { data: job, error: fetchError } = await supabase
    .from('job_posts')
    .select('stage_results')
    .eq('id', jobPostId)
    .single();
  if (fetchError || !job) throw new Error(fetchError?.message ?? '채용공고를 찾을 수 없습니다.');

  const current = parseStageResults(job.stage_results);
  const next = { ...current };
  const nextStatus = nextStageStatus(current[stage]);
  if (nextStatus) next[stage] = nextStatus;
  else delete next[stage];

  const { error } = await supabase
    .from('job_posts')
    .update({ stage_results: next, result_status: deriveResultStatus(next), updated_at: new Date().toISOString() })
    .eq('id', jobPostId);
  if (error) throw new Error(error.message);

  revalidatePath('/calendar');
  revalidatePath('/dashboard');
}
