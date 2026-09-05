'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteJobPost } from '../calendar/actions';

// 모카가 찾아 온 공고 중 관심 없는 것을 관제실에서 바로 지운다. 캘린더
// 페이지의 삭제(inline-danger-button)와 같은 액션을 그대로 쓴다 —
// job_posts는 두 화면이 같은 테이블을 보여줄 뿐이라, 삭제 로직을 따로 둘
// 이유가 없다. 지워도 이미 시작한 자소서는 남는다(deleteJobPost 주석 참고).
export function JobPostDeleteButton({ jobPostId, company, role }: { jobPostId: string; company: string; role: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');

  function remove() {
    setError('');
    startTransition(async () => {
      try {
        await deleteJobPost(jobPostId);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : '삭제에 실패했습니다.');
      }
    });
  }

  return (
    <>
      <button
        type="button"
        className="inline-danger-button"
        disabled={pending}
        onClick={remove}
        title={`${company} · ${role} 공고를 삭제합니다. 이미 시작한 자소서는 남습니다.`}
      >
        {pending ? '삭제 중…' : '삭제'}
      </button>
      {error && <small style={{ color: 'var(--danger)' }}>{error}</small>}
    </>
  );
}
