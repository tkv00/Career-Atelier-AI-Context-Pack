import { createClient } from '@/lib/supabase/server';
import { AgentLiveRefresh } from '../dashboard/agent-live-refresh';
import { InterviewPrep } from './interview-client';

export default async function InterviewsPage() {
  const supabase = await createClient();
  const [
    { data: jobs },
    { data: questions },
    { data: queuedJobs },
    { data: latestRuns },
  ] = await Promise.all([
    supabase.from('job_posts').select('*').order('updated_at', { ascending: false }),
    supabase.from('interview_questions').select('*').order('order_no', { ascending: true }),
    supabase.from('jobs').select('payload').eq('kind', 'interview').in('status', ['queued', 'running']),
    supabase.from('agent_runs').select('status').eq('agent_id', 'interview').order('created_at', { ascending: false }).limit(1),
  ]);

  const pendingJobIds = (queuedJobs ?? []).flatMap((item) => {
    const payload = item.payload as { jobPostId?: string } | null;
    return payload?.jobPostId ? [payload.jobPostId] : [];
  });

  return <>
    <AgentLiveRefresh enabled={pendingJobIds.length > 0}/>
    <InterviewPrep jobs={jobs ?? []} questions={questions ?? []} pendingJobIds={pendingJobIds} latestStatus={latestRuns?.[0]?.status ?? null}/>
  </>;
}
