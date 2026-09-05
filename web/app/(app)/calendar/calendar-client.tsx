'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Database } from '@/lib/supabase/database.types';
import { startEssayForJobPost } from '../essays/actions';
import { cycleStageResult, deleteJobPost, saveCalendarJob, updateJobProgress } from './actions';
import { formatDate } from '@/lib/datetime';
import { parseStageResults, STAGES, type Stage } from '@/lib/stage-results';

type CalendarEvent = Database['public']['Tables']['calendar_events']['Row'];
type JobPost = Database['public']['Tables']['job_posts']['Row'];
type CalendarItem = { id: string; jobPostId: string | null; title: string; company: string; startsAt: string; sourceUrl: string; memo: string };

const APPLICATION_TYPES = ['서류접수', '시험 응시', '과제 전형', '1차 면접', '2차 면접', '최종 면접'];
const COMPANY_TYPES = ['미분류', '대기업', '중견기업', '공기업', '스타트업', '외국계'];
const SUBMISSION_STATUSES = ['미제출', '작성중', '검토중', '제출 완료'];
const STAGE_SHORT_LABEL: Record<Stage, string> = { 서류: '서류', 필기시험: '필기', 코딩테스트: '코테', 기술면접: '기술', 최종면접: '최종' };

function dateKey(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function progressTone(job?: JobPost) {
  if (!job) return 'waiting';
  if ((job.result_status || '아직').includes('합격')) return 'pass';
  if (job.result_status === '불합격') return 'fail';
  if (job.submission_status === '제출 완료') return 'submitted';
  if (['작성중', '검토중'].includes(job.submission_status)) return 'working';
  return 'waiting';
}

// 전형 단계 5개를 작은 토글 알약으로 보여준다. 클릭할 때마다 대기→합격→
// 불합격→대기로 돈다 — select 5개를 한 줄에 욱여넣는 것보다 좁은 표
// 칸·호버 미리보기 양쪽에서 다 쓸 수 있다.
function StageToggleRow({ job, disabled, onToggle }: { job: JobPost; disabled: boolean; onToggle: (stage: Stage) => void }) {
  const stages = parseStageResults(job.stage_results);
  return (
    <div className="stage-toggle-row">
      {STAGES.map((stage) => {
        const status = stages[stage];
        const tone = status === '합격' ? 'pass' : status === '불합격' ? 'fail' : 'waiting';
        return (
          <button
            key={stage}
            type="button"
            className={`stage-toggle ${tone}`}
            disabled={disabled}
            onClick={() => onToggle(stage)}
            title={`${stage}: ${status ?? '대기'} (클릭하면 다음 상태로)`}
          >
            {STAGE_SHORT_LABEL[stage]}
          </button>
        );
      })}
    </div>
  );
}

export function CalendarClient({ events, jobs }: { events: CalendarEvent[]; jobs: JobPost[] }) {
  const router = useRouter();
  const now = new Date();
  const [pending, startTransition] = useTransition();
  const [month, setMonth] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [form, setForm] = useState({ jobPostId: '', company: '', role: '', url: '', jd: '', deadline: '', applicationType: '서류접수', companyType: '미분류', submissionStatus: '미제출' });
  const [message, setMessage] = useState('직접 입력하거나 모카가 조사한 공고를 선택하세요.');
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = new Date(first);
  gridStart.setDate(1 - first.getDay());
  const cells = Array.from({ length: 42 }, (_, index) => { const date = new Date(gridStart); date.setDate(gridStart.getDate() + index); return date; });
  const researchedJobs = jobs.filter((job) => job.source !== '캘린더 직접 입력');
  const calendarItems: CalendarItem[] = [
    ...events.map((event) => ({ id: event.id, jobPostId: event.job_post_id, title: event.title, company: event.company || event.title, startsAt: event.starts_at, sourceUrl: event.source_url || '', memo: event.memo || '' })),
    ...jobs.filter((job) => job.deadline && !events.some((event) => event.job_post_id === job.id)).map((job) => ({ id: `job-${job.id}`, jobPostId: job.id, title: `${job.company} · ${job.role} 지원 마감`, company: job.company, startsAt: `${job.deadline}T12:00:00+09:00`, sourceUrl: job.url, memo: job.description })),
  ];
  const upcoming = calendarItems.filter((item) => new Date(item.startsAt).getTime() >= new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()).sort((a, b) => a.startsAt.localeCompare(b.startsAt)).slice(0, 8);

  function chooseJob(id: string) {
    const job = jobs.find((item) => item.id === id);
    if (!job) {
      setForm({ jobPostId: '', company: '', role: '', url: '', jd: '', deadline: '', applicationType: '서류접수', companyType: '미분류', submissionStatus: '미제출' });
      setMessage('직접 입력 모드입니다.'); return;
    }
    setForm({ jobPostId: job.id, company: job.company, role: job.role, url: job.url, jd: job.description, deadline: job.deadline || '', applicationType: job.application_type, companyType: job.company_type, submissionStatus: job.submission_status });
    setMessage(`${job.company} 공고를 불러왔습니다.`);
  }

  function chooseItem(item: CalendarItem) {
    const job = item.jobPostId ? jobs.find((row) => row.id === item.jobPostId) : undefined;
    setForm({ jobPostId: job?.id || '', company: job?.company || item.company, role: job?.role || '', url: job?.url || item.sourceUrl, jd: job?.description || item.memo, deadline: dateKey(item.startsAt), applicationType: job?.application_type || '서류접수', companyType: job?.company_type || '미분류', submissionStatus: job?.submission_status || '미제출' });
    setMessage(`${item.title} 일정을 편집할 수 있도록 불러왔습니다.`);
  }

  function save() {
    startTransition(async () => {
      try { setMessage('채용공고와 일정을 저장하는 중…'); const result = await saveCalendarJob(form); setForm((current) => ({ ...current, jobPostId: result.jobPostId })); setMessage('저장했습니다. 진행상태가 캘린더와 현황판에 함께 반영됩니다.'); router.refresh(); }
      catch (error) { setMessage(error instanceof Error ? error.message : '일정 저장에 실패했습니다.'); }
    });
  }

  function update(jobId: string, field: 'application_type' | 'company_type' | 'submission_status', value: string) {
    startTransition(async () => { await updateJobProgress(jobId, field, value); router.refresh(); });
  }

  function toggleStage(jobId: string, stage: Stage) {
    startTransition(async () => { await cycleStageResult(jobId, stage); router.refresh(); });
  }

  function remove(job: JobPost) {
    startTransition(async () => {
      try {
        await deleteJobPost(job.id);
        if (form.jobPostId === job.id) chooseJob('');
        setMessage(`${job.company} · ${job.role} 지원 기록을 삭제했습니다.`);
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '삭제에 실패했습니다.');
      }
    });
  }

  return <>
    <div className="page-title"><div><h1>지원 일정</h1><p>마감일과 제출·전형별 합불을 함께 확인하고 자소서 작성으로 바로 연결합니다. 날짜에 마우스를 올리면 그날의 일정을 전부 볼 수 있습니다.</p></div><button className="secondary-button" onClick={() => chooseJob('')}>+ 직접 일정 입력</button></div>
    <div className="calendar-workspace">
      <section className="calendar-board">
        <div className="calendar-head"><div><h3>{month.getFullYear()}년 {month.getMonth() + 1}월</h3></div><div><button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button><button onClick={() => setMonth(new Date(now.getFullYear(), now.getMonth(), 1))}>오늘</button><button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button></div></div>
        <div className="calendar-weekdays">{['일', '월', '화', '수', '목', '금', '토'].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="calendar-grid">
          {cells.map((date) => {
            const key = dateKey(date);
            const dayItems = calendarItems.filter((item) => dateKey(item.startsAt) === key);
            return (
              <div className={`calendar-day ${date.getMonth() !== month.getMonth() ? 'outside' : ''} ${key === dateKey(now) ? 'today' : ''}`} key={key} tabIndex={dayItems.length ? 0 : undefined}>
                <b>{date.getDate()}</b>
                <div>
                  {dayItems.slice(0, 2).map((item) => {
                    const job = item.jobPostId ? jobs.find((row) => row.id === item.jobPostId) : undefined;
                    return <button className={`calendar-progress-chip ${progressTone(job)}`} key={item.id} onClick={() => chooseItem(item)} title={`${item.title} · ${job?.submission_status || '일정'}`}><i />{item.company}</button>;
                  })}
                  {dayItems.length > 2 && <small>+{dayItems.length - 2}개 일정</small>}
                </div>
                {dayItems.length > 0 && (
                  <div className="calendar-day-preview" role="tooltip">
                    <p>{date.getMonth() + 1}월 {date.getDate()}일 · {dayItems.length}건</p>
                    <ul>
                      {dayItems.map((item) => {
                        const job = item.jobPostId ? jobs.find((row) => row.id === item.jobPostId) : undefined;
                        return (
                          <li key={item.id}>
                            <span className={`status-pill ${progressTone(job)}`}><i />{job?.result_status ?? '일정'}</span>
                            <b>{item.company}</b>
                            {job?.role && <small>{job.role}</small>}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
      <aside className="calendar-editor"><div><h3>지원 일정 등록</h3></div><label className="researched-job-select"><span>에이전트가 조사한 채용공고</span><select value={form.jobPostId} onChange={(event) => chooseJob(event.target.value)}><option value="">직접 입력</option>{researchedJobs.map((job) => <option key={job.id} value={job.id}>{job.company} · {job.role}</option>)}</select></label><div className="calendar-form-grid"><label><span>회사명 *</span><input value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} /></label><label><span>지원할 직무 *</span><input value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} /></label><label className="wide"><span>채용 사이트</span><input type="url" value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} /></label><label><span>지원 마감일 *</span><input type="date" value={form.deadline} onChange={(event) => setForm({ ...form, deadline: event.target.value })} /></label><label><span>전형 구분</span><select value={form.applicationType} onChange={(event) => setForm({ ...form, applicationType: event.target.value })}>{APPLICATION_TYPES.map((item) => <option key={item}>{item}</option>)}</select></label><label><span>기업 유형</span><select value={form.companyType} onChange={(event) => setForm({ ...form, companyType: event.target.value })}>{COMPANY_TYPES.map((item) => <option key={item}>{item}</option>)}</select></label><label className="wide"><span>제출 여부</span><select value={form.submissionStatus} onChange={(event) => setForm({ ...form, submissionStatus: event.target.value })}>{SUBMISSION_STATUSES.map((item) => <option key={item}>{item}</option>)}</select></label><label className="wide"><span>JD 원문</span><textarea value={form.jd} onChange={(event) => setForm({ ...form, jd: event.target.value })} /></label></div><p className="calendar-message">{message}</p><div className="calendar-form-actions">{form.url && <a href={form.url} target="_blank" rel="noreferrer">공고 원문</a>}<button disabled={pending} onClick={save}>{pending ? '저장 중…' : '캘린더에 저장'}</button>{form.jobPostId && <button className="primary" disabled={pending} onClick={() => startTransition(() => startEssayForJobPost(form.jobPostId))}>자소서 작성 연결</button>}</div>
        {form.jobPostId && (
          <div className="calendar-stage-editor">
            <span>전형별 합불 · 클릭해서 순환(대기→합격→불합격)</span>
            <StageToggleRow job={jobs.find((job) => job.id === form.jobPostId) ?? { stage_results: {} } as JobPost} disabled={pending} onToggle={(stage) => toggleStage(form.jobPostId, stage)} />
          </div>
        )}
      </aside>
    </div>
    <section className="application-status-board">
      <div className="application-status-head"><div><h3>채용공고별 진행상황</h3><span>전형·제출·단계별 합불을 한 화면에서 관리합니다.</span></div><b>{jobs.length}</b></div>
      <div className="application-status-scroll">
        <table>
          <thead><tr><th>구분</th><th>채용공고</th><th>일정</th><th>링크</th><th>기업 유형</th><th>제출 여부</th><th>전형별 합불</th><th>자소서</th><th>삭제</th></tr></thead>
          <tbody>
            {[...jobs].sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999')).map((job) => (
              <tr key={job.id}>
                <td><select disabled={pending} value={job.application_type} onChange={(event) => update(job.id, 'application_type', event.target.value)}>{APPLICATION_TYPES.map((item) => <option key={item}>{item}</option>)}</select></td>
                <td><b>{job.company}</b><span>{job.role}</span></td>
                <td><time>{job.deadline ? formatDate(`${job.deadline}T00:00:00`) : '미정'}</time></td>
                <td>{job.url ? <a href={job.url} target="_blank" rel="noreferrer">공고 원문</a> : <small>링크 없음</small>}</td>
                <td><select disabled={pending} value={job.company_type} onChange={(event) => update(job.id, 'company_type', event.target.value)}>{COMPANY_TYPES.map((item) => <option key={item}>{item}</option>)}</select></td>
                <td><select disabled={pending} className={`status-select ${progressTone({ ...job, result_status: '아직' })}`} value={job.submission_status} onChange={(event) => update(job.id, 'submission_status', event.target.value)}>{SUBMISSION_STATUSES.map((item) => <option key={item}>{item}</option>)}</select></td>
                <td><StageToggleRow job={job} disabled={pending} onToggle={(stage) => toggleStage(job.id, stage)} /></td>
                <td><button type="button" className="essay-link-button" disabled={pending} onClick={() => startTransition(() => startEssayForJobPost(job.id))}>자소서 쓰기</button></td>
                <td><button type="button" className="inline-danger-button" disabled={pending} onClick={() => remove(job)} title="이 지원 기록과 캘린더 일정을 삭제합니다. 이미 작성한 자소서는 남습니다.">삭제</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
    <section className="calendar-upcoming"><div className="calendar-upcoming-head"><div><h3>다가오는 지원 일정</h3></div><b>{upcoming.length}</b></div>{upcoming.length ? upcoming.map((item) => { const job = item.jobPostId ? jobs.find((row) => row.id === item.jobPostId) : undefined; const days = Math.ceil((new Date(item.startsAt).getTime() - now.getTime()) / 86_400_000); return <article key={item.id}><time><b>{Math.max(days, 0)}</b><span>{days <= 0 ? 'D-DAY' : 'DAYS'}</span></time><div><small>{formatDate(item.startsAt)}</small><h4>{item.company} · {job?.role || '지원 일정'}</h4>{job && <div className="upcoming-progress"><span className={progressTone({ ...job, result_status: '아직' })}>{job.submission_status}</span><span className={progressTone(job)}>{job.result_status}</span></div>}<p>{job?.description || item.memo || 'JD가 아직 입력되지 않았습니다.'}</p></div><div>{item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer">채용 사이트</a>}<button onClick={() => chooseItem(item)}>일정 편집</button>{job && <button className="primary" disabled={pending} onClick={() => startTransition(() => startEssayForJobPost(job.id))}>자소서 작성</button>}</div></article>; }) : <p className="calendar-empty">등록된 지원 일정이 없습니다.</p>}</section>
  </>;
}
