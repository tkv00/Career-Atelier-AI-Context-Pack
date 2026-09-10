'use client';

import { useEffect, useRef, useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { Database } from '@/lib/supabase/database.types';
import { startEssayForJobPost } from '../essays/actions';
import { cycleStageResult, saveCalendarJob, updateJobProgress } from './actions';
import { JobPostDeleteButton } from './job-post-delete-button';
import { formatDate, remainingLabel, timeInputValue, type RemainingTime } from '@/lib/datetime';
import { formatCompanyRating } from '@/lib/company-rating';
import { parseStageResults, STAGES, type Stage } from '@/lib/stage-results';

type CalendarEvent = Database['public']['Tables']['calendar_events']['Row'];
type JobPost = Database['public']['Tables']['job_posts']['Row'];
type EssayLink = { job_id: string | null; title: string };
type CalendarItem = { id: string; jobPostId: string | null; title: string; company: string; startsAt: string; allDay: boolean; sourceUrl: string; memo: string };

const APPLICATION_TYPES = ['서류접수', '시험 응시', '과제 전형', '1차 면접', '2차 면접', '최종 면접'];
const COMPANY_TYPES = ['미분류', '대기업', '중견기업', '공기업', '스타트업', '외국계', '기타기업'];
const SUBMISSION_STATUSES = ['미제출', '작성중', '검토중', '제출 완료'];
const STAGE_SHORT_LABEL: Record<Stage, string> = { 서류: '서류', 필기시험: '필기', 코딩테스트: '코테', 기술면접: '기술', 최종면접: '최종' };

// 한 칸에 칩 3개까지 세우고 나머지는 "+N건"으로 접는다 — 칸이 172×124px가
// 되면서 예전 2개에서 하나 늘었다.
const CHIPS_PER_DAY = 3;

const EMPTY_FORM = { jobPostId: '', company: '', role: '', url: '', jd: '', deadline: '', deadlineTime: '', applicationType: '서류접수', companyType: '미분류', submissionStatus: '미제출' };

// 현황판은 "지금 뭐가 급한가"에 답하는 게 일이라 마감 기준으로 추린다.
// 예전에 따로 있던 "다가오는 지원 일정" 섹션이 하던 일을 이 필터가 대신한다 —
// 같은 공고를 마감순으로 다시 늘어놓기만 했을 뿐이라 정보 증분이 없었다.
type BoardFilter = 'all' | 'urgent' | 'open' | 'closed';
const BOARD_FILTERS: { key: BoardFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'urgent', label: '마감 임박' },
  { key: 'open', label: '미제출' },
  { key: 'closed', label: '종료' },
];

type ViewMode = 'card' | 'table';

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
// 칸·카드 양쪽에서 다 쓸 수 있다. 카드에서는 className을 바꿔 한 줄을
// 가득 채운 등폭 트랙으로 세운다(순서가 곧 진척도다).
function StageToggleRow({ job, disabled, onToggle, className = 'stage-toggle-row' }: { job: JobPost; disabled: boolean; onToggle: (stage: Stage) => void; className?: string }) {
  const stages = parseStageResults(job.stage_results);
  return (
    <div className={className}>
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

export function CalendarClient({ events, jobs, essays }: { events: CalendarEvent[]; jobs: JobPost[]; essays: EssayLink[] }) {
  const router = useRouter();
  const now = new Date();
  const essayTitlesByJobPost = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const essay of essays) {
      if (!essay.job_id) continue;
      const list = map.get(essay.job_id) ?? [];
      list.push(essay.title);
      map.set(essay.job_id, list);
    }
    return map;
  }, [essays]);
  const [pending, startTransition] = useTransition();
  const [month, setMonth] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [form, setForm] = useState(EMPTY_FORM);
  const [message, setMessage] = useState('직접 입력하거나 모카가 조사한 공고를 선택하세요.');
  // 등록·편집 폼은 서랍으로 옮겼다. 예전에는 340px 고정 폭으로 달력 옆에 늘
  // 붙어 있었는데, 실제로 쓰이는 건 저장하는 순간뿐인데도 달력 폭의 27%를
  // 먹고 있었다(측정 2026-09-08).
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filter, setFilter] = useState<BoardFilter>('all');
  const [view, setView] = useState<ViewMode>('card');
  // 칸을 넘는 날짜는 클릭해서 펼친다 — 예전에는 마우스 올림(hover)으로
  // 열렸는데, 트리거와 팝업 사이 6px 틈을 마우스가 지나는 순간 hover가
  // 끊겨 팝업이 닫히면서 "스크롤하려고 하면 사라진다"는 문제가 있었다
  // (사용자 실제로 겪음, 2026-09-06). 클릭으로 열고 상태로 고정하면 그
  // 틈 문제 자체가 없어지고, 터치 기기에서도 그대로 동작한다.
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const expandedDayRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!expandedDay) return;
    function closeIfOutside(event: MouseEvent) {
      if (expandedDayRef.current && !expandedDayRef.current.contains(event.target as Node)) setExpandedDay(null);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setExpandedDay(null);
    }
    document.addEventListener('mousedown', closeIfOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeIfOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [expandedDay]);
  useEffect(() => {
    if (!drawerOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setDrawerOpen(false);
    }
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [drawerOpen]);

  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = new Date(first);
  gridStart.setDate(1 - first.getDay());
  // 이 달에 실제로 필요한 주만 그린다 — 예전에는 42칸(6주)을 무조건 그려서
  // 5주로 끝나는 달은 빈 줄 하나가 통째로 남았다.
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const weekCount = Math.ceil((first.getDay() + daysInMonth) / 7);
  const cells = Array.from({ length: weekCount * 7 }, (_, index) => { const date = new Date(gridStart); date.setDate(gridStart.getDate() + index); return date; });
  const researchedJobs = jobs.filter((job) => job.source !== '캘린더 직접 입력');
  const calendarItems: CalendarItem[] = [
    ...events.map((event) => ({ id: event.id, jobPostId: event.job_post_id, title: event.title, company: event.company || event.title, startsAt: event.starts_at, allDay: event.all_day, sourceUrl: event.source_url || '', memo: event.memo || '' })),
    ...jobs.filter((job) => job.deadline && !events.some((event) => event.job_post_id === job.id)).map((job) => ({ id: `job-${job.id}`, jobPostId: job.id, title: `${job.company} · ${job.role} 지원 마감`, company: job.company, startsAt: `${job.deadline}T12:00:00+09:00`, allDay: true, sourceUrl: job.url, memo: job.description })),
  ];
  // 진행상황판의 마감 표시도 캘린더와 같은 남은 시간을 쓴다 — 공고에 이미
  // 시각까지 등록된 일정이 있으면 그 정확한 시각을 쓴다.
  const calendarItemByJobId = new Map(calendarItems.map((item) => [item.jobPostId, item]));

  function jobRemaining(job: JobPost): RemainingTime | null {
    const startsAt = calendarItemByJobId.get(job.id)?.startsAt ?? (job.deadline ? `${job.deadline}T12:00:00+09:00` : null);
    return startsAt ? remainingLabel(startsAt, now) : null;
  }

  const boardJobs = jobs
    .map((job) => ({ job, remaining: jobRemaining(job) }))
    .filter(({ job, remaining }) => {
      const closed = (remaining?.pastDue ?? false) || job.result_status === '불합격';
      if (filter === 'urgent') return !!remaining && !remaining.pastDue && (remaining.tone === 'now' || remaining.tone === 'soon');
      if (filter === 'open') return !closed && job.submission_status !== '제출 완료';
      if (filter === 'closed') return closed;
      return true;
    })
    .sort((a, b) => (a.job.deadline || '9999').localeCompare(b.job.deadline || '9999'));

  function chooseJob(id: string) {
    const job = jobs.find((item) => item.id === id);
    if (!job) {
      setForm(EMPTY_FORM);
      setMessage('직접 입력 모드입니다.'); return;
    }
    // job_posts.deadline은 날짜만 있고 시각이 없다 — 이미 캘린더에 시각까지
    // 등록된 공고라면 아래 chooseItem으로 불러올 때 채워진다.
    setForm({ jobPostId: job.id, company: job.company, role: job.role, url: job.url, jd: job.description, deadline: job.deadline || '', deadlineTime: '', applicationType: job.application_type, companyType: job.company_type, submissionStatus: job.submission_status });
    setMessage(`${job.company} 공고를 불러왔습니다.`);
  }

  function chooseItem(item: CalendarItem) {
    const job = item.jobPostId ? jobs.find((row) => row.id === item.jobPostId) : undefined;
    setForm({
      jobPostId: job?.id || '',
      company: job?.company || item.company,
      role: job?.role || '',
      url: job?.url || item.sourceUrl,
      jd: job?.description || item.memo,
      deadline: dateKey(item.startsAt),
      deadlineTime: item.allDay ? '' : timeInputValue(item.startsAt),
      applicationType: job?.application_type || '서류접수',
      companyType: job?.company_type || '미분류',
      submissionStatus: job?.submission_status || '미제출',
    });
    setMessage(`${item.title} 일정을 편집할 수 있도록 불러왔습니다.`);
  }

  /** 빈 날짜를 클릭하면 그 날짜가 채워진 채로 서랍이 열린다. */
  function openNewOn(deadline: string) {
    setForm({ ...EMPTY_FORM, deadline });
    setMessage(deadline ? `${formatDate(`${deadline}T00:00:00`)} 마감으로 새 일정을 만듭니다.` : '직접 입력하거나 모카가 조사한 공고를 선택하세요.');
    setExpandedDay(null);
    setDrawerOpen(true);
  }

  function openItem(item: CalendarItem) {
    chooseItem(item);
    setExpandedDay(null);
    setDrawerOpen(true);
  }

  function openJob(job: JobPost) {
    const item = calendarItemByJobId.get(job.id);
    if (item) chooseItem(item);
    else chooseJob(job.id);
    setDrawerOpen(true);
  }

  function save() {
    startTransition(async () => {
      try { setMessage('채용공고와 일정을 저장하는 중…'); const result = await saveCalendarJob(form); setForm((current) => ({ ...current, jobPostId: result.jobPostId })); setMessage('저장했습니다. 진행상태가 캘린더와 현황판에 함께 반영됩니다.'); setDrawerOpen(false); router.refresh(); }
      catch (error) { setMessage(error instanceof Error ? error.message : '일정 저장에 실패했습니다.'); }
    });
  }

  function update(jobId: string, field: 'application_type' | 'company_type' | 'submission_status', value: string) {
    startTransition(async () => { await updateJobProgress(jobId, field, value); router.refresh(); });
  }

  function toggleStage(jobId: string, stage: Stage) {
    startTransition(async () => { await cycleStageResult(jobId, stage); router.refresh(); });
  }

  return <>
    <div className="page-title">
      <div>
        <h1>지원 일정</h1>
        {/* 예전 안내는 "날짜에 마우스를 올리면"이었는데, 2026-09-06에 클릭
            방식으로 바꾸면서 문구만 따라오지 않았다. */}
        <p>날짜를 클릭하면 그 날짜로 일정을 등록하고, 일정이 많은 날은 &lsquo;+N건&rsquo;을 눌러 전부 봅니다.</p>
      </div>
      <button className="secondary-button" onClick={() => openNewOn('')}>+ 직접 일정 입력</button>
    </div>

    <section className="calendar-board">
      <div className="calendar-head"><div><h3>{month.getFullYear()}년 {month.getMonth() + 1}월</h3></div><div><button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="이전 달">‹</button><button onClick={() => setMonth(new Date(now.getFullYear(), now.getMonth(), 1))}>오늘</button><button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="다음 달">›</button></div></div>
      <div className="calendar-weekdays">{['일', '월', '화', '수', '목', '금', '토'].map((day) => <span key={day}>{day}</span>)}</div>
      <div className="calendar-grid">
        {cells.map((date, index) => {
          const key = dateKey(date);
          const dayItems = calendarItems.filter((item) => dateKey(item.startsAt) === key);
          const isExpanded = expandedDay === key;
          const weekday = index % 7;
          const dayLabel = `${date.getMonth() + 1}월 ${date.getDate()}일`;
          return (
            <div
              className={`calendar-day ${date.getMonth() !== month.getMonth() ? 'outside' : ''} ${key === dateKey(now) ? 'today' : ''} ${weekday === 0 || weekday === 6 ? 'weekend' : ''}`}
              key={key}
              ref={isExpanded ? expandedDayRef : undefined}
            >
              {/* 칸 전체를 덮는 등록 버튼. 칩 뒤(z-index:0)에 깔려 있어 빈 공간을
                  누르면 이게 잡히고, 칩을 누르면 칩이 잡힌다 — 버튼 안에 버튼이
                  들어가는 마크업을 피하려고 겹치지 않고 깔았다. */}
              <button type="button" className="calendar-day-add" onClick={() => openNewOn(key)} aria-label={`${dayLabel}에 일정 등록`} />
              <b>{date.getDate()}</b>
              <div className="calendar-day-items">
                {dayItems.slice(0, CHIPS_PER_DAY).map((item) => {
                  const job = item.jobPostId ? jobs.find((row) => row.id === item.jobPostId) : undefined;
                  return (
                    <div className="calendar-progress-row" key={item.id}>
                      <button className={`calendar-progress-chip ${progressTone(job)}`} onClick={() => openItem(item)} title={`${item.title} · ${job?.submission_status || '일정'}`}><i /><span>{item.company}</span></button>
                      {job && (
                        <JobPostDeleteButton
                          compact
                          jobPostId={job.id}
                          company={job.company}
                          role={job.role}
                          linkedEssayTitles={essayTitlesByJobPost.get(job.id) ?? []}
                          submissionComplete={job.submission_status === '제출 완료'}
                          onDeleted={() => { if (form.jobPostId === job.id) setDrawerOpen(false); }}
                        />
                      )}
                    </div>
                  );
                })}
                {dayItems.length > CHIPS_PER_DAY && (
                  <button type="button" className="calendar-day-more" onClick={() => setExpandedDay(isExpanded ? null : key)} aria-expanded={isExpanded}>
                    +{dayItems.length - CHIPS_PER_DAY}건
                  </button>
                )}
              </div>
              {isExpanded && (
                // 팝업이 보드 밖으로 흐르지 않게 어느 쪽으로 펼칠지 여기서 정한다 —
                // 달마다 주 수가 달라(5주/6주) CSS의 :nth-child로는 "마지막 두 줄"을
                // 짚을 수 없다.
                <div
                  className={`calendar-day-preview ${weekday >= 5 ? 'flip-left' : ''} ${Math.floor(index / 7) >= weekCount - 2 ? 'flip-up' : ''}`}
                  role="dialog"
                  aria-label={`${dayLabel} 일정 ${dayItems.length}건`}
                >
                  <div className="calendar-day-preview-head">
                    <p>{dayLabel} · {dayItems.length}건</p>
                    <button type="button" onClick={() => setExpandedDay(null)} aria-label="닫기">×</button>
                  </div>
                  <ul>
                    {dayItems.map((item) => {
                      const job = item.jobPostId ? jobs.find((row) => row.id === item.jobPostId) : undefined;
                      const remaining = remainingLabel(item.startsAt, now);
                      return (
                        <li key={item.id}>
                          <div className="calendar-day-preview-item">
                            <button type="button" className="calendar-day-preview-open" onClick={() => openItem(item)}>
                              <span className={`status-pill ${progressTone(job)}`}><i />{job?.result_status ?? '일정'}</span>
                              <b>{item.company}</b>
                              {job?.role && <small>{job.role}</small>}
                              <em className={`calendar-day-preview-remaining urgency ${remaining.tone}`}>{remaining.label}</em>
                            </button>
                            {job && (
                              <JobPostDeleteButton
                                compact
                                jobPostId={job.id}
                                company={job.company}
                                role={job.role}
                                linkedEssayTitles={essayTitlesByJobPost.get(job.id) ?? []}
                                submissionComplete={job.submission_status === '제출 완료'}
                                onDeleted={() => { setExpandedDay(null); if (form.jobPostId === job.id) setDrawerOpen(false); }}
                              />
                            )}
                          </div>
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

    <section className="application-status-board">
      <div className="application-status-head">
        <div><h3>채용공고별 진행상황</h3><span>전형·제출·단계별 합불을 한 화면에서 관리합니다.</span></div>
        <div className="board-controls">
          <div className="filter-chips">
            {BOARD_FILTERS.map((item) => (
              <button key={item.key} type="button" className="filter-chip" aria-pressed={filter === item.key} onClick={() => setFilter(item.key)}>{item.label}</button>
            ))}
          </div>
          <div className="view-toggle">
            <button type="button" aria-pressed={view === 'card'} onClick={() => setView('card')}>카드</button>
            <button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')}>표</button>
          </div>
        </div>
        <b>{boardJobs.length}</b>
      </div>

      {view === 'card' ? (
        <div className="job-card-grid">
          {boardJobs.length ? boardJobs.map(({ job, remaining }) => (
            <article className={`job-card ${remaining && !remaining.pastDue ? remaining.tone : ''}`} key={job.id}>
              <div className="job-card-head">
                <div className="job-card-id">
                  <b title={job.company}>{job.company}</b>
                  <span title={job.role}>{job.role}</span>
                </div>
                <div className={`job-card-dday urgency ${remaining ? remaining.tone : 'far'}`}>
                  <b>{remaining ? (remaining.pastDue ? '마감' : remaining.value) : '—'}</b>
                  <span>{remaining ? (remaining.pastDue ? '지남' : remaining.unit) : '날짜 미정'}</span>
                </div>
              </div>
              <p className="job-card-meta">
                {job.deadline && <time>{formatDate(`${job.deadline}T00:00:00`)}</time>}
                <span className="job-tag">{job.application_type}</span>
                <span className="job-tag">{job.company_type}</span>
                <small>{formatCompanyRating(job.company_rating)}</small>
              </p>
              <StageToggleRow className="job-stage-track" job={job} disabled={pending} onToggle={(stage) => toggleStage(job.id, stage)} />
              <div className="job-card-foot">
                <span className={`status-pill ${progressTone(job)}`}><i />{job.submission_status}</span>
                <div className="job-card-actions">
                  <button type="button" className="essay-link-button" disabled={pending} onClick={() => startTransition(() => startEssayForJobPost(job.id))}>자소서 쓰기</button>
                  {job.url && <a className="card-ghost-button" href={job.url} target="_blank" rel="noreferrer">공고 원문</a>}
                  <button type="button" className="card-ghost-button" onClick={() => openJob(job)}>편집</button>
                  <JobPostDeleteButton
                    jobPostId={job.id}
                    company={job.company}
                    role={job.role}
                    linkedEssayTitles={essayTitlesByJobPost.get(job.id) ?? []}
                    submissionComplete={job.submission_status === '제출 완료'}
                    onDeleted={() => { if (form.jobPostId === job.id) setDrawerOpen(false); }}
                  />
                </div>
              </div>
            </article>
          )) : <p className="calendar-empty">{filter === 'all' ? '등록된 채용공고가 없습니다. 달력에서 날짜를 클릭해 추가하세요.' : '이 조건에 해당하는 공고가 없습니다.'}</p>}
        </div>
      ) : (
        <div className="application-status-scroll">
          <table>
            {/* 열 폭을 내용에 맡기면 매 렌더 달라져 행을 세로로 훑을 때 눈이
                고정 위치를 못 잡는다 — 여기서 못 박는다. */}
            <colgroup>
              <col style={{ width: 116 }} />
              <col style={{ width: 240 }} />
              <col style={{ width: 116 }} />
              <col style={{ width: 84 }} />
              <col style={{ width: 116 }} />
              <col style={{ width: 116 }} />
              <col style={{ width: 200 }} />
              <col style={{ width: 96 }} />
              <col style={{ width: 76 }} />
            </colgroup>
            <thead><tr><th>구분</th><th>채용공고</th><th>일정</th><th>링크</th><th>기업 유형</th><th>제출 여부</th><th>전형별 합불</th><th>자소서</th><th>삭제</th></tr></thead>
            <tbody>
              {boardJobs.map(({ job, remaining }) => (
                <tr key={job.id}>
                  <td><select disabled={pending} value={job.application_type} onChange={(event) => update(job.id, 'application_type', event.target.value)}>{APPLICATION_TYPES.map((item) => <option key={item}>{item}</option>)}</select></td>
                  <td><b>{job.company}</b><span>{job.role}</span><small className="company-rating">{formatCompanyRating(job.company_rating)}</small></td>
                  <td>
                    {job.deadline && remaining ? (
                      <>
                        <time>{formatDate(`${job.deadline}T00:00:00`)}</time>
                        <em className={`deadline-remaining urgency ${remaining.tone}`}>{remaining.label}</em>
                      </>
                    ) : (
                      '미정'
                    )}
                  </td>
                  <td>{job.url ? <a href={job.url} target="_blank" rel="noreferrer">공고 원문</a> : <small>링크 없음</small>}</td>
                  <td><select disabled={pending} value={job.company_type} onChange={(event) => update(job.id, 'company_type', event.target.value)}>{COMPANY_TYPES.map((item) => <option key={item}>{item}</option>)}</select></td>
                  <td><select disabled={pending} className={`status-select ${progressTone({ ...job, result_status: '아직' })}`} value={job.submission_status} onChange={(event) => update(job.id, 'submission_status', event.target.value)}>{SUBMISSION_STATUSES.map((item) => <option key={item}>{item}</option>)}</select></td>
                  <td><StageToggleRow job={job} disabled={pending} onToggle={(stage) => toggleStage(job.id, stage)} /></td>
                  <td><button type="button" className="essay-link-button" disabled={pending} onClick={() => startTransition(() => startEssayForJobPost(job.id))}>자소서 쓰기</button></td>
                  <td>
                    <JobPostDeleteButton
                      jobPostId={job.id}
                      company={job.company}
                      role={job.role}
                      linkedEssayTitles={essayTitlesByJobPost.get(job.id) ?? []}
                      submissionComplete={job.submission_status === '제출 완료'}
                      onDeleted={() => { if (form.jobPostId === job.id) setDrawerOpen(false); }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!boardJobs.length && <p className="calendar-empty">이 조건에 해당하는 공고가 없습니다.</p>}
        </div>
      )}
    </section>

    {drawerOpen && (
      <div className="drawer-backdrop" role="presentation" onClick={() => !pending && setDrawerOpen(false)}>
        <aside className="schedule-drawer" role="dialog" aria-modal="true" aria-label="지원 일정 등록" onClick={(event) => event.stopPropagation()}>
          <div className="schedule-drawer-head">
            <div>
              <h3>{form.jobPostId ? '지원 일정 편집' : '지원 일정 등록'}</h3>
              <p>{form.jobPostId ? '이 공고의 마감과 진행 상태를 함께 고칩니다.' : '회사·직무·마감일만 넣어도 저장됩니다.'}</p>
            </div>
            <button type="button" className="schedule-drawer-close" onClick={() => setDrawerOpen(false)} aria-label="닫기">×</button>
          </div>
          <label className="researched-job-select"><span>에이전트가 조사한 채용공고</span><select value={form.jobPostId} onChange={(event) => chooseJob(event.target.value)}><option value="">직접 입력</option>{researchedJobs.map((job) => <option key={job.id} value={job.id}>{job.company} · {job.role}</option>)}</select></label>
          <div className="calendar-form-grid"><label><span>회사명 *</span><input value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} /></label><label><span>지원할 직무 *</span><input value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} /></label><label className="wide"><span>채용 사이트</span><input type="url" value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} /></label><label><span>지원 마감일 *</span><input type="date" value={form.deadline} onChange={(event) => setForm({ ...form, deadline: event.target.value })} /></label><label><span>마감 시각</span><input type="time" value={form.deadlineTime} onChange={(event) => setForm({ ...form, deadlineTime: event.target.value })} /></label><label><span>전형 구분</span><select value={form.applicationType} onChange={(event) => setForm({ ...form, applicationType: event.target.value })}>{APPLICATION_TYPES.map((item) => <option key={item}>{item}</option>)}</select></label><label><span>기업 유형</span><select value={form.companyType} onChange={(event) => setForm({ ...form, companyType: event.target.value })}>{COMPANY_TYPES.map((item) => <option key={item}>{item}</option>)}</select></label><label className="wide"><span>제출 여부</span><select value={form.submissionStatus} onChange={(event) => setForm({ ...form, submissionStatus: event.target.value })}>{SUBMISSION_STATUSES.map((item) => <option key={item}>{item}</option>)}</select></label><label className="wide"><span>JD 원문</span><textarea value={form.jd} onChange={(event) => setForm({ ...form, jd: event.target.value })} /></label></div>
          <p className="calendar-message">{message}</p>
          <div className="calendar-form-actions">{form.url && <a href={form.url} target="_blank" rel="noreferrer">공고 원문</a>}<button disabled={pending} onClick={save}>{pending ? '저장 중…' : '캘린더에 저장'}</button>{form.jobPostId && <button className="primary" disabled={pending} onClick={() => startTransition(() => startEssayForJobPost(form.jobPostId))}>자소서 작성 연결</button>}</div>
          {form.jobPostId && (
            <div className="calendar-stage-editor">
              <span>전형별 합불 · 클릭해서 순환(대기→합격→불합격)</span>
              <StageToggleRow job={jobs.find((job) => job.id === form.jobPostId) ?? { stage_results: {} } as JobPost} disabled={pending} onToggle={(stage) => toggleStage(form.jobPostId, stage)} />
            </div>
          )}
        </aside>
      </div>
    )}
  </>;
}
