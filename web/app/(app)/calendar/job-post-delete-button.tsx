'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteJobPost } from './actions';

/**
 * 채용공고 삭제는 캘린더의 작은 버튼에서도 실행되므로 실수로 누른 클릭과
 * 의도한 삭제를 구분할 수 있게 항상 확인창을 거친다. 연결된 자소서가 있으면
 * 확인창 안에서 별도로 경고하되, 자소서 자체는 보존한다.
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
  compact = false,
  onDeleted,
}: {
  jobPostId: string;
  company: string;
  role: string;
  linkedEssayTitles: string[];
  submissionComplete: boolean;
  compact?: boolean;
  /** 캘린더 화면은 삭제된 공고가 편집 폼에 열려 있으면 폼도 함께 비워야 한다 —
      대시보드는 그런 폼이 없어 생략해도 된다. */
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');

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
    setError('');
    setConfirming(true);
  }

  return (
    <>
      <button
        type="button"
        className={compact ? 'calendar-item-delete' : 'inline-danger-button'}
        disabled={pending}
        onClick={handleClick}
        aria-label={`${company} · ${role} 일정 삭제`}
        title={`${company} · ${role} 공고를 삭제합니다. 이미 시작한 자소서는 남습니다.`}
      >
        {compact ? (pending ? '…' : '×') : (pending ? '삭제 중…' : '삭제')}
      </button>
      {error && !confirming && <small className="job-delete-error">{error}</small>}

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
            {(linkedEssayTitles.length > 0 || submissionComplete) && (
              <ul>
                {linkedEssayTitles.map((title, index) => (
                  <li key={`${title}-${index}`}>작성 중인 자기소개서 &lsquo;{title}&rsquo;이(가) 있습니다.</li>
                ))}
                {submissionComplete && <li>지원 상태가 &lsquo;제출 완료&rsquo;로 표시되어 있습니다.</li>}
              </ul>
            )}
            <p>삭제해도 자소서는 그대로 남지만, 이 채용공고 정보와 연결된 캘린더 일정·면접 질문은 함께 사라집니다.</p>
            {error && <small className="job-delete-error">{error}</small>}
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
