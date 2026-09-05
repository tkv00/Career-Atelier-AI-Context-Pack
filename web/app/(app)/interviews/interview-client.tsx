'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Database } from '@/lib/supabase/database.types';
import { deleteInterviewQuestion, requestInterviewQuestions, saveInterviewQuestion } from './actions';
import { MarkdownCanvas } from './markdown-canvas';

type JobPost = Database['public']['Tables']['job_posts']['Row'];
type InterviewQuestion = Database['public']['Tables']['interview_questions']['Row'];

function QuestionCard({ item }: { item: InterviewQuestion }) {
  const router = useRouter();
  const [question, setQuestion] = useState(item.question);
  const [answer, setAnswer] = useState(item.answer_markdown);
  const [status, setStatus] = useState('저장됨');
  const [pending, startTransition] = useTransition();

  function save() {
    if (!question.trim()) return;
    setStatus('저장 중…');
    startTransition(async () => {
      try {
        await saveInterviewQuestion({
          id: item.id,
          job_post_id: item.job_post_id,
          category: item.category as 'experience' | 'personality' | 'company',
          question,
          answer_markdown: answer,
          source: item.source as 'manual' | 'agent' | 'starter',
          order_no: item.order_no,
        });
        setStatus('저장됨');
        router.refresh();
      } catch (error) {
        setStatus(error instanceof Error ? error.message : '저장 실패');
      }
    });
  }

  function remove() {
    startTransition(async () => {
      await deleteInterviewQuestion(item.id);
      router.refresh();
    });
  }

  return <article className="interview-question-card">
    <header>
      <span className={`question-source ${item.source}`}>{item.source === 'agent' ? '에코 생성' : item.source === 'starter' ? '공통 질문' : '직접 작성'}</span>
      <small>{pending ? '처리 중…' : status}</small>
      <button type="button" onClick={remove} disabled={pending}>삭제</button>
    </header>
    <input className="interview-question-title" value={question} onChange={(event) => { setQuestion(event.target.value); setStatus('수정됨'); }} onBlur={save} aria-label="면접 질문"/>
    <MarkdownCanvas value={answer} onChange={(value) => { setAnswer(value); setStatus('수정됨'); }} onBlur={save} placeholder="답변을 바로 서식이 적용된 문서로 작성하세요. #, -, > 단축키를 사용할 수 있습니다." ariaLabel={`${question} 답변`}/>
    <footer><span>원문은 Markdown으로 안전하게 저장됩니다.</span><button type="button" onClick={save} disabled={pending}>지금 저장</button></footer>
  </article>;
}

export function InterviewPrep({ jobs, questions, pendingJobIds, latestStatus }: { jobs: JobPost[]; questions: InterviewQuestion[]; pendingJobIds: string[]; latestStatus: string | null }) {
  const router = useRouter();
  const [scope, setScope] = useState('experience');
  const [newQuestion, setNewQuestion] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const selectedJobId = scope.startsWith('job:') ? scope.slice(4) : null;
  const selectedJob = jobs.find((job) => job.id === selectedJobId) || null;
  const visibleQuestions = questions
    .filter((item) => selectedJobId ? item.job_post_id === selectedJobId : item.job_post_id === null && item.category === scope)
    .sort((a, b) => a.order_no - b.order_no);
  const agentRunning = Boolean(selectedJobId && pendingJobIds.includes(selectedJobId));

  function addQuestion() {
    if (!newQuestion.trim()) return;
    startTransition(async () => {
      await saveInterviewQuestion({
        job_post_id: selectedJobId,
        category: selectedJobId ? 'company' : scope as 'experience' | 'personality',
        question: newQuestion,
        answer_markdown: '',
        source: 'manual',
      });
      setNewQuestion('');
      router.refresh();
    });
  }

  function generate() {
    if (!selectedJob) return;
    setActionMessage('에코에게 임무를 전달했습니다. 로컬 러너가 질문과 답안을 작성합니다.');
    startTransition(async () => {
      try {
        await requestInterviewQuestions(selectedJob.id);
        router.refresh();
      } catch (error) {
        setActionMessage(error instanceof Error ? error.message : '면접 질문 생성 요청에 실패했습니다.');
      }
    });
  }

  return <section className="interview-page">
    <div className="page-title interview-title">
      <div><h1>면접 준비</h1><p>공통 경험·인성 질문은 한 번 정리하고, 기업별 예상 질문과 답안은 채용공고마다 독립적으로 관리합니다.</p></div>
      <div className="interview-title-stats"><span><b>{questions.filter((item) => !item.job_post_id).length}</b> 공통 질문</span><span><b>{questions.filter((item) => item.job_post_id).length}</b> 기업 질문</span></div>
    </div>
    <div className="interview-layout">
      <aside className="interview-library">
        {/* 표식은 기업 버튼과 같은 문법으로 첫 글자를 쓴다. 예전에는 01·02였는데
            경험 질문과 인성 질문은 순서가 아니라 두 갈래라 번호가 거짓말이었다. */}
        <button className={scope === 'experience' ? 'active' : ''} onClick={() => setScope('experience')}><i>경</i><span><b>경험 질문</b><small>프로젝트·문제해결·실패</small></span><em>{questions.filter((item) => !item.job_post_id && item.category === 'experience').length}</em></button>
        <button className={scope === 'personality' ? 'active' : ''} onClick={() => setScope('personality')}><i>인</i><span><b>인성 질문</b><small>협업·갈등·업무 기준</small></span><em>{questions.filter((item) => !item.job_post_id && item.category === 'personality').length}</em></button>
        <div className="interview-library-label"><span>기업별 질문함</span><small>채용공고마다 독립 공간</small></div>
        {jobs.map((job) => <button className={scope === `job:${job.id}` ? 'active company' : 'company'} key={job.id} onClick={() => setScope(`job:${job.id}`)}><i>{job.company.slice(0, 1)}</i><span><b>{job.company}</b><small>{job.role}</small></span><em>{questions.filter((item) => item.job_post_id === job.id).length}</em></button>)}
        {!jobs.length && <p className="interview-empty-side">대시보드에서 채용공고를 먼저 추가해 주세요.</p>}
      </aside>
      <main className="interview-document-room">
        <div className="interview-room-head">
          <div><h3>{selectedJob ? `${selectedJob.company} · ${selectedJob.role}` : scope === 'experience' ? '공통 경험 질문' : '공통 인성 질문'}</h3><span>{selectedJob ? 'JD와 기업 조사에 연결된 전용 면접 노트' : '모든 기업 면접에서 재사용하는 개인 답변 라이브러리'}</span></div>
          {selectedJob?.url && <a href={selectedJob.url} target="_blank" rel="noreferrer">채용공고 열기</a>}
        </div>
        <div className="new-interview-question"><input value={newQuestion} onChange={(event) => setNewQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addQuestion(); }} placeholder="새 면접 질문을 입력하세요"/><button type="button" onClick={addQuestion} disabled={pending}>+ 질문 추가</button></div>
        <div className="interview-question-stack">{visibleQuestions.map((item) => <QuestionCard key={item.id} item={item}/>)}{!visibleQuestions.length && <div className="empty-interview-room"><b>아직 질문이 없습니다.</b><span>직접 질문을 추가하거나 기업 공간에서 에코에게 예상 질문 생성을 요청하세요.</span></div>}</div>
      </main>
      <aside className="interview-agent-panel">
        <div className={agentRunning ? 'interview-agent-orbit working' : 'interview-agent-orbit'}><div className="interview-agent-sprite"/></div>
        <h3>에코</h3><span>JD·기업 조사·경험 카드를 교차해 질문과 답안을 작성합니다.</span>
        <ul><li>직무 검증 질문</li><li>기업 이해 질문</li><li>경험 근거형 답안</li><li>꼬리질문 대응 포인트</li></ul>
        <button type="button" disabled={!selectedJob || agentRunning || pending} onClick={generate}>{agentRunning ? '질문 설계 중…' : selectedJob ? `${selectedJob.company} 예상 질문 생성` : '기업 공간을 선택하세요'}</button>
        <small>{actionMessage || (latestStatus === 'completed' ? '최근 생성 완료 · 질문함에 자동 저장됨' : '근거가 부족한 답안은 [내 경험 입력 필요]로 표시됩니다.')}</small>
      </aside>
    </div>
  </section>;
}
