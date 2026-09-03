'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { requestNewsResearch } from './actions';
import { cancelQueuedJob } from '@/lib/jobs-actions';

type PendingJob = { id: string; status: string } | null;

// job-search-button.tsx와 쌍을 이룬다 — 루미와 모카를 각각 독립적으로
// 실행할 수 있어야 한다는 요청(2026-09-02)으로 분리했다. 예전엔 이 버튼이
// NewsSection 헤더 안에 있어서 "관제실에서 지시를 내린다"는 세계관과
// 안 맞았다 — 이제 관제실의 루미 카드 위에 직접 붙는다.
export function NewsRunButton({ pending, runnerOnline, pendingJob }: { pending: boolean; runnerOnline: boolean; pendingJob: PendingJob }) {
  const router = useRouter();

  useEffect(() => {
    if (!pending) return;
    const poll = setInterval(() => router.refresh(), 5_000);
    return () => clearInterval(poll);
  }, [pending, router]);

  async function handleClick() {
    await requestNewsResearch();
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
        {pending ? (runnerOnline ? '조사 중…' : '대기 중') : '뉴스 조사 시작'}
      </button>
      {pendingJob?.status === 'queued' && (
        <button type="button" className="inline-danger-button" onClick={handleCancel} title="러너가 켜질 때까지 대기 중인 요청을 취소합니다">
          취소
        </button>
      )}
    </div>
  );
}
