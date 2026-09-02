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
  const url = input.url.trim();
  if (!company || !role || !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) throw new Error('회사명, 지원 직무, 마감일을 확인해 주세요.');
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

  const startsAt = new Date(`${deadline}T12:00:00+09:00`).toISOString();
  const payload = {
    owner_id: user.id,
    job_post_id: jobPostId,
    title: `${company} · ${role} 지원 마감`,
    company,
    event_type: 'deadline',
    starts_at: startsAt,
    all_day: true,
    source_url: url || null,
    confidence: 'confirmed',
    raw_deadline_text: deadline,
    memo: input.jd.trim() || null,
  };
  const { data: existingEvent } = await supabase.from('calendar_events').select('id').eq('job_post_id', jobPostId).limit(1).maybeSingle();
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
    company_type: ['미분류', '대기업', '중견기업', '공기업', '스타트업', '외국계'],
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
