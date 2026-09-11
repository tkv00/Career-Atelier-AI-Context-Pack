import { createClient } from '@/lib/supabase/server';
import { parseStageResults } from '@/lib/stage-results';
import { AgentLiveRefresh } from '../dashboard/agent-live-refresh';
import { InterviewPrep } from './interview-client';

// 서류·필기시험·코딩테스트에서 떨어졌다면 그 다음 전형인 면접을 준비할 이유가
// 없다. 자소서를 아직 안 쓴 공고도 마찬가지로 면접 단계 이전이라 카드를
// 띄우지 않는다.
const DISQUALIFYING_STAGES = ['서류', '필기시험', '코딩테스트'] as const;

export default async function InterviewsPage() {
  const supabase = await createClient();
  const [
    { data: jobs },
    { data: questions },
    { data: queuedJobs },
    { data: latestRuns },
    { data: essays },
  ] = await Promise.all([
    supabase.from('job_posts').select('*').order('updated_at', { ascending: false }),
    supabase.from('interview_questions').select('*').order('order_no', { ascending: true }),
    supabase.from('jobs').select('payload').eq('kind', 'interview').in('status', ['queued', 'running']),
    supabase.from('agent_runs').select('status').eq('agent_id', 'interview').order('created_at', { ascending: false }).limit(1),
    supabase.from('essay_projects').select('job_id, draft').not('job_id', 'is', null),
  ]);

  const pendingJobIds = (queuedJobs ?? []).flatMap((item) => {
    const payload = item.payload as { jobPostId?: string } | null;
    return payload?.jobPostId ? [payload.jobPostId] : [];
  });

  const jobIdsWithEssay = new Set(
    (essays ?? [])
      .filter((essay) => essay.job_id && essay.draft.trim().length > 0)
      .map((essay) => essay.job_id as string),
  );

  const visibleJobs = (jobs ?? []).filter((job) => {
    if (!jobIdsWithEssay.has(job.id)) return false;
    const stages = parseStageResults(job.stage_results);
    return !DISQUALIFYING_STAGES.some((stage) => stages[stage] === '불합격');
  });

  return <>
    <AgentLiveRefresh enabled={pendingJobIds.length > 0}/>
    <InterviewPrep jobs={visibleJobs} questions={questions ?? []} pendingJobIds={pendingJobIds} latestStatus={latestRuns?.[0]?.status ?? null}/>
  </>;
}
