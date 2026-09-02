'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { requestJobSearch } from './actions';

export function JobSearchButton({ pending, runnerOnline }: { pending: boolean; runnerOnline: boolean }) {
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

  return (
    <button type="button" className="cloud-agent-run" onClick={handleClick} disabled={pending}>
      {pending ? (runnerOnline ? '탐색 중…' : '대기 중') : '채용 탐색 시작'}
    </button>
  );
}
