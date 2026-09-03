'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { requestJobSearch } from './actions';
import { cancelQueuedJob } from '@/lib/jobs-actions';

type PendingJob = { id: string; status: string } | null;

export function JobSearchButton({ pending, runnerOnline, pendingJob }: { pending: boolean; runnerOnline: boolean; pendingJob: PendingJob }) {
  const router = useRouter();

  useEffect(() => {
    if (!pending) return;
    const poll = setInterval(() => router.refresh(), 5_000);
    return () => clearInterval(poll);
  }, [pending, router]);

  async function handleClick() {
    await requestJobSearch();
    router.refresh();
  }

  async function handleCancel() {
    if (!pendingJob) return;
    await cancelQueuedJob(pendingJob.id, '/dashboard');
    router.refresh();
  }

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <button type="button" className="cloud-agent-run" onClick={handleClick} disabled={pending}>
        {pending ? (runnerOnline ? '탐색 중…' : '대기 중') : '채용 탐색 시작'}
      </button>
      {pendingJob?.status === 'queued' && (
        <button type="button" className="inline-danger-button" onClick={handleCancel} title="러너가 켜질 때까지 대기 중인 요청을 취소합니다">
          취소
        </button>
      )}
    </div>
  );
}
