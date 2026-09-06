'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteJobPost } from './actions';

/**
 * 채용공고 삭제 — 자소서가 연결돼 있거나 지원 상태가 '제출 완료'면 바로
 * 지우지 않고 한 번 더 확인한다(사용자 요청 2026-09-06). 둘 다 아니면
 * 기존처럼 바로 지운다 — 대부분의 삭제(관심이 사라진 공고 정리)에 불필요한
 * 클릭을 더하지 않기 위해서다.
 *
 * 대시보드(관제실의 "채용공고" 목록)와 지원 일정(캘린더) 두 화면이 같은
 * job_posts를 각자 보여줄 뿐이라 컴포넌트도 하나만 둔다.
 */
export function JobPostDeleteButton({
  jobPostId,
  company,
  role,
  linkedEssayTitles,
  submissionComplete,
  onDeleted,
}: {
  jobPostId: string;
  company: string;
  role: string;
  linkedEssayTitles: string[];
  submissionComplete: boolean;
  /** 캘린더 화면은 삭제된 공고가 편집 폼에 열려 있으면 폼도 함께 비워야 한다 —
      대시보드는 그런 폼이 없어 생략해도 된다. */
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const needsConfirm = linkedEssayTitles.length > 0 || submissionComplete;

  function remove() {
    setError('');
    startTransition(async () => {
      try {
        await deleteJobPost(jobPostId);
        setConfirming(false);
        onDeleted?.();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : '삭제에 실패했습니다.');
      }
    });
  }

  function handleClick() {
    if (needsConfirm) {
      setConfirming(true);
      return;
    }
    remove();
  }

  return (
    <>
      <button
        type="button"
        className="inline-danger-button"
        disabled={pending}
        onClick={handleClick}
        title={`${company} · ${role} 공고를 삭제합니다. 이미 시작한 자소서는 남습니다.`}
      >
        {pending ? '삭제 중…' : '삭제'}
      </button>
      {error && <small className="job-delete-error">{error}</small>}

      {confirming && (
        <div
          className="modal-backdrop"
          role="alertdialog"
          aria-modal="true"
          aria-label="채용공고 삭제 확인"
          onClick={() => !pending && setConfirming(false)}
        >
          <div className="card card-pad job-delete-confirm" onClick={(event) => event.stopPropagation()}>
            <h3>{company} · {role} 공고를 삭제할까요?</h3>
            <ul>
              {linkedEssayTitles.map((title) => (
                <li key={title}>이 공고로 시작한 자소서 &lsquo;{title}&rsquo;이(가) 있습니다.</li>
              ))}
              {submissionComplete && <li>지원 상태가 &lsquo;제출 완료&rsquo;로 표시되어 있습니다.</li>}
            </ul>
            <p>삭제해도 자소서는 그대로 남지만, 이 채용공고 정보와 연결된 캘린더 일정·면접 질문은 함께 사라집니다.</p>
            <div className="job-delete-confirm-actions">
              <button type="button" className="secondary-button" onClick={() => setConfirming(false)} disabled={pending}>
                취소
              </button>
              <button type="button" className="inline-danger-button" onClick={remove} disabled={pending}>
                {pending ? '삭제 중…' : '그래도 삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
