import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isRunnerOnline } from '@/lib/runner-status';
import { EssayEditor } from './editor-client';

export default async function EssayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: essay }, { data: versions }, { data: reviews }, { data: drafts }, { data: subtitles }, { data: pendingJobs }, { data: runners }, { data: revisionRequests }, { data: companyAttachments }] =
    await Promise.all([
      supabase.from('essay_projects').select('*').eq('id', id).maybeSingle(),
      supabase.from('essay_versions').select('*').eq('essay_id', id).order('version', { ascending: false }),
      supabase
        .from('artifacts')
        .select('*')
        .eq('kind', 'review')
        .eq('metadata->>essayId', id)
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('artifacts')
        .select('*')
        .eq('kind', 'draft')
        .eq('metadata->>essayId', id)
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('artifacts')
        .select('*')
        .eq('kind', 'subtitle')
        .eq('metadata->>essayId', id)
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('jobs')
        .select('id, kind, status')
        .in('kind', ['review', 'writer', 'company', 'subtitle'])
        .eq('payload->>essayId', id)
        .in('status', ['queued', 'running'])
        .order('created_at', { ascending: false }),
      supabase.from('runners').select('approved, last_seen_at').eq('approved', true),
      // 대화형 수정 이력. 오래된 것부터 보여줘야 "이렇게 시켰고 그다음 이렇게"가 읽힌다.
      supabase
        .from('essay_revision_requests')
        .select('id, instruction, created_at')
        .eq('essay_id', id)
        .order('created_at', { ascending: true }),
      supabase
        .from('company_research_attachments')
        .select('id, file_name, size_bytes, created_at')
        .eq('essay_id', id)
        .order('created_at', { ascending: false }),
    ]);

  if (!essay) notFound();

  const runnerOnline = (runners ?? []).some((runner) => isRunnerOnline(runner.last_seen_at));

  const [{ data: jobPost }, { data: companyResearch }, { data: siblingEssays }] = essay.job_id
    ? await Promise.all([
        supabase.from('job_posts').select('*').eq('id', essay.job_id).maybeSingle(),
        supabase
          .from('research_notes')
          .select('*')
          .eq('kind', 'company')
          .eq('job_id', essay.job_id)
          .order('created_at', { ascending: false })
          .limit(1),
        // "문항 붙여넣기"로 여러 문항을 저장해 뒀으면 같은 공고에 자소서가
        // 여러 개 있을 수 있다(actions.ts startEssayForJobPost) — 편집 화면에서
        // 서로를 오갈 수 있게 형제 목록을 함께 불러온다.
        supabase
          .from('essay_projects')
          .select('id, title, question, draft, target_chars, updated_at')
          .eq('job_id', essay.job_id)
          .order('created_at', { ascending: true }),
      ])
    : [{ data: null }, { data: null }, { data: null }];

  return (
    <EssayEditor
      essay={essay}
      initialVersions={versions ?? []}
      latestReview={reviews?.[0] ?? null}
      latestDraft={drafts?.[0] ?? null}
      latestSubtitle={subtitles?.[0] ?? null}
      jobPost={jobPost ?? null}
      companyResearch={companyResearch?.[0] ?? null}
      reviewPending={(pendingJobs ?? []).some((job) => job.kind === 'review')}
      writerPending={(pendingJobs ?? []).some((job) => job.kind === 'writer')}
      companyPending={(pendingJobs ?? []).some((job) => job.kind === 'company')}
      subtitlePending={(pendingJobs ?? []).some((job) => job.kind === 'subtitle')}
      pendingJobs={pendingJobs ?? []}
      runnerOnline={runnerOnline}
      revisionRequests={revisionRequests ?? []}
      companyAttachments={companyAttachments ?? []}
      siblingEssays={siblingEssays ?? []}
    />
  );
}
