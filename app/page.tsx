'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { MarkdownCanvas } from './markdown-canvas';

const API = 'http://127.0.0.1:48620';

type AgentId = 'news' | 'jobs' | 'company' | 'writer' | 'review' | 'interview';
type Provider = 'codex' | 'claude';
type Health = {
  ok: boolean;
  mode: string;
  databasePath: string;
  providers: Record<Provider, { installed: boolean; version: string; auth: { safe: boolean; mode: string; detail: string } }>;
};
type Profile = { id: string; display_name: string; target_roles: string[]; interests: string[]; summary: string; updated_at?: string };
type Experience = {
  id: string;
  title: string;
  context: string;
  problem: string;
  role_scope: string;
  judgment: string;
  action: string;
  result: string;
  trial_error: string;
  reflection: string;
  metrics: string[];
  tags: string[];
  situation: string;
  task: string;
};
type Job = {
  id: string;
  company: string;
  role: string;
  url: string;
  deadline: string | null;
  status: string;
  application_type: string;
  company_type: string;
  submission_status: string;
  result_status: string;
  fit_score: number;
  description: string;
  requirements: string[];
  source: string;
};
type CalendarEvent = { id: string; job_id: string | null; title: string; company: string; role: string; event_type: string; starts_at: string; all_day: number; source_url: string; memo: string };
type Prompt = { id: string; agent_id: AgentId; name: string; body: string; variables: string[]; version: number; is_active: number };
type WritingBlueprint = { tone: string; structure: string; evidenceDensity: number; preferredTags: string[]; bannedExpressions: string[]; reviewPasses: number };
type Harness = { id: string; name: string; provider_map: Record<AgentId, Provider>; config: { maxTurns: number; timeoutMinutes: number; sandbox: string; evidenceRequired: boolean; approvalBeforeDraft: boolean; retryCount: number; onUsageLimit: string; writingBlueprint?: WritingBlueprint } };
type Essay = { id: string; job_id: string | null; title: string; question: string; draft: string; target_chars: number; status: string; updated_at: string };
type EssayVersion = { id: string; essay_id: string; version: number; content: string; chars_with_spaces: number; chars_without_spaces: number; note: string; created_at: string };
type InterviewQuestion = { id: string; job_id: string | null; category: 'experience' | 'personality' | 'company'; question: string; answer_markdown: string; source: 'manual' | 'agent' | 'starter'; order_no: number; created_at: string; updated_at: string };
type Run = { id: string; pipeline_id: string | null; agent_id: AgentId; provider: Provider; status: string; output: string; error: string; created_at: string };
type Artifact = { id: string; pipeline_id: string | null; run_id: string | null; kind: string; title: string; content: string; metadata: Record<string, unknown>; created_at: string };
type Bootstrap = { settings: Record<string, string>; profile: Profile | null; experiences: Experience[]; jobs: Job[]; calendar: CalendarEvent[]; research: unknown[]; prompts: Prompt[]; harnesses: Harness[]; essays: Essay[]; versions: EssayVersion[]; interviews: InterviewQuestion[]; runs: Run[]; artifacts: Artifact[] };

const emptyData: Bootstrap = { settings: {}, profile: null, experiences: [], jobs: [], calendar: [], research: [], prompts: [], harnesses: [], essays: [], versions: [], interviews: [], runs: [], artifacts: [] };

type ExperienceField = 'context' | 'problem' | 'role_scope' | 'judgment' | 'action' | 'result' | 'trial_error' | 'reflection';
type ExperienceForm = Record<ExperienceField, string> & { id: string; title: string; metrics: string; tags: string[] };

const EMPTY_EXPERIENCE_FORM: ExperienceForm = {
  id: '', title: '', context: '', problem: '', role_scope: '', judgment: '', action: '', result: '', trial_error: '', reflection: '', metrics: '', tags: [],
};
const EXPERIENCE_TAG_OPTIONS = ['문제해결', '협업', '주도성', '성능개선', '갈등', '실패', '도전', '데이터분석', '고객중심', '의사결정', '리더십', '커뮤니케이션'];
const APPLICATION_TYPES = ['서류접수', '시험 응시', '과제 전형', '1차 면접', '2차 면접', '최종 면접'];
const COMPANY_TYPES = ['미분류', '대기업', '중견기업', '공기업', '스타트업', '외국계'];
const SUBMISSION_STATUSES = ['미제출', '작성중', '검토중', '제출 완료'];
const RESULT_STATUSES = ['아직', '서류 합격', '최종 합격', '불합격', '보류'];
const EXPERIENCE_SECTIONS: { field: ExperienceField; number: string; label: string; guide: string }[] = [
  { field: 'context', number: '01', label: '상황 / 맥락', guide: '어떤 프로젝트였는가? 목표는 무엇이었는가? 누구에게 중요한 문제였는가?' },
  { field: 'problem', number: '02', label: '문제', guide: '실제 문제는 무엇이었고, 문제라고 판단한 근거는 무엇이었는가?' },
  { field: 'role_scope', number: '03', label: '내 역할', guide: '팀 전체가 아니라 내가 맡은 범위는 어디까지였는가?' },
  { field: 'judgment', number: '04', label: '판단', guide: '어떤 대안을 고려했고, 왜 이 방법을 선택했는가?' },
  { field: 'action', number: '05', label: '행동', guide: '내가 실제로 한 행동을 구체적으로 적어 주세요.' },
  { field: 'result', number: '06', label: '결과', guide: 'Before / After와 수치 또는 객관적 변화는 무엇인가?' },
  { field: 'trial_error', number: '07', label: '시행착오', guide: '실패한 접근과 예상과 달랐던 점은 무엇인가?' },
  { field: 'reflection', number: '08', label: '회고', guide: '다시 한다면 무엇을 바꾸며, 이후 생긴 나의 업무 기준은 무엇인가?' },
];

const assistants: { id: AgentId; name: string; role: string; color: string; status: string; x: string; y: string; delay: string }[] = [
  { id: 'news', name: '루미', role: '산업 뉴스', color: 'silver', status: '관심 분야의 오늘 뉴스를 출처와 함께 정리해요', x: '9%', y: '17%', delay: '-1s' },
  { id: 'jobs', name: '모카', role: '채용 탐색', color: 'orange', status: '내 경험과 잘 맞는 공고를 선별하고 비교해요', x: '39%', y: '12%', delay: '-4s' },
  { id: 'company', name: '솔', role: '기업 조사', color: 'cream', status: 'Claude Code로 기업과 직무 근거를 수집해요', x: '69%', y: '18%', delay: '-7s' },
  { id: 'writer', name: '뮤즈', role: '자소서 작성', color: 'white', status: '경험 카드와 조사 근거로 초안을 써요', x: '24%', y: '58%', delay: '-10s' },
  { id: 'review', name: '렌즈', role: '검수·평가', color: 'tuxedo', status: '과장 표현과 근거 누락을 교차 검수해요', x: '61%', y: '58%', delay: '-13s' },
  { id: 'interview', name: '에코', role: '면접 코치', color: 'violet', status: '기업별 예상 질문과 근거 있는 답안을 준비해요', x: '86%', y: '58%', delay: '-16s' },
];
const pipelineAssistants = assistants.filter((assistant) => assistant.id !== 'interview');

const nav = [
  { id: '사무실', icon: '⌂' },
  { id: '파이프라인', icon: '⌁' },
  { id: '채용 보드', icon: '▦' },
  { id: '캘린더', icon: '◷' },
  { id: '경험 보관함', icon: '', agent: true },
  { id: '면접 준비', icon: '◎' },
  { id: 'Prompt Lab', icon: '◇' },
  { id: '문서 보관함', icon: '□' },
  { id: '설정', icon: '⚙' },
];

async function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || '로컬 비서와 통신하지 못했습니다.');
  return value;
}

function formatDate(value?: string | null) {
  if (!value) return '마감 미정';
  return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' }).format(new Date(value));
}

function agentState(status?: string, active = false, walking = false) {
  if (['failed', 'cancelled'].includes(status || '')) return 'state-failed';
  if (status === 'waiting_for_reset') return 'state-waiting';
  if (status === 'completed') return 'state-review';
  if (active || ['queued', 'running'].includes(status || '')) return walking ? 'state-walk' : 'state-working';
  return 'state-idle';
}

function agentSpeech(agentId: AgentId, run?: Run, active = false) {
  if (run?.status === 'waiting_for_reset') return '구독 한도 초기화를 기다리는 중이에요.';
  if (run?.status === 'failed') return '오류 기록을 남겼어요. 다시 연결을 확인해 주세요.';
  if (run?.status === 'cancelled') return '임무가 중단되어 현재 위치에서 대기 중이에요.';
  if (run?.status === 'completed') return '임무 완료. 결과물을 다음 에이전트에게 전달했어요.';
  if (run?.status === 'queued') return '전달받은 자료를 확인하며 제 차례를 기다리고 있어요.';
  if (active || run?.status === 'running') {
    return {
      news: '산업 뉴스와 원문 출처를 수집하고 있어요.',
      jobs: '채용공고를 비교해 경험 적합도를 계산하고 있어요.',
      company: '위성 신호로 기업·직무 근거를 수신하고 있어요.',
      writer: '경험 카드와 조사 근거를 엮어 초안을 쓰고 있어요.',
      review: '과장 표현과 근거 누락을 문장별로 검수하고 있어요.',
      interview: 'JD와 경험 카드를 대조해 예상 질문과 답안을 만들고 있어요.',
    }[agentId];
  }
  return assistants.find((assistant) => assistant.id === agentId)?.status || '다음 임무를 기다리고 있어요.';
}

function AppHeader({ health, connected }: { health: Health | null; connected: boolean }) {
  return (
    <header className="topbar">
      <div><p className="eyebrow">ORBITAL CAREER COMMAND · DECK 04</p><h1>Career Atelier <span>AI 채용 작전선</span></h1></div>
      <div className="top-actions">
        <div className={connected ? 'subscription-lock' : 'subscription-lock offline'}><i /> {connected ? '러너 연결' : '신호 대기'} <b>{connected && health?.mode === 'subscription_only' ? 'API LOCKED' : 'LOCAL'}</b></div>
        <button className="icon-button" aria-label="알림">◔<span /></button><div className="avatar">KD</div>
      </div>
    </header>
  );
}

function FocusTimer() {
  const modes = { focus: { label: '집중 항해', minutes: 25 }, short: { label: '짧은 정비', minutes: 5 }, long: { label: '긴 정비', minutes: 15 } } as const;
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<keyof typeof modes>('focus');
  const [seconds, setSeconds] = useState(modes.focus.minutes * 60);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState(0);
  useEffect(() => {
    if (!running || seconds <= 0) return;
    const timer = window.setTimeout(() => {
      if (seconds <= 1) { setSeconds(0); setRunning(false); if (mode === 'focus') setSessions((current) => current + 1); }
      else setSeconds(seconds - 1);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [seconds, running, mode]);
  function selectMode(next: keyof typeof modes) {
    setMode(next); setSeconds(modes[next].minutes * 60); setRunning(false);
  }
  function reset() { setRunning(false); setSeconds(modes[mode].minutes * 60); }
  const total = modes[mode].minutes * 60;
  const progress = Math.max(0, Math.min(100, ((total - seconds) / total) * 100));
  const clock = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  return <><button className={running ? 'focus-launcher running' : 'focus-launcher'} onClick={() => setOpen(true)} aria-label="집중 타이머 열기"><i/><span>{running ? clock : 'FOCUS'}</span></button>{open && <div className="focus-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><section className="focus-timer-modal" role="dialog" aria-modal="true" aria-label="우주 항해 집중 타이머"><div className="focus-modal-head"><div><p className="eyebrow">ORBITAL FOCUS PROTOCOL</p><h2>집중 항해 타이머</h2></div><button onClick={() => setOpen(false)} aria-label="집중 타이머 닫기">×</button></div><div className="focus-mode-tabs">{(Object.keys(modes) as (keyof typeof modes)[]).map((key) => <button className={mode === key ? 'active' : ''} key={key} onClick={() => selectMode(key)}>{modes[key].label}<small>{modes[key].minutes}분</small></button>)}</div><div className="focus-orbit" style={{ '--focus-progress': `${progress * 3.6}deg` } as React.CSSProperties}><div className="focus-planet"><i/><span>{clock}</span><small>{mode === 'focus' ? '지원서에만 집중' : '다음 항해를 위한 정비'}</small></div></div><div className="focus-session-row"><span>오늘의 완료 궤도</span><div>{Array.from({ length: 4 }, (_, index) => <i className={index < sessions % 4 ? 'filled' : ''} key={index}/>)}</div><b>{sessions}회</b></div><div className="focus-controls"><button onClick={reset}>초기화</button><button className="primary" onClick={() => { if (seconds === 0) setSeconds(total); setRunning((current) => !current); }}>{running ? '일시정지' : seconds === 0 ? '다시 시작' : '집중 시작'}</button></div><p className="focus-tip">한 세션에는 한 작업만: JD 분석, 경험 선택, 초안 작성, 검수 중 하나를 정해 항해하세요.</p></section></div>}</>;
}

function SideRail({ active, onChange }: { active: string; onChange: (value: string) => void }) {
  return (
    <aside className="side-rail" aria-label="주요 메뉴">
      <div className="brand-mark" aria-label="Career Atelier">C<span>A</span></div>
      <nav>{nav.map((item) => <button key={item.id} className={active === item.id ? 'nav-button active' : 'nav-button'} onClick={() => onChange(item.id)} title={item.id}>{item.agent ? <span className="nav-muse-agent" aria-hidden="true"/> : <span>{item.icon}</span>}<small>{item.id}</small></button>)}</nav>
    </aside>
  );
}

function OfficeScene({ runs, running }: { runs: Run[]; running: boolean }) {
  const activeAgents = new Set(runs.filter((run) => ['queued', 'running'].includes(run.status)).map((run) => run.agent_id));
  const researchActive = activeAgents.has('company');
  return (
    <div className={running || activeAgents.size ? 'office-scene orbital-scene is-running' : 'office-scene orbital-scene'}>
      <div className="observation-window" aria-hidden="true">
        <div className="star-field star-field-a"/><div className="star-field star-field-b"/>
        <div className="distant-planet"><i/></div>
        <div className={researchActive ? 'relay-satellite is-transmitting' : 'relay-satellite'}><i/><b/><span/></div>
        <div className="signal-wave signal-wave-a"/><div className="signal-wave signal-wave-b"/><div className="signal-wave signal-wave-c"/>
      </div>
      <div className="ship-rib ship-rib-left"/><div className="ship-rib ship-rib-right"/>
      <div className="mission-plaque"><span>CA-04</span><b>APPLICATION MISSION</b><small>{researchActive ? '기업 데이터 수신 중' : '궤도 통신 대기'}</small></div>
      <div className="radar-console"><i/><b>RELAY</b><span>{researchActive ? 'LINKED' : 'STANDBY'}</span></div>
      <div className="deck-floor"/>
      {assistants.map((assistant, index) => {
        const latest = runs.find((run) => run.agent_id === assistant.id);
        const isActive = activeAgents.has(assistant.id);
        return <article className={`assistant-station station-${index + 1} ${isActive ? 'agent-active' : ''}`} key={assistant.id} style={{ left: assistant.x, top: assistant.y }}>
          <div className={isActive ? 'status-bubble live' : 'status-bubble'} role="status"><b>{assistant.name}</b><span>{agentSpeech(assistant.id, latest, isActive)}</span><small>{latest?.provider?.toUpperCase() || (assistant.id === 'company' || assistant.id === 'review' ? 'CLAUDE CODE' : 'CODEX')} · {isActive ? 'LIVE' : latest?.status?.toUpperCase() || 'STANDBY'}</small></div>
          <div className="assistant-label"><b>{assistant.name}</b><span>{assistant.role}</span></div>
          <div className="agent-provider">{assistant.id === 'company' || assistant.id === 'review' ? 'CLAUDE CODE' : 'CODEX'}</div>
          <div className="agent-walker" style={{ animationDelay: assistant.delay }}><div className={`space-agent-sprite frame-${index + 1} ${agentState(latest?.status, isActive, true)}`} aria-label={`${assistant.name} 픽셀 채용 에이전트`}/></div>
        </article>;
      })}
      {(running || activeAgents.size > 0) && <div className="document-runner"><span>JOB</span></div>}
      <div className="office-legend"><i className={running || activeAgents.size ? 'pulse' : ''}/>{running || activeAgents.size ? `${Math.max(activeAgents.size, 1)}개 에이전트 임무 수행 중` : '모든 에이전트 대기 · 작전 플로우를 시작하세요'}</div>
    </div>
  );
}

function LLMUsageDeck({ runs }: { runs: Run[] }) {
  const today = new Date().toDateString();
  const todayRuns = runs.filter((run) => new Date(run.created_at).toDateString() === today);
  const codexRuns = todayRuns.filter((run) => run.provider === 'codex').length;
  const claudeRuns = todayRuns.filter((run) => run.provider === 'claude').length;
  const total = Math.max(todayRuns.length, 1);
  const completed = todayRuns.filter((run) => run.status === 'completed').length;
  const waiting = todayRuns.some((run) => run.status === 'waiting_for_reset');
  const providers = [
    { id: 'codex', label: 'Codex · ChatGPT', detail: '구독 OAuth · 조사/탐색/작성', count: codexRuns, color: 'cyan' },
    { id: 'claude', label: 'Claude Code', detail: '구독 OAuth · 기업조사/검수', count: claudeRuns, color: 'amber' },
    { id: 'api', label: 'API Fallback', detail: '추가 과금 방지 잠금', count: 0, color: 'locked' },
  ];

  return <section className="llm-usage-deck" aria-label="LLM 사용량 대시보드">
    <div className="usage-deck-heading">
      <div><p className="eyebrow">LLM FLIGHT CONSUMPTION</p><h2>오늘의 LLM 사용량</h2></div>
      <div className="usage-summary"><span>총 실행 <b>{todayRuns.length}</b></span><span>완료 <b>{completed}</b></span><em className={waiting ? 'warning' : ''}>{waiting ? '한도 초기화 대기' : '모든 구독 정상'}</em></div>
    </div>
    <div className="provider-usage-grid">
      {providers.map((provider) => {
        const percentage = provider.id === 'api' ? 0 : Math.round((provider.count / total) * 100);
        return <article className={`provider-usage ${provider.color}`} key={provider.id}>
          <div className="provider-monogram">{provider.id === 'codex' ? 'OX' : provider.id === 'claude' ? 'CL' : '00'}</div>
          <div className="provider-usage-copy"><span>{provider.label}</span><small>{provider.detail}</small><div className="provider-meter" role="progressbar" aria-label={`${provider.label} 오늘 실행 비중`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage}><i style={{ width: `${percentage}%` }}/></div></div>
          <div className="provider-count"><b>{provider.count}</b><small>{provider.id === 'api' ? '호출 · 잠금' : `회 · ${percentage}%`}</small></div>
        </article>;
      })}
    </div>
    <p className="usage-footnote">CLI가 제공하는 구독 한도는 토큰 수로 노출되지 않아, 실제 실행 횟수와 상태를 기준으로 표시합니다.</p>
  </section>;
}

function OfficeView({ data, targetJob, running, onStart, onCancel, onOpenDocuments }: { data: Bootstrap; targetJob?: Job; running: boolean; onStart: () => void; onCancel: () => void; onOpenDocuments: () => void }) {
  const job = targetJob || data.jobs[0];
  const essay = data.essays[0];
  const count = essay?.draft.length || 0;
  const noSpace = essay?.draft.replace(/\s/g, '').length || 0;
  return <div className="dashboard-grid">
    <section className="office-card">
      <div className="section-heading"><div><p className="eyebrow">LIVE OFFICE · 사무실</p><h2>오늘의 지원 준비실</h2></div><button className={running ? 'run-button running' : 'run-button'} onClick={running ? onCancel : onStart}><span>{running ? '■' : '▶'}</span>{running ? '현재 비서 중단' : '전체 플로우 시작'}</button></div>
      <OfficeScene runs={data.runs} running={running}/>
    </section>
    <aside className="command-panel">
      <div className="panel-head"><div><p className="eyebrow">TODAY</p><h2>작업 지휘판</h2></div><span className="tiny-status">LOCAL</span></div>
      <div className="target-company"><div className="company-logo">{job?.company?.slice(0, 1) || 'J'}</div><div><small>현재 타깃</small><b>{job ? `${job.company} · ${job.role}` : '공고를 추가해 주세요'}</b><span>{job ? `${formatDate(job.deadline)} · 적합도 ${job.fit_score}` : '채용 보드에서 시작'}</span></div></div>
      <ol className="pipeline-list">{pipelineAssistants.map((assistant, index) => { const run = data.runs.find((item) => item.agent_id === assistant.id); return <li key={assistant.id} className={run?.status === 'completed' ? 'done' : ['queued', 'running'].includes(run?.status || '') ? 'active' : ''}><span>{index + 1}</span><div><b>{assistant.role}</b><small>{assistant.id === 'company' || assistant.id === 'review' ? 'Claude Code' : 'Codex'}</small></div><i>{run?.status === 'completed' ? '✓' : run?.status === 'running' ? '···' : ''}</i></li>; })}</ol>
      <div className="usage-card"><div><span>Subscription Only Lock</span><b>활성</b></div><div className="meter"><i/></div><p>API 키 미사용 · 한도 도달 시 자동 대기</p></div>
    </aside>
    <LLMUsageDeck runs={data.runs}/>
    <section className="editor-card">
      <div className="editor-meta"><div><p className="eyebrow">LATEST DRAFT</p><h2>{essay?.title || '새 자소서'}</h2></div><div className="count-pills"><span>공백 포함 <b>{count}</b></span><span>공백 제외 <b>{noSpace}</b></span><span>목표 <b>{essay?.target_chars || 700}</b></span></div></div>
      <p className="draft-preview">{essay?.draft || '문서 보관함에서 자소서를 작성해 주세요.'}</p>
      <div className="editor-footer"><span><i/> SQLite에 버전 저장됨</span><button className="primary-small" onClick={onOpenDocuments}>문서 보관함에서 열기</button></div>
    </section>
    <section className="insight-card"><p className="eyebrow">NEXT SIGNAL</p><h3>뮤즈의 제안</h3><p>성과 문장에 <b>측정 기간과 본인 기여도</b>를 더하면 근거 점수가 올라가요.</p><div className="score-ring"><span>{job?.fit_score || 82}</span><small>직무 적합도</small></div></section>
  </div>;
}

function PipelineView({ data, running, pipelineId, onStart, onCancel, onApprove }: { data: Bootstrap; running: boolean; pipelineId: string | null; onStart: () => void; onCancel: () => void; onApprove: (id: string) => Promise<void> }) {
  const currentPipeline = pipelineId || data.runs.find((run) => run.pipeline_id)?.pipeline_id;
  const pipelineRuns = currentPipeline ? data.runs.filter((run) => run.pipeline_id === currentPipeline).reverse() : [];
  const pipelineArtifacts = currentPipeline ? data.artifacts.filter((artifact) => artifact.pipeline_id === currentPipeline) : [];
  const needsApproval = pipelineArtifacts.some((artifact) => artifact.kind === 'approval_required') && !pipelineArtifacts.some((artifact) => ['approval_granted', 'pipeline_complete'].includes(artifact.kind));
  const readableArtifacts = data.artifacts.filter((artifact) => !['approval_required', 'approval_granted', 'pipeline_complete'].includes(artifact.kind));
  const [selectedArtifactId, setSelectedArtifactId] = useState('');
  const selectedArtifact = readableArtifacts.find((artifact) => artifact.id === selectedArtifactId) || readableArtifacts[0];
  return <section className="product-page">
    <div className="page-title"><div><p className="eyebrow">AGENT ORCHESTRATION</p><h2>에이전트 파이프라인</h2><p>조사 결과가 다음 우주 에이전트에게 근거 묶음으로 전달됩니다.</p></div><button className={running ? 'run-button running' : 'run-button'} onClick={running ? onCancel : onStart}><span>{running ? '■' : '▶'}</span>{running ? '현재 비서 중단' : '새 파이프라인 실행'}</button></div>
    {needsApproval && currentPipeline && <div className="approval-gate"><div><span>REVIEW GATE</span><h3>조사 비서 3명의 인계 자료가 준비됐어요</h3><p>기업·채용 근거를 확인한 뒤 뮤즈의 자소서 작성과 렌즈의 검수를 이어갑니다.</p></div><button onClick={() => onApprove(currentPipeline)}>초안 작성 승인</button></div>}
    <div className="flow-canvas">
      {pipelineAssistants.map((assistant, index) => {
        const run = pipelineRuns.find((item) => item.agent_id === assistant.id);
        return <div className="flow-segment" key={assistant.id}><article className={`agent-node ${run?.status || ''}`}><span>0{index + 1}</span><div className={`space-agent-bay ${assistant.color}`}><div className={`space-agent-sprite frame-${index + 1} ${agentState(run?.status)}`}/></div><div className="agent-identity"><h3>{assistant.name}</h3><p>{assistant.role}</p></div><small>{run ? `${run.provider} · ${run.status}` : assistant.id === 'company' || assistant.id === 'review' ? 'Claude Code' : 'Codex'}</small></article>{index < pipelineAssistants.length - 1 && <div className="flow-arrow"><i/><b>인계</b></div>}</div>;
      })}
    </div>
    <div className="pipeline-bottom"><article className="trace-card"><p className="eyebrow">LIVE TRACE</p><h3>최근 실행 기록</h3>{data.runs.slice(0, 6).map((run) => <div className="trace-row" key={run.id}><span className={`status-dot ${run.status}`}/><b>{assistants.find((item) => item.id === run.agent_id)?.name || run.agent_id}</b><small>{run.provider}</small><em>{run.status}</em></div>)}</article><article className="trace-card artifact-browser"><div className="artifact-browser-head"><div><p className="eyebrow">LOCAL HANDOFF LIBRARY</p><h3>비서들의 조사·작성 문서</h3></div><b>{readableArtifacts.length}</b></div><div className="artifact-browser-body"><div className="artifact-list">{readableArtifacts.slice(0, 8).map((artifact) => <button className={selectedArtifact?.id === artifact.id ? 'active' : ''} key={artifact.id} onClick={() => setSelectedArtifactId(artifact.id)}><span>{assistants.find((item) => item.id === artifact.kind)?.name || artifact.kind}</span><b>{artifact.title}</b><small>{new Date(artifact.created_at).toLocaleString('ko-KR')}</small></button>)}</div><div className="artifact-document"><span>{selectedArtifact?.kind || '문서 없음'} · 로컬 저장</span><h4>{selectedArtifact?.title || '아직 전달된 문서가 없습니다'}</h4><p>{selectedArtifact?.content || '파이프라인을 실행하면 뉴스, 채용공고, 기업 조사, 초안, 검수 결과가 이곳에 차례로 쌓입니다.'}</p></div></div></article></div>
  </section>;
}

function JobsView({ data, selectedId, onSelect, onRefresh, onResearch, onCreateEssay }: { data: Bootstrap; selectedId: string; onSelect: (id: string) => void; onRefresh: () => Promise<void>; onResearch: (job: Job) => Promise<void>; onCreateEssay: (job: Job) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const selectedJob = data.jobs.find((job) => job.id === selectedId) || data.jobs[0];
  const [form, setForm] = useState({ company: '', role: '', url: '', deadline: '', description: '', requirements: '', application_type: '서류접수', company_type: '미분류', submission_status: '미제출', result_status: '아직' });
  async function save() {
    await requestJson('/api/jobs/save', { method: 'POST', body: JSON.stringify({ ...form, requirements: form.requirements.split(',').map((item) => item.trim()).filter(Boolean), status: 'saved', source: '수동 입력' }) });
    setEditing(false); await onRefresh();
  }
  async function updateProgress(field: 'application_type' | 'company_type' | 'submission_status' | 'result_status', value: string) {
    if (!selectedJob) return;
    await requestJson('/api/jobs/save', { method: 'POST', body: JSON.stringify({ ...selectedJob, [field]: value }) });
    await onRefresh();
  }
  return <section className="product-page"><div className="page-title"><div><p className="eyebrow">ROLE INTELLIGENCE</p><h2>맞춤 채용 보드</h2><p>내 경험과 요구 역량을 비교하고 조사·자소서 작업으로 넘깁니다.</p></div><button className="secondary-button" onClick={() => setEditing(!editing)}>+ 공고 추가</button></div>
    {editing && <div className="inline-form job-create-form"><input placeholder="회사" value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })}/><input placeholder="직무" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}/><input placeholder="공고 URL" value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })}/><input type="date" value={form.deadline} onChange={(event) => setForm({ ...form, deadline: event.target.value })}/><input className="wide" placeholder="공고 요약" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })}/><input className="wide" placeholder="요구 역량 — 쉼표로 구분" value={form.requirements} onChange={(event) => setForm({ ...form, requirements: event.target.value })}/><div className="job-form-progress"><select value={form.application_type} onChange={(event) => setForm({ ...form, application_type: event.target.value })}>{APPLICATION_TYPES.map((item) => <option key={item}>{item}</option>)}</select><select value={form.company_type} onChange={(event) => setForm({ ...form, company_type: event.target.value })}>{COMPANY_TYPES.map((item) => <option key={item}>{item}</option>)}</select><select value={form.submission_status} onChange={(event) => setForm({ ...form, submission_status: event.target.value })}>{SUBMISSION_STATUSES.map((item) => <option key={item}>{item}</option>)}</select><select value={form.result_status} onChange={(event) => setForm({ ...form, result_status: event.target.value })}>{RESULT_STATUSES.map((item) => <option key={item}>{item}</option>)}</select></div><button onClick={save}>로컬 저장</button></div>}
    <div className="jobs-layout"><div className="job-list">{data.jobs.map((job) => { const resultStatus = job.result_status || '아직'; return <button className={selectedJob?.id === job.id ? 'job-card selected' : 'job-card'} key={job.id} onClick={() => onSelect(job.id)}><div className="job-company-logo">{job.company.slice(0, 1)}</div><div><small>{job.company}</small><h3>{job.role}</h3><p>{job.requirements.slice(0, 3).join(' · ')}</p><div className="job-card-status"><span data-tone="submission">{job.submission_status || '미제출'}</span><span data-tone={resultStatus.includes('합격') ? 'pass' : resultStatus === '불합격' ? 'fail' : 'waiting'}>{resultStatus}</span></div></div><div className="fit-score"><b>{job.fit_score}</b><span>FIT</span></div></button>; })}</div>
      <article className="job-detail">{selectedJob ? <><div className="detail-head"><div><p className="eyebrow">SELECTED ROLE</p><h2>{selectedJob.company}</h2><h3>{selectedJob.role}</h3></div><div className="deadline-pill">{formatDate(selectedJob.deadline)}</div></div><div className="job-progress-controls"><label><span>전형 구분</span><select value={selectedJob.application_type} onChange={(event) => updateProgress('application_type', event.target.value)}>{APPLICATION_TYPES.map((item) => <option key={item}>{item}</option>)}</select></label><label><span>기업 유형</span><select value={selectedJob.company_type} onChange={(event) => updateProgress('company_type', event.target.value)}>{COMPANY_TYPES.map((item) => <option key={item}>{item}</option>)}</select></label><label><span>제출 여부</span><select value={selectedJob.submission_status} onChange={(event) => updateProgress('submission_status', event.target.value)}>{SUBMISSION_STATUSES.map((item) => <option key={item}>{item}</option>)}</select></label><label><span>합불 여부</span><select value={selectedJob.result_status} onChange={(event) => updateProgress('result_status', event.target.value)}>{RESULT_STATUSES.map((item) => <option key={item}>{item}</option>)}</select></label></div><p className="job-description">{selectedJob.description || '공고 설명을 추가하면 비서가 더 정확하게 분석합니다.'}</p><h4>핵심 요구 역량</h4><div className="tag-cloud">{selectedJob.requirements.map((item) => <span key={item}>{item}</span>)}</div><div className="match-panel"><span>내 경험 매칭</span><b>{selectedJob.fit_score}%</b><div><i style={{ width: `${selectedJob.fit_score}%` }}/></div></div><div className="detail-actions">{/^https?:\/\//i.test(selectedJob.url) && <a href={selectedJob.url} target="_blank" rel="noreferrer">공고 원문 열기</a>}<button onClick={() => onResearch(selectedJob)}>기업 조사 요청</button><button className="primary-small" onClick={() => onCreateEssay(selectedJob)}>자소서 프로젝트 만들기</button></div></> : <p>공고를 추가해 주세요.</p>}</article></div>
  </section>;
}

function calendarDateKey(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function jobProgressTone(job?: Job) {
  if (!job) return 'waiting';
  if ((job.result_status || '아직').includes('합격')) return 'pass';
  if (job.result_status === '불합격') return 'fail';
  if (job.submission_status === '제출 완료') return 'submitted';
  if (['작성중', '검토중'].includes(job.submission_status)) return 'working';
  return 'waiting';
}

function ApplicationStatusBoard({ jobs, onRefresh }: { jobs: Job[]; onRefresh: () => Promise<void> }) {
  const [savingId, setSavingId] = useState('');
  async function update(job: Job, field: 'application_type' | 'company_type' | 'submission_status' | 'result_status', value: string) {
    setSavingId(job.id);
    try {
      await requestJson('/api/jobs/save', { method: 'POST', body: JSON.stringify({ ...job, [field]: value }) });
      await onRefresh();
    } finally { setSavingId(''); }
  }
  const rows = [...jobs].sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'));
  return <section className="application-status-board"><div className="application-status-head"><div><p className="eyebrow">APPLICATION STATUS MATRIX</p><h3>채용공고별 진행상황</h3><span>노션형 목록으로 전형·제출·결과를 한눈에 관리합니다.</span></div><b>{rows.length}</b></div><div className="application-status-scroll"><table><thead><tr><th>구분</th><th>채용공고</th><th>일정</th><th>링크</th><th>기업 유형</th><th>제출 여부</th><th>합불 여부</th></tr></thead><tbody>{rows.map((job) => <tr key={job.id} className={savingId === job.id ? 'saving' : ''}><td><select value={job.application_type} onChange={(event) => update(job, 'application_type', event.target.value)}>{APPLICATION_TYPES.map((item) => <option key={item}>{item}</option>)}</select></td><td><b>{job.company}</b><span>{job.role}</span></td><td><time>{job.deadline ? new Date(`${job.deadline}T00:00:00`).toLocaleDateString('ko-KR') : '미정'}</time></td><td>{/^https?:\/\//i.test(job.url) ? <a href={job.url} target="_blank" rel="noreferrer">공고 원문 ↗</a> : <small>링크 없음</small>}</td><td><select value={job.company_type} onChange={(event) => update(job, 'company_type', event.target.value)}>{COMPANY_TYPES.map((item) => <option key={item}>{item}</option>)}</select></td><td><select className={`status-select ${jobProgressTone({ ...job, result_status: '아직' })}`} value={job.submission_status} onChange={(event) => update(job, 'submission_status', event.target.value)}>{SUBMISSION_STATUSES.map((item) => <option key={item}>{item}</option>)}</select></td><td><select className={`status-select ${jobProgressTone(job)}`} value={job.result_status} onChange={(event) => update(job, 'result_status', event.target.value)}>{RESULT_STATUSES.map((item) => <option key={item}>{item}</option>)}</select></td></tr>)}</tbody></table></div></section>;
}

function CalendarView({ data, onRefresh, onCreateEssay }: { data: Bootstrap; onRefresh: () => Promise<void>; onCreateEssay: (job: Job) => Promise<void> }) {
  const today = new Date();
  const [monthCursor, setMonthCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [form, setForm] = useState({ jobId: '', company: '', url: '', role: '', jd: '', deadline: '', application_type: '서류접수', company_type: '미분류', submission_status: '미제출', result_status: '아직' });
  const [message, setMessage] = useState('회사와 직무를 직접 입력하거나 모카가 조사한 공고를 선택하세요.');
  const storedEvents = data.calendar || [];
  const calendarEvents: CalendarEvent[] = [
    ...storedEvents,
    ...data.jobs.filter((job) => job.deadline && !storedEvents.some((event) => event.job_id === job.id)).map((job) => ({
      id: `job-${job.id}`, job_id: job.id, title: `${job.company} · ${job.role} 지원 마감`, company: job.company, role: job.role,
      event_type: 'deadline', starts_at: `${job.deadline}T12:00:00.000Z`, all_day: 1, source_url: job.url, memo: job.description,
    })),
  ];
  const researchedJobs = data.jobs.filter((job) => job.source !== '캘린더 직접 입력');
  const monthStart = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(1 - monthStart.getDay());
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
  const upcoming = calendarEvents.filter((event) => new Date(event.starts_at).getTime() >= new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()).sort((a, b) => a.starts_at.localeCompare(b.starts_at)).slice(0, 8);

  function selectJob(jobId: string) {
    const job = data.jobs.find((item) => item.id === jobId);
    if (!job) {
      setForm({ jobId: '', company: '', url: '', role: '', jd: '', deadline: '', application_type: '서류접수', company_type: '미분류', submission_status: '미제출', result_status: '아직' });
      setMessage('직접 입력 모드입니다.');
      return;
    }
    setForm({ jobId: job.id, company: job.company, url: job.url, role: job.role, jd: job.description, deadline: job.deadline || '', application_type: job.application_type, company_type: job.company_type, submission_status: job.submission_status, result_status: job.result_status });
    setMessage(`${job.company} 공고를 불러왔습니다. 필요한 내용을 수정한 뒤 일정에 넣으세요.`);
  }

  function selectEvent(event: CalendarEvent) {
    const job = event.job_id ? data.jobs.find((item) => item.id === event.job_id) : undefined;
    setForm({
      jobId: job?.id || '',
      company: job?.company || event.company,
      url: job?.url || event.source_url,
      role: job?.role || event.role,
      jd: job?.description || event.memo,
      deadline: calendarDateKey(event.starts_at),
      application_type: job?.application_type || '서류접수',
      company_type: job?.company_type || '미분류',
      submission_status: job?.submission_status || '미제출',
      result_status: job?.result_status || '아직',
    });
    setMessage(`${event.title} 일정을 편집할 수 있도록 불러왔습니다.`);
  }

  async function saveSchedule() {
    if (!form.company.trim() || !form.role.trim() || !form.deadline) {
      setMessage('회사명, 지원 직무, 마감일을 입력해 주세요.');
      return;
    }
    setMessage('채용공고와 일정을 저장하는 중…');
    const existing = data.jobs.find((job) => job.id === form.jobId);
    const job = await requestJson<Job>('/api/jobs/save', {
      method: 'POST',
      body: JSON.stringify({
        id: existing?.id,
        company: form.company.trim(), role: form.role.trim(), url: form.url.trim(), deadline: form.deadline,
        status: 'saved', application_type: form.application_type, company_type: form.company_type, submission_status: form.submission_status, result_status: form.result_status,
        fit_score: existing?.fit_score || 0, description: form.jd.trim(), requirements: existing?.requirements || [],
        source: existing?.source || '캘린더 직접 입력',
      }),
    });
    await requestJson('/api/calendar/save', {
      method: 'POST',
      body: JSON.stringify({
        job_id: job.id, title: `${job.company} · ${job.role} 지원 마감`, company: job.company, role: job.role,
        starts_at: `${form.deadline}T12:00:00.000Z`, source_url: job.url, memo: job.description, event_type: 'deadline', all_day: true,
      }),
    });
    setForm((current) => ({ ...current, jobId: job.id }));
    await onRefresh();
    setMessage('캘린더에 저장했습니다. 이 공고로 바로 자소서를 만들 수 있습니다.');
  }

  return <section className="product-page calendar-page">
    <div className="page-title"><div><p className="eyebrow">APPLICATION FLIGHT PLAN</p><h2>채용 캘린더</h2><p>마감일·공고 원문·JD를 한 일정으로 묶고 뮤즈의 자소서 작성으로 바로 연결합니다.</p></div><button className="secondary-button" onClick={() => selectJob('')}>+ 직접 일정 입력</button></div>
    <div className="calendar-workspace">
      <article className="calendar-board">
        <div className="calendar-head"><div><span>MISSION MONTH</span><h3>{monthCursor.getFullYear()}년 {monthCursor.getMonth() + 1}월</h3></div><div><button onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))} aria-label="이전 달">‹</button><button onClick={() => setMonthCursor(new Date(today.getFullYear(), today.getMonth(), 1))}>오늘</button><button onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))} aria-label="다음 달">›</button></div></div>
        <div className="calendar-weekdays">{['일','월','화','수','목','금','토'].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="calendar-grid">{days.map((date) => {
          const key = calendarDateKey(date);
          const events = calendarEvents.filter((event) => calendarDateKey(event.starts_at) === key);
          const outside = date.getMonth() !== monthCursor.getMonth();
          const isToday = key === calendarDateKey(today);
          return <div className={`calendar-day ${outside ? 'outside' : ''} ${isToday ? 'today' : ''}`} key={key}><b>{date.getDate()}</b><div>{events.slice(0, 2).map((event) => { const job = event.job_id ? data.jobs.find((item) => item.id === event.job_id) : undefined; return <button className={`calendar-progress-chip ${jobProgressTone(job)}`} key={event.id} onClick={() => selectEvent(event)} title={`${event.title} · ${job?.submission_status || '일정'}`}><i/>{event.company || event.title}</button>; })}{events.length > 2 && <small>+{events.length - 2}개 일정</small>}</div></div>;
        })}</div>
      </article>
      <aside className="calendar-editor">
        <div><p className="eyebrow">JOB → CALENDAR</p><h3>지원 일정 등록</h3></div>
        <label className="researched-job-select"><span>에이전트가 조사한 채용공고</span><select value={form.jobId} onChange={(event) => selectJob(event.target.value)}><option value="">직접 입력</option>{researchedJobs.map((job) => <option key={job.id} value={job.id}>{job.company} · {job.role}</option>)}</select></label>
        <div className="calendar-form-grid"><label><span>회사명 *</span><input value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} placeholder="회사명"/></label><label><span>지원할 직무 *</span><input value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} placeholder="지원 직무"/></label><label className="wide"><span>채용 사이트</span><input type="url" value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} placeholder="https://careers.example.com/..."/></label><label><span>지원 마감일 *</span><input type="date" value={form.deadline} onChange={(event) => setForm({ ...form, deadline: event.target.value })}/></label><label><span>전형 구분</span><select value={form.application_type} onChange={(event) => setForm({ ...form, application_type: event.target.value })}>{APPLICATION_TYPES.map((item) => <option key={item}>{item}</option>)}</select></label><label><span>기업 유형</span><select value={form.company_type} onChange={(event) => setForm({ ...form, company_type: event.target.value })}>{COMPANY_TYPES.map((item) => <option key={item}>{item}</option>)}</select></label><label><span>제출 여부</span><select value={form.submission_status} onChange={(event) => setForm({ ...form, submission_status: event.target.value })}>{SUBMISSION_STATUSES.map((item) => <option key={item}>{item}</option>)}</select></label><label><span>합불 여부</span><select value={form.result_status} onChange={(event) => setForm({ ...form, result_status: event.target.value })}>{RESULT_STATUSES.map((item) => <option key={item}>{item}</option>)}</select></label><label className="wide"><span>JD 원문</span><textarea value={form.jd} onChange={(event) => setForm({ ...form, jd: event.target.value })} placeholder="채용공고의 주요업무·자격요건·우대사항을 그대로 붙여 넣으세요."/></label></div>
        <p className="calendar-message">{message}</p>
        <div className="calendar-form-actions">{/^https?:\/\//i.test(form.url) && <a href={form.url} target="_blank" rel="noreferrer">공고 원문</a>}<button onClick={saveSchedule}>캘린더에 저장</button>{form.jobId && <button className="primary" onClick={() => { const job = data.jobs.find((item) => item.id === form.jobId); if (job) onCreateEssay(job); }}>자소서 작성 연결</button>}</div>
      </aside>
    </div>
    <ApplicationStatusBoard jobs={data.jobs} onRefresh={onRefresh}/>
    <section className="calendar-upcoming"><div className="calendar-upcoming-head"><div><p className="eyebrow">NEXT DEADLINES</p><h3>다가오는 지원 일정</h3></div><b>{upcoming.length}</b></div>{upcoming.length ? upcoming.map((event) => { const job = event.job_id ? data.jobs.find((item) => item.id === event.job_id) : undefined; const daysLeft = Math.ceil((new Date(event.starts_at).getTime() - today.getTime()) / 86_400_000); return <article key={event.id}><time><b>{Math.max(daysLeft, 0)}</b><span>{daysLeft <= 0 ? 'D-DAY' : 'DAYS'}</span></time><div><small>{new Date(event.starts_at).toLocaleDateString('ko-KR')}</small><h4>{event.company} · {event.role}</h4><div className="upcoming-progress">{job && <><span className={jobProgressTone({ ...job, result_status: '아직' })}>{job.submission_status}</span><span className={jobProgressTone(job)}>{job.result_status}</span></>}</div><p>{job?.description || event.memo || 'JD가 아직 입력되지 않았습니다.'}</p></div><div>{/^https?:\/\//i.test(event.source_url) && <a href={event.source_url} target="_blank" rel="noreferrer">채용 사이트</a>}<button onClick={() => selectEvent(event)}>일정 편집</button>{job && <button className="primary" onClick={() => onCreateEssay(job)}>자소서 작성</button>}</div></article>; }) : <p className="calendar-empty">등록된 지원 일정이 없습니다.</p>}</section>
  </section>;
}

function PromptLabView({ data, onRefresh }: { data: Bootstrap; onRefresh: () => Promise<void> }) {
  const [agent, setAgent] = useState<AgentId>('writer');
  const activePrompt = data.prompts.find((item) => item.agent_id === agent);
  const [body, setBody] = useState(activePrompt?.body || '');
  const harness = data.harnesses[0];
  const [providerMap, setProviderMap] = useState<Record<AgentId, Provider>>(harness?.provider_map || { news: 'codex', jobs: 'codex', company: 'claude', writer: 'codex', review: 'claude' });
  const [maxTurns, setMaxTurns] = useState(harness?.config.maxTurns || 6);
  const [timeoutMinutes, setTimeoutMinutes] = useState(harness?.config.timeoutMinutes || 12);
  const [evidenceRequired, setEvidenceRequired] = useState(harness?.config.evidenceRequired ?? true);
  const [approvalBeforeDraft, setApprovalBeforeDraft] = useState(harness?.config.approvalBeforeDraft ?? true);
  const [tone, setTone] = useState(harness?.config.writingBlueprint?.tone || '담백한 실무형');
  const [structure, setStructure] = useState(harness?.config.writingBlueprint?.structure || '결론 → 문제 → 판단 → 행동 → 변화 → 직무 연결');
  const [evidenceDensity, setEvidenceDensity] = useState(harness?.config.writingBlueprint?.evidenceDensity || 3);
  const [preferredTags, setPreferredTags] = useState(harness?.config.writingBlueprint?.preferredTags.join(', ') || '문제해결, 주도성');
  const [bannedExpressions, setBannedExpressions] = useState(harness?.config.writingBlueprint?.bannedExpressions.join(', ') || '열정적인, 최선을 다해, 귀사');
  const [reviewPasses, setReviewPasses] = useState(harness?.config.writingBlueprint?.reviewPasses || 2);
  const [saved, setSaved] = useState('');
  function selectAgent(nextAgent: AgentId) { setAgent(nextAgent); setBody(data.prompts.find((item) => item.agent_id === nextAgent)?.body || ''); setSaved(''); }
  async function savePrompt() {
    if (!activePrompt) return;
    await requestJson('/api/prompts/save', { method: 'POST', body: JSON.stringify({ ...activePrompt, body }) }); setSaved('프롬프트 새 버전을 저장했습니다.'); await onRefresh();
  }
  async function saveHarnessConfig() {
    if (!harness) return;
    const writingBlueprint: WritingBlueprint = {
      tone, structure, evidenceDensity, reviewPasses,
      preferredTags: preferredTags.split(/[\n,]/).map((item) => item.trim()).filter(Boolean),
      bannedExpressions: bannedExpressions.split(/[\n,]/).map((item) => item.trim()).filter(Boolean),
    };
    await requestJson('/api/harnesses/save', { method: 'POST', body: JSON.stringify({ ...harness, provider_map: providerMap, config: { ...harness.config, maxTurns, timeoutMinutes, evidenceRequired, approvalBeforeDraft, writingBlueprint } }) }); setSaved('하네스와 자소서 블루프린트를 저장했습니다.'); await onRefresh();
  }
  return <section className="product-page"><div className="page-title"><div><p className="eyebrow">PROMPT & HARNESS ENGINEERING</p><h2>나만의 자소서 엔지니어링</h2><p>프롬프트만이 아니라 모델·도구·중단 조건·인계 규격까지 함께 설계합니다.</p></div><div className="lab-save-status">{saved}</div></div>
    <div className="lab-grid"><article className="prompt-editor-panel"><div className="agent-tabs">{assistants.map((item) => <button key={item.id} className={agent === item.id ? 'active' : ''} onClick={() => selectAgent(item.id)}>{item.name}<small>{item.role}</small></button>)}</div><div className="prompt-toolbar"><div><span>SYSTEM PROMPT</span><b>v{activePrompt?.version || 1}</b></div><button onClick={savePrompt}>새 버전 저장</button></div><input className="prompt-name" value={activePrompt?.name || ''} readOnly/><textarea className="prompt-body" value={body} onChange={(event) => setBody(event.target.value)} spellCheck={false}/><div className="variable-row"><small>사용 변수</small>{activePrompt?.variables.map((variable) => <span key={variable}>{`{{${variable}}}`}</span>)}</div></article>
      <aside className="harness-panel"><p className="eyebrow">HARNESS CONTROL</p><h3>실행 규칙</h3><div className="lock-banner"><i/>SUBSCRIPTION ONLY<b>API 키 차단</b></div><div className="control-group"><label>에이전트별 실행기</label>{assistants.map((item) => <div className="provider-row" key={item.id}><span>{item.name} · {item.role}</span><select value={providerMap[item.id]} onChange={(event) => setProviderMap({ ...providerMap, [item.id]: event.target.value as Provider })}><option value="codex">Codex</option><option value="claude">Claude Code</option></select></div>)}</div><div className="control-group"><label>최대 에이전트 턴 <b>{maxTurns}</b></label><input type="range" min="1" max="12" value={maxTurns} onChange={(event) => setMaxTurns(Number(event.target.value))}/></div><div className="control-group"><label>단계 제한 시간 <b>{timeoutMinutes}분</b></label><input type="range" min="3" max="30" value={timeoutMinutes} onChange={(event) => setTimeoutMinutes(Number(event.target.value))}/></div><div className="rule-list"><button onClick={() => setEvidenceRequired(!evidenceRequired)}><i className={evidenceRequired ? 'on' : ''}/><span>출처 근거 필수</span><b>{evidenceRequired ? 'ON' : 'OFF'}</b></button><button onClick={() => setApprovalBeforeDraft(!approvalBeforeDraft)}><i className={approvalBeforeDraft ? 'on' : ''}/><span>초안 전 사용자 승인</span><b>{approvalBeforeDraft ? 'ON' : 'OFF'}</b></button><div><i className="on"/><span>한도 도달 시 대기</span><b>고정</b></div><div><i/><span>유료 초과 사용</span><b>차단</b></div></div><button className="save-harness" onClick={saveHarnessConfig}>하네스 저장</button></aside>
    </div><section className="writing-blueprint-panel"><div className="blueprint-heading"><div><p className="eyebrow">WRITING DNA · PROMPT INDEPENDENT</p><h3>나만의 자소서 블루프린트</h3><p>문장 지시문이 아니라 경험 선택·글 구조·근거 밀도·검수 횟수를 고정해 결과를 일관되게 만듭니다.</p></div><button onClick={saveHarnessConfig}>블루프린트 저장</button></div><div className="blueprint-method"><article><b>01</b><span>문항 분해</span><p>평가 역량과 답해야 할 질문을 먼저 분리</p></article><article><b>02</b><span>태그 매칭</span><p>활용 태그로 가장 적합한 경험만 선택</p></article><article><b>03</b><span>근거 잠금</span><p>수치·역할·판단이 있는 문장만 초안에 사용</p></article><article><b>04</b><span>다중 검수</span><p>사실성·직무 적합성·문체를 차례로 검수</p></article></div><div className="blueprint-controls"><label><span>문체 DNA</span><select value={tone} onChange={(event) => setTone(event.target.value)}><option>담백한 실무형</option><option>논리적인 전략형</option><option>생동감 있는 서사형</option><option>간결한 기술형</option></select></label><label><span>기본 전개 구조</span><select value={structure} onChange={(event) => setStructure(event.target.value)}><option>결론 → 문제 → 판단 → 행동 → 변화 → 직무 연결</option><option>문제 → 시행착오 → 전환점 → 성과 → 회고</option><option>역할 → 의사결정 → 실행 → 수치 → 배운 기준</option></select></label><label><span>문단당 근거 밀도 <b>{evidenceDensity}</b></span><input type="range" min="1" max="5" value={evidenceDensity} onChange={(event) => setEvidenceDensity(Number(event.target.value))}/><small>역할·행동·수치·판단 근거를 얼마나 촘촘히 넣을지 정합니다.</small></label><label><span>검수 패스 <b>{reviewPasses}</b></span><input type="range" min="1" max="4" value={reviewPasses} onChange={(event) => setReviewPasses(Number(event.target.value))}/><small>사실성 → 직무 적합성 → 문체 순서로 반복 검수합니다.</small></label><label><span>우선 활용 태그</span><textarea value={preferredTags} onChange={(event) => setPreferredTags(event.target.value)} placeholder="문제해결, 협업, 주도성"/></label><label><span>금지 표현</span><textarea value={bannedExpressions} onChange={(event) => setBannedExpressions(event.target.value)} placeholder="열정적인, 최선을 다해, 귀사"/></label></div><div className="blueprint-note"><b>정교해지는 이유</b><span>같은 프롬프트를 반복 수정하는 대신 ‘어떤 경험을 고르고, 어떤 증거만 허용하며, 어떤 순서로 검수할지’를 실행 규칙으로 고정합니다.</span></div></section>
  </section>;
}

function DocumentsView({ data, onRefresh, onReview }: { data: Bootstrap; onRefresh: () => Promise<void>; onReview: (draft: string, essay?: Essay) => Promise<void> }) {
  const [selectedEssayId, setSelectedEssayId] = useState(data.essays[0]?.id || '');
  const essay = data.essays.find((item) => item.id === selectedEssayId) || data.essays[0];
  const [draft, setDraft] = useState(essay?.draft || '');
  const [note, setNote] = useState('수동 편집');
  const [status, setStatus] = useState('로컬 버전을 불러왔습니다.');
  const counts = useMemo(() => ({ withSpace: draft.length, withoutSpace: draft.replace(/\s/g, '').length }), [draft]);
  const versions = data.versions.filter((version) => version.essay_id === essay?.id);
  const latestReview = data.artifacts.find((artifact) => artifact.kind === 'review' && (!artifact.metadata.essayId || artifact.metadata.essayId === essay?.id));
  async function save() {
    if (!essay) return;
    setStatus('저장 중…');
    await requestJson('/api/essays/save', { method: 'POST', body: JSON.stringify({ ...essay, draft, note }) });
    await onRefresh(); setStatus('SQLite에 새 버전을 저장했습니다.');
  }
  function loadVersion(version: EssayVersion) { setDraft(version.content); setNote(`v${version.version}에서 복원`); setStatus(`v${version.version}을 편집기에 불러왔습니다.`); }
  function selectEssay(id: string) { const next = data.essays.find((item) => item.id === id); setSelectedEssayId(id); setDraft(next?.draft || ''); setNote('수동 편집'); setStatus('선택한 프로젝트의 최신 버전을 불러왔습니다.'); }
  async function requestReview() { setStatus('렌즈가 AI 검수를 시작했습니다…'); await onReview(draft, essay); }
  async function handoffToJasoseol() {
    const tab = window.open('https://jasoseol.com', '_blank', 'noopener,noreferrer');
    try { await navigator.clipboard.writeText(draft); setStatus('본문을 복사했습니다. 열린 자소설닷컴 편집기에 붙여 넣어 최종 저장하세요.'); }
    catch { setStatus('클립보드 권한이 없어 복사하지 못했습니다. 본문을 직접 선택해 주세요.'); }
    if (!tab) setStatus('팝업이 차단됐습니다. 자소설닷컴을 직접 열고 본문을 붙여 넣어 주세요.');
  }
  return <section className="product-page document-page"><div className="page-title"><div><p className="eyebrow">LOCAL DOCUMENT STUDIO</p><h2>자소서 편집·버전 관리</h2><p>원문은 언제든 직접 수정할 수 있고, 저장할 때마다 글자 수와 함께 새 버전이 남습니다.</p></div><button className="secondary-button" onClick={save}>새 버전 저장</button></div>
    <div className="document-layout"><aside className="version-rail"><label className="project-switcher"><span>ESSAY PROJECT</span><select value={essay?.id || ''} onChange={(event) => selectEssay(event.target.value)}>{data.essays.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><div className="version-head"><span>VERSION HISTORY</span><b>{versions.length}</b></div>{versions.map((version) => <button key={version.id} onClick={() => loadVersion(version)}><i/><div><b>v{version.version}</b><span>{version.note}</span><small>{new Date(version.created_at).toLocaleString('ko-KR')}</small></div></button>)}</aside>
      <article className="writing-studio"><div className="question-box"><small>문항</small><p>{essay?.question || '자소서 프로젝트를 만들어 주세요.'}</p></div><div className="writing-toolbar"><div><b>{essay?.title || '새 자소서'}</b><span>{status}</span></div><div className="count-pills large"><span>공백 포함 <b>{counts.withSpace}</b></span><span>공백 제외 <b>{counts.withoutSpace}</b></span><span>목표 <b>{essay?.target_chars || 700}</b></span></div></div><textarea className="writing-area" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="이곳에서 계속 수정할 수 있습니다."/><div className="writing-footer"><input value={note} onChange={(event) => setNote(event.target.value)} aria-label="버전 메모"/><div><button onClick={handoffToJasoseol}>자소설닷컴으로 복사</button><button onClick={requestReview}>AI 검수 요청</button><button className="primary-small" onClick={save}>저장</button></div></div></article>
      <aside className="review-rail"><p className="eyebrow">QUALITY CHECK</p><h3>{latestReview ? '최근 AI 검수' : '검수 기준'}</h3>{['직무 적합성','구체성','근거성','기업 이해도','문장 자연스러움'].map((label) => <div className={latestReview ? 'quality-row reviewed' : 'quality-row pending'} key={label}><span>{label}</span><b>{latestReview ? '검토' : '대기'}</b><div><i/></div></div>)}<div className="review-note"><b>렌즈의 메모</b><p>{latestReview?.content?.slice(0, 900) || 'AI 검수를 요청하면 실제 검토 결과가 이곳에 저장됩니다.'}</p></div></aside>
    </div>
  </section>;
}

function experienceContext(item: Experience) {
  return [
    `[경험] ${item.title}`,
    `[1. 상황/맥락] ${item.context || item.situation}`,
    `[2. 문제] ${item.problem || item.task}`,
    `[3. 내 역할] ${item.role_scope}`,
    `[4. 판단] ${item.judgment}`,
    `[5. 행동] ${item.action}`,
    `[6. 결과] ${item.result}`,
    `[결과 수치] ${item.metrics.join(', ')}`,
    `[7. 시행착오] ${item.trial_error}`,
    `[8. 회고] ${item.reflection}`,
    `[9. 활용 태그] ${item.tags.join(', ')}`,
  ].join('\n');
}

function ExperienceVaultView({ data, onRefresh }: { data: Bootstrap; onRefresh: () => Promise<void> }) {
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('전체');
  const [selectedId, setSelectedId] = useState(data.experiences[0]?.id || '');
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('자소서에 쓸 수 있는 근거 단위로 경험을 정리합니다.');
  const [form, setForm] = useState<ExperienceForm>(EMPTY_EXPERIENCE_FORM);
  const [customTag, setCustomTag] = useState('');
  const allTags = useMemo(() => Array.from(new Set(data.experiences.flatMap((item) => item.tags))).sort(), [data.experiences]);
  const tagPickerOptions = useMemo(() => Array.from(new Set([...EXPERIENCE_TAG_OPTIONS, ...allTags])), [allTags]);
  const filtered = useMemo(() => data.experiences.filter((item) => {
    const matchesTag = tag === '전체' || item.tags.includes(tag);
    const haystack = `${item.title} ${item.context || item.situation} ${item.problem || item.task} ${item.role_scope} ${item.judgment} ${item.action} ${item.result} ${item.trial_error} ${item.reflection} ${item.tags.join(' ')}`.toLowerCase();
    return matchesTag && haystack.includes(query.trim().toLowerCase());
  }), [data.experiences, query, tag]);
  const selected = filtered.find((item) => item.id === selectedId) || filtered[0];
  const completeness = selected ? Math.round(([
    selected.context || selected.situation,
    selected.problem || selected.task,
    selected.role_scope,
    selected.judgment,
    selected.action,
    selected.result,
    selected.trial_error,
    selected.reflection,
    selected.tags.length,
  ].filter(Boolean).length / 9) * 100) : 0;

  function editExperience(item?: Experience) {
    setForm(item ? {
      id: item.id,
      title: item.title,
      context: item.context || item.situation || '',
      problem: item.problem || item.task || '',
      role_scope: item.role_scope || '',
      judgment: item.judgment || '',
      action: item.action || '',
      result: item.result || '',
      trial_error: item.trial_error || '',
      reflection: item.reflection || '',
      metrics: item.metrics.join(', '),
      tags: item.tags,
    } : { ...EMPTY_EXPERIENCE_FORM, tags: [] });
    setCustomTag('');
    setEditing(true);
    setMessage(item ? '선택한 경험 카드를 편집하고 있습니다.' : '상황부터 회고까지 9단계로 경험을 정리해 주세요.');
  }
  function toggleTag(value: string) {
    setForm((current) => ({
      ...current,
      tags: current.tags.includes(value) ? current.tags.filter((item) => item !== value) : [...current.tags, value],
    }));
  }
  function addCustomTag() {
    const value = customTag.trim();
    if (!value) return;
    if (!form.tags.includes(value)) setForm((current) => ({ ...current, tags: [...current.tags, value] }));
    setCustomTag('');
  }
  async function saveExperienceCard() {
    const saved = await requestJson<Experience>('/api/experiences/save', { method: 'POST', body: JSON.stringify({
      ...form,
      metrics: form.metrics.split(/[\n,]/).map((item) => item.trim()).filter(Boolean),
    }) });
    setSelectedId(saved.id); setEditing(false); setMessage('경험 카드를 SQLite에 저장했습니다.'); await onRefresh();
  }
  async function copySelected() {
    if (!selected) return;
    try { await navigator.clipboard.writeText(experienceContext(selected)); setMessage('AI와 자소서에 바로 쓸 수 있는 경험 컨텍스트를 복사했습니다.'); }
    catch { setMessage('클립보드 권한이 없어 복사하지 못했습니다.'); }
  }

  return <section className="product-page experience-page"><div className="page-title"><div><p className="eyebrow">EXPERIENCE MEMORY DECK</p><h2>경험 아카이브</h2><p>프로젝트의 맥락과 문제, 나의 판단부터 시행착오와 회고까지 자소서 근거로 구조화합니다.</p></div><button className="run-button" onClick={() => editExperience()}><span>＋</span>새 경험 정리</button></div>
    <div className="experience-summary"><article><span>EXPERIENCE CARDS</span><b>{data.experiences.length}</b><small>정리된 경험</small></article><article><span>USAGE TAGS</span><b>{allTags.length}</b><small>활용 태그</small></article><article><span>EVIDENCE</span><b>{data.experiences.reduce((sum, item) => sum + item.metrics.length, 0)}</b><small>객관적 변화</small></article><div className="muse-memory-card"><div className="muse-memory-agent space-agent-sprite frame-4 state-working" aria-label="경험을 정리하는 우주 에이전트"/><p><b>경험 정리 프로토콜</b><span>무엇을 했는지뿐 아니라 왜 판단했고 무엇을 배웠는지까지 기록합니다.</span></p></div></div>
    <div className="vault-toolbar"><label><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="프로젝트·역량·행동 검색"/></label><div><button className={tag === '전체' ? 'active' : ''} onClick={() => setTag('전체')}>전체</button>{allTags.map((item) => <button className={tag === item ? 'active' : ''} key={item} onClick={() => setTag(item)}>{item}</button>)}</div><small>{message}</small></div>
    <div className="experience-vault-layout"><aside className="story-list"><div className="story-list-head"><span>MY STORY BANK</span><b>{filtered.length}</b></div>{filtered.map((item) => <button className={selected?.id === item.id ? 'active' : ''} key={item.id} onClick={() => { setSelectedId(item.id); setEditing(false); }}><div className="story-icon">{item.title.slice(0, 1)}</div><div><b>{item.title}</b><span>{item.result || item.action || '내용을 더 채워 주세요.'}</span><small>{item.tags.slice(0, 3).join(' · ') || '태그 없음'}</small></div><em>›</em></button>)}{!filtered.length && <p className="empty-story">조건에 맞는 경험이 없습니다.</p>}</aside>
      {editing ? <article className="experience-editor"><div className="vault-card-head"><div><p className="eyebrow">EXPERIENCE FRAMEWORK</p><h3>{form.id ? '경험 카드 편집' : '새 경험 정리'}</h3></div><button type="button" onClick={() => setEditing(false)}>닫기</button></div><label>경험 제목<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="예: 신규 사용자 이탈 구간 개선"/></label><div className="experience-framework-grid">{EXPERIENCE_SECTIONS.map((section) => <label className="framework-field" key={section.field}><span><b>{section.number}</b>{section.label}</span><textarea value={form[section.field]} onChange={(event) => setForm({ ...form, [section.field]: event.target.value })} placeholder={section.guide}/></label>)}</div><label className="metric-field">결과 수치 · 객관적 변화<textarea value={form.metrics} onChange={(event) => setForm({ ...form, metrics: event.target.value })} placeholder="쉼표 또는 줄바꿈으로 구분 · 예: 전환율 12% 개선, 처리 시간 2일 단축"/></label><section className="tag-picker-panel"><div><span><b>09</b>활용 태그</span><small>자소서 문항에 맞춰 다시 찾을 수 있도록 복수 선택하세요.</small></div><div className="tag-picker">{tagPickerOptions.map((item) => <button type="button" aria-pressed={form.tags.includes(item)} className={form.tags.includes(item) ? 'selected' : ''} key={item} onClick={() => toggleTag(item)}>{item}<i>{form.tags.includes(item) ? '✓' : '+'}</i></button>)}</div><div className="custom-tag-row"><input value={customTag} onChange={(event) => setCustomTag(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addCustomTag(); } }} placeholder="직접 태그 입력"/><button type="button" onClick={addCustomTag}>태그 추가</button></div>{form.tags.length > 0 && <div className="selected-tag-row"><span>선택됨</span>{form.tags.map((item) => <button type="button" key={item} onClick={() => toggleTag(item)}>{item} ×</button>)}</div>}</section><button className="save-experience" onClick={saveExperienceCard}>경험 카드 저장</button></article>
      : selected ? <article className="story-detail"><div className="vault-card-head"><div><p className="eyebrow">SELECTED EXPERIENCE</p><h3>{selected.title}</h3></div><div><button onClick={copySelected}>컨텍스트 복사</button><button className="solid" onClick={() => editExperience(selected)}>편집</button></div></div><div className="experience-framework">{EXPERIENCE_SECTIONS.map((section) => <section key={section.field}><b>{section.number}</b><div><span>{section.label}</span><p>{selected[section.field] || (section.field === 'context' ? selected.situation : section.field === 'problem' ? selected.task : '') || `${section.label}을 입력해 주세요.`}</p>{section.field === 'result' && <div className="metric-strip"><span>객관적 변화</span>{selected.metrics.length ? selected.metrics.map((item) => <b key={item}>{item}</b>) : <small>Before / After와 수치 근거를 추가해 주세요.</small>}</div>}</div></section>)}</div><section className="framework-tag-section"><b>09</b><div><span>활용 태그</span><div className="story-tags">{selected.tags.length ? selected.tags.map((item) => <button type="button" key={item} onClick={() => setTag(item)}>{item}</button>) : <small>태그를 선택해 주세요.</small>}</div></div></section></article> : <article className="story-detail empty-detail"><h3>첫 경험을 정리해 보세요</h3><p>프로젝트 하나를 골라 상황과 문제부터 시행착오, 회고까지 기록하면 됩니다.</p><button className="primary-small" onClick={() => editExperience()}>새 경험 시작</button></article>}
      <aside className="story-coach"><p className="eyebrow">EXPERIENCE HEALTH</p><div className="completeness-ring" style={{ '--score': `${completeness * 3.6}deg` } as React.CSSProperties}><b>{completeness}</b><span>완성도</span></div><h3>9단계 체크</h3><ul>{EXPERIENCE_SECTIONS.map((section) => <li className={selected && (selected[section.field] || (section.field === 'context' && selected.situation) || (section.field === 'problem' && selected.task)) ? 'done' : ''} key={section.field}>{section.label}</li>)}<li className={selected?.tags.length ? 'done' : ''}>활용 태그</li></ul><div className="coach-note"><b>AI 사용 범위</b><p>정리한 경험 카드만 비서에게 전달해 경험 밖 사실을 만들어 낼 위험을 줄입니다.</p></div></aside>
    </div>
  </section>;
}

function InterviewQuestionCard({ item, onRefresh }: { item: InterviewQuestion; onRefresh: () => Promise<void> }) {
  const [question, setQuestion] = useState(item.question);
  const [answer, setAnswer] = useState(item.answer_markdown);
  const [status, setStatus] = useState('저장됨');

  async function save() {
    if (!question.trim()) return;
    setStatus('저장 중…');
    try {
      await requestJson('/api/interviews/save', {
        method: 'POST',
        body: JSON.stringify({ ...item, question: question.trim(), answer_markdown: answer }),
      });
      setStatus('저장됨');
      await onRefresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '저장 실패');
    }
  }

  async function remove() {
    await requestJson('/api/interviews/delete', { method: 'POST', body: JSON.stringify({ id: item.id }) });
    await onRefresh();
  }

  return <article className="interview-question-card">
    <header>
      <span className={`question-source ${item.source}`}>{item.source === 'agent' ? '에코 생성' : item.source === 'starter' ? '공통 질문' : '직접 작성'}</span>
      <small>{status}</small>
      <button type="button" onClick={remove} aria-label="질문 삭제">삭제</button>
    </header>
    <input className="interview-question-title" value={question} onChange={(event) => { setQuestion(event.target.value); setStatus('수정됨'); }} onBlur={save} aria-label="면접 질문"/>
    <MarkdownCanvas value={answer} onChange={(value) => { setAnswer(value); setStatus('수정됨'); }} onBlur={save} placeholder="답변을 바로 서식이 적용된 문서로 작성하세요. #, -, > 단축키를 사용할 수 있습니다." ariaLabel={`${question} 답변`}/>
    <footer><span>원문은 Markdown으로 저장됩니다.</span><button type="button" onClick={save}>지금 저장</button></footer>
  </article>;
}

function InterviewView({ data, onRefresh, onGenerate }: { data: Bootstrap; onRefresh: () => Promise<void>; onGenerate: (job: Job) => Promise<void> }) {
  const [scope, setScope] = useState<string>('experience');
  const [newQuestion, setNewQuestion] = useState('');
  const selectedJobId = scope.startsWith('job:') ? scope.slice(4) : null;
  const selectedJob = data.jobs.find((job) => job.id === selectedJobId) || null;
  const questions = data.interviews
    .filter((item) => selectedJobId ? item.job_id === selectedJobId : item.job_id === null && item.category === scope)
    .sort((a, b) => a.order_no - b.order_no);
  const latestRun = data.runs.find((run) => run.agent_id === 'interview');
  const agentRunning = ['queued', 'running'].includes(latestRun?.status || '');

  async function addQuestion() {
    if (!newQuestion.trim()) return;
    await requestJson('/api/interviews/save', {
      method: 'POST',
      body: JSON.stringify({
        id: crypto.randomUUID(),
        job_id: selectedJobId,
        category: selectedJobId ? 'company' : scope,
        question: newQuestion.trim(),
        answer_markdown: '',
        source: 'manual',
      }),
    });
    setNewQuestion('');
    await onRefresh();
  }

  return <section className="product-page interview-page">
    <div className="page-title interview-title">
      <div><p className="eyebrow">INTERVIEW FLIGHT DECK</p><h2>면접 준비실</h2><p>공통 경험·인성 질문은 한 번 정리하고, 기업별 예상 질문과 답안은 채용공고마다 독립적으로 관리합니다.</p></div>
      <div className="interview-title-stats"><span><b>{data.interviews.filter((item) => !item.job_id).length}</b> 공통 질문</span><span><b>{data.interviews.filter((item) => item.job_id).length}</b> 기업 질문</span></div>
    </div>
    <div className="interview-layout">
      <aside className="interview-library">
        <p className="eyebrow">COMMON LIBRARY</p>
        <button className={scope === 'experience' ? 'active' : ''} onClick={() => setScope('experience')}><i>01</i><span><b>경험 질문</b><small>프로젝트·문제해결·실패</small></span><em>{data.interviews.filter((item) => !item.job_id && item.category === 'experience').length}</em></button>
        <button className={scope === 'personality' ? 'active' : ''} onClick={() => setScope('personality')}><i>02</i><span><b>인성 질문</b><small>협업·갈등·업무 기준</small></span><em>{data.interviews.filter((item) => !item.job_id && item.category === 'personality').length}</em></button>
        <div className="interview-library-label"><span>COMPANY ROOMS</span><small>채용공고별 독립 공간</small></div>
        {data.jobs.map((job) => <button className={scope === `job:${job.id}` ? 'active company' : 'company'} key={job.id} onClick={() => setScope(`job:${job.id}`)}><i>{job.company.slice(0, 1)}</i><span><b>{job.company}</b><small>{job.role}</small></span><em>{data.interviews.filter((item) => item.job_id === job.id).length}</em></button>)}
        {!data.jobs.length && <p className="interview-empty-side">채용 보드에서 공고를 먼저 추가해 주세요.</p>}
      </aside>
      <main className="interview-document-room">
        <div className="interview-room-head">
          <div><p className="eyebrow">{selectedJob ? 'COMPANY INTERVIEW FILE' : 'UNIVERSAL QUESTION FILE'}</p><h3>{selectedJob ? `${selectedJob.company} · ${selectedJob.role}` : scope === 'experience' ? '공통 경험 질문' : '공통 인성 질문'}</h3><span>{selectedJob ? 'JD와 기업 조사에 연결된 전용 면접 노트' : '모든 기업 면접에서 재사용하는 개인 답변 라이브러리'}</span></div>
          {selectedJob?.url && <a href={selectedJob.url} target="_blank" rel="noreferrer">채용공고 열기 ↗</a>}
        </div>
        <div className="new-interview-question"><input value={newQuestion} onChange={(event) => setNewQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void addQuestion(); }} placeholder="새 면접 질문을 입력하세요"/><button type="button" onClick={addQuestion}>+ 질문 추가</button></div>
        <div className="interview-question-stack">{questions.map((item) => <InterviewQuestionCard key={item.id} item={item} onRefresh={onRefresh}/>)}{!questions.length && <div className="empty-interview-room"><b>아직 질문이 없습니다.</b><span>직접 질문을 추가하거나 기업 공간에서 에코에게 예상 질문 생성을 요청하세요.</span></div>}</div>
      </main>
      <aside className="interview-agent-panel">
        <div className={agentRunning ? 'interview-agent-orbit working' : 'interview-agent-orbit'}><div className="interview-agent-sprite"/></div>
        <p className="eyebrow">ECHO · INTERVIEW COACH</p><h3>에코</h3><span>JD·기업 조사·경험 카드를 교차해 질문과 답안을 작성합니다.</span>
        <ul><li>직무 검증 질문</li><li>기업 이해 질문</li><li>경험 근거형 답안</li><li>꼬리질문 대응 포인트</li></ul>
        <button type="button" disabled={!selectedJob || agentRunning} onClick={() => selectedJob && onGenerate(selectedJob)}>{agentRunning ? '질문 설계 중…' : selectedJob ? `${selectedJob.company} 예상 질문 생성` : '기업 공간을 선택하세요'}</button>
        <small>{latestRun?.status === 'completed' ? '최근 생성 완료 · 질문함에 자동 저장됨' : '근거가 부족한 답안은 [내 경험 입력 필요]로 표시됩니다.'}</small>
      </aside>
    </div>
  </section>;
}

function SettingsView({ health, data, onRefresh }: { health: Health | null; data: Bootstrap; onRefresh: () => Promise<void> }) {
  const profile = data.profile;
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [targetRoles, setTargetRoles] = useState(profile?.target_roles.join(', ') || '');
  const [interests, setInterests] = useState(profile?.interests.join(', ') || '');
  const [summary, setSummary] = useState(profile?.summary || '');
  const [pendingBackup, setPendingBackup] = useState<Record<string, unknown> | null>(null);
  const [importName, setImportName] = useState('');
  const [importStatus, setImportStatus] = useState('백업을 가져와도 현재 데이터는 삭제되지 않습니다.');
  async function save() { if (!profile) return; await requestJson('/api/profile/save', { method: 'POST', body: JSON.stringify({ ...profile, display_name: displayName, target_roles: targetRoles.split(',').map((item) => item.trim()).filter(Boolean), interests: interests.split(',').map((item) => item.trim()).filter(Boolean), summary }) }); await onRefresh(); }
  async function chooseBackup(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as Record<string, unknown>;
      if (parsed.product !== 'Career Atelier') throw new Error('Career Atelier 백업 파일이 아닙니다.');
      setPendingBackup(parsed); setImportName(file.name); setImportStatus('파일을 확인했습니다. 아래 병합 버튼을 눌러 가져오세요.');
    } catch (error) { setPendingBackup(null); setImportName(''); setImportStatus(error instanceof Error ? error.message : '백업 파일을 읽지 못했습니다.'); }
  }
  async function importBackup() {
    if (!pendingBackup) return;
    setImportStatus('다른 기기의 데이터를 안전하게 병합하고 있습니다…');
    try {
      const result = await requestJson<{ imported: Record<string, number>; safetyPreserved: boolean }>('/api/import/merge', { method: 'POST', body: JSON.stringify({ backup: pendingBackup }) });
      const total = Object.values(result.imported).reduce((sum, value) => sum + value, 0);
      setImportStatus(`${total}개 항목을 병합했습니다. 구독 전용 안전 설정도 유지됐습니다.`); setPendingBackup(null); setImportName(''); await onRefresh();
    } catch (error) { setImportStatus(error instanceof Error ? error.message : '백업 병합에 실패했습니다.'); }
  }
  const backupCounts = pendingBackup ? ['experiences','jobs','calendar','research','essays','versions','interviews','runs','artifacts'].map((key) => ({ key, count: Array.isArray(pendingBackup[key]) ? pendingBackup[key].length : 0 })) : [];
  return <section className="product-page"><div className="page-title"><div><p className="eyebrow">LOCAL CONTROL</p><h2>연결·기기 이전·개인정보</h2><p>AI 인증은 각 컴퓨터의 로컬 CLI에 두고, 커리어 데이터만 백업 파일로 안전하게 이동합니다.</p></div></div>
    <div className="settings-grid"><article className="settings-card"><p className="eyebrow">AI CONNECTIONS</p><h3>구독 실행기</h3>{(['codex','claude'] as Provider[]).map((provider) => <div className="connection-row" key={provider}><div className={`provider-logo ${provider}`}>{provider === 'codex' ? 'O' : 'C'}</div><div><b>{provider === 'codex' ? 'Codex · ChatGPT' : 'Claude Code'}</b><span>{health?.providers[provider]?.version || '확인 중'}</span></div><em className={health?.providers[provider]?.auth.safe ? 'safe' : ''}>{health?.providers[provider]?.auth.safe ? '구독 연결됨' : '확인 필요'}</em></div>)}<div className="safety-rules"><div><span>API 키 사용</span><b>차단</b></div><div><span>유료 초과 사용</span><b>차단</b></div><div><span>한도 소진 시</span><b>초기화 대기</b></div></div></article>
      <article className="settings-card"><p className="eyebrow">MY PROFILE</p><h3>AI가 참고할 나의 방향</h3><label>이름<input value={displayName} onChange={(event) => setDisplayName(event.target.value)}/></label><label>목표 직무 · 쉼표로 구분<input value={targetRoles} onChange={(event) => setTargetRoles(event.target.value)}/></label><label>관심 분야 · 쉼표로 구분<input value={interests} onChange={(event) => setInterests(event.target.value)}/></label><label>한 줄 소개<textarea value={summary} onChange={(event) => setSummary(event.target.value)}/></label><button className="primary-small" onClick={save}>프로필 저장</button></article>
      <article className="settings-card wide portability-card"><div className="settings-card-title"><div><p className="eyebrow">MOVE TO ANOTHER COMPUTER</p><h3>다른 컴퓨터에서도 그대로 이어서 사용</h3></div><span className="local-runtime-badge">AI는 기기별 로컬 실행</span></div><div className="transfer-steps"><div><b>1</b><span>이 컴퓨터</span><p>전체 JSON 백업을 내려받습니다.</p></div><i>→</i><div><b>2</b><span>새 컴퓨터</span><p>앱과 Codex·Claude Code를 설치해 구독 로그인합니다.</p></div><i>→</i><div><b>3</b><span>데이터 병합</span><p>백업 JSON을 선택해 기존 데이터와 합칩니다.</p></div></div><div className="transfer-actions"><a className="export-backup" href={`${API}/api/export/download`}>전체 백업 내려받기</a><label className="backup-picker">{importName || '백업 JSON 선택'}<input type="file" accept="application/json,.json" onChange={chooseBackup}/></label><button disabled={!pendingBackup} onClick={importBackup}>비파괴 병합 가져오기</button></div>{pendingBackup && <div className="backup-preview"><span>가져올 항목</span>{backupCounts.map((item) => <b key={item.key}>{item.key} <em>{item.count}</em></b>)}</div>}<p className="import-status"><i/>{importStatus}</p><div className="device-safety-note"><b>중요</b><span>백업에는 자소서와 조사 내용이 포함됩니다. 개인 저장공간으로만 옮기세요. API 키·Codex·Claude 로그인 정보는 백업에 포함되지 않습니다.</span></div></article>
      <article className="settings-card wide"><div className="settings-card-title"><div><p className="eyebrow">LOCAL STORAGE</p><h3>내 컴퓨터에 저장되는 항목</h3></div><a className="secondary-button" href={`${API}/api/export/download`}>전체 JSON 내보내기</a></div><div className="storage-path"><span>SQLite</span><code>{health?.databasePath || '로컬 비서 연결을 기다리는 중'}</code></div><div className="storage-stats"><div><b>{data.experiences.length}</b><span>경험 카드</span></div><div><b>{data.jobs.length}</b><span>채용공고</span></div><div><b>{data.calendar.length}</b><span>지원 일정</span></div><div><b>{data.interviews.length}</b><span>면접 질문</span></div><div><b>{data.versions.length}</b><span>자소서 버전</span></div><div><b>{data.runs.length}</b><span>실행 기록</span></div></div></article></div>
  </section>;
}

export default function Home() {
  const [activeNav, setActiveNav] = useState('사무실');
  const [data, setData] = useState<Bootstrap>(emptyData);
  const [health, setHealth] = useState<Health | null>(null);
  const [connected, setConnected] = useState(false);
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [targetJobId, setTargetJobId] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try { const next = await requestJson<Bootstrap>('/api/bootstrap'); setData(next); setConnected(true); setError(''); }
    catch (refreshError) { setConnected(false); setError(refreshError instanceof Error ? refreshError.message : '로컬 비서 연결 오류'); }
  }, []);

  useEffect(() => {
    requestJson<Bootstrap>('/api/bootstrap').then((nextData) => { setData(nextData); setConnected(true); }).catch((loadError) => { setConnected(false); setError(loadError.message); });
    requestJson<Health>('/api/health').then((nextHealth) => setHealth(nextHealth)).catch((loadError) => setError(loadError.message));
  }, []);

  const running = useMemo(() => data.runs.some((run) => ['queued', 'running'].includes(run.status) && (!pipelineId || run.pipeline_id === pipelineId)), [data.runs, pipelineId]);
  const monitoredArtifacts = useMemo(() => pipelineId ? data.artifacts.filter((artifact) => artifact.pipeline_id === pipelineId) : [], [data.artifacts, pipelineId]);
  const targetJob = data.jobs.find((job) => job.id === targetJobId) || data.jobs[0];
  const waitingForApproval = monitoredArtifacts.some((artifact) => artifact.kind === 'approval_required') && !monitoredArtifacts.some((artifact) => artifact.kind === 'approval_granted');
  const monitoringFinished = monitoredArtifacts.some((artifact) => ['pipeline_complete', 'pipeline_error'].includes(artifact.kind) || artifact.metadata?.standalone === true);
  useEffect(() => {
    if (!running && (!pipelineId || waitingForApproval || monitoringFinished)) return;
    const timer = window.setInterval(refresh, 1800);
    return () => window.clearInterval(timer);
  }, [running, pipelineId, waitingForApproval, monitoringFinished, refresh]);

  async function startPipeline() {
    if (!connected || running) return;
    try {
      const response = await requestJson<{ pipelineId: string }>('/api/pipeline/start', { method: 'POST', body: JSON.stringify({ jobId: targetJob?.id, essayId: data.essays.find((essay) => essay.job_id === targetJob?.id)?.id || data.essays[0]?.id, harnessId: data.harnesses[0]?.id }) });
      setPipelineId(response.pipelineId); setActiveNav('파이프라인'); await refresh();
    } catch (startError) { setError(startError instanceof Error ? startError.message : '파이프라인 시작 오류'); }
  }

  async function approvePipeline(id: string) {
    try { await requestJson(`/api/pipeline/${id}/approve`, { method: 'POST', body: '{}' }); await refresh(); }
    catch (approveError) { setError(approveError instanceof Error ? approveError.message : '승인 후 실행 오류'); }
  }

  async function cancelActiveRun() {
    const active = data.runs.find((run) => ['queued', 'running'].includes(run.status) && (!pipelineId || run.pipeline_id === pipelineId));
    if (!active) return;
    try { await requestJson(`/api/runs/${active.id}/cancel`, { method: 'POST', body: '{}' }); await refresh(); }
    catch (cancelError) { setError(cancelError instanceof Error ? cancelError.message : '실행 중단 오류'); }
  }

  async function runStandalone(agentId: AgentId, prompt: string, title: string, artifactMetadata: Record<string, unknown> = {}) {
    const harness = data.harnesses[0];
    const provider = harness?.provider_map[agentId] || (agentId === 'company' || agentId === 'review' ? 'claude' : 'codex');
    const response = await requestJson<{ pipelineId: string }>('/api/agents/run', {
      method: 'POST',
      body: JSON.stringify({ agentId, provider, prompt, maxTurns: harness?.config.maxTurns || 6, timeoutMinutes: harness?.config.timeoutMinutes || 12, artifactKind: agentId, artifactTitle: title, artifactMetadata }),
    });
    setPipelineId(response.pipelineId);
    await refresh();
  }

  async function researchJob(job: Job) {
    const template = data.prompts.find((prompt) => prompt.agent_id === 'company');
    const prompt = `${template?.body || '기업과 직무를 공식 자료 중심으로 조사하라.'}\n\n[대상 공고]\n${JSON.stringify(job, null, 2)}\n\n[사용자 프로필]\n${JSON.stringify(data.profile, null, 2)}\n\n[필수 규칙]\n공식 출처 URL과 확인 날짜를 포함하고 사실과 추론을 구분한다.`;
    try { await runStandalone('company', prompt, `${job.company} · ${job.role} 기업 조사`, { jobId: job.id }); setActiveNav('파이프라인'); }
    catch (researchError) { setError(researchError instanceof Error ? researchError.message : '기업 조사 시작 오류'); }
  }

  async function createEssay(job: Job) {
    try {
      await requestJson('/api/essays/save', { method: 'POST', body: JSON.stringify({ id: crypto.randomUUID(), job_id: job.id, title: `${job.company} ${job.role} 자소서`, question: '지원 동기와 입사 후 기여할 수 있는 점을 작성해 주세요.', draft: '', target_chars: 700, status: 'draft', note: '프로젝트 생성' }) });
      await refresh(); setActiveNav('문서 보관함');
    } catch (essayError) { setError(essayError instanceof Error ? essayError.message : '자소서 프로젝트 생성 오류'); }
  }

  async function reviewDraft(draft: string, essay?: Essay) {
    const template = data.prompts.find((prompt) => prompt.agent_id === 'review');
    const job = data.jobs.find((item) => item.id === essay?.job_id) || targetJob;
    const blueprint = data.harnesses[0]?.config.writingBlueprint;
    const prompt = `${template?.body || '자소서 초안을 근거 중심으로 검수하라.'}\n\n[검수할 자소서]\n${draft}\n\n[대상 공고]\n${JSON.stringify(job || {}, null, 2)}\n\n[사용자 자소서 블루프린트]\n${JSON.stringify(blueprint || {}, null, 2)}\n\n사실성, 직무 적합성, 문체 순서로 점검하고 점수의 근거와 문장별 수정안을 한국어로 작성하라.`;
    try { await runStandalone('review', prompt, `${essay?.title || '자소서'} AI 검수`, { essayId: essay?.id, jobId: job?.id }); }
    catch (reviewError) { setError(reviewError instanceof Error ? reviewError.message : 'AI 검수 시작 오류'); }
  }

  async function generateInterviewQuestions(job: Job) {
    const template = data.prompts.find((prompt) => prompt.agent_id === 'interview');
    const existing = data.interviews.filter((item) => item.job_id === job.id).map((item) => item.question);
    const prompt = `${template?.body || '채용공고와 경험 카드를 바탕으로 예상 면접 질문과 답안을 작성하라.'}

[대상 채용공고]
${JSON.stringify(job, null, 2)}

[기업 조사 자료]
${JSON.stringify(data.research, null, 2)}

[사용자의 실제 경험 카드]
${JSON.stringify(data.experiences, null, 2)}

[이미 정리된 기업 질문]
${JSON.stringify(existing, null, 2)}

[출력 규격]
중복되지 않는 예상 질문 8개를 작성한다. 답변은 Markdown으로 작성하고, 경험 카드 밖의 사실은 절대 만들지 않는다. 근거가 없으면 [내 경험 입력 필요]라고 쓴다.
결과 마지막에 아래 태그 사이에 JSON 배열을 반드시 포함한다.
<interview_json>
[{"question":"질문","answer_markdown":"## 핵심 답변\\n\\n- 근거\\n- 직무 연결"}]
</interview_json>`;
    try {
      await runStandalone('interview', prompt, `${job.company} · ${job.role} 예상 면접 질문`, { jobId: job.id });
    } catch (interviewError) {
      setError(interviewError instanceof Error ? interviewError.message : '면접 질문 생성 오류');
    }
  }

  let content;
  if (activeNav === '파이프라인') content = <PipelineView data={data} running={running} pipelineId={pipelineId} onStart={startPipeline} onCancel={cancelActiveRun} onApprove={approvePipeline}/>;
  else if (activeNav === '채용 보드') content = <JobsView data={data} selectedId={targetJob?.id || ''} onSelect={setTargetJobId} onRefresh={refresh} onResearch={researchJob} onCreateEssay={createEssay}/>;
  else if (activeNav === '캘린더') content = <CalendarView data={data} onRefresh={refresh} onCreateEssay={createEssay}/>;
  else if (activeNav === '경험 보관함') content = <ExperienceVaultView data={data} onRefresh={refresh}/>;
  else if (activeNav === '면접 준비') content = <InterviewView data={data} onRefresh={refresh} onGenerate={generateInterviewQuestions}/>;
  else if (activeNav === 'Prompt Lab') content = <PromptLabView data={data} onRefresh={refresh}/>;
  else if (activeNav === '문서 보관함') content = <DocumentsView data={data} onRefresh={refresh} onReview={reviewDraft}/>;
  else if (activeNav === '설정') content = <SettingsView key={data.profile?.updated_at || 'profile'} health={health} data={data} onRefresh={refresh}/>;
  else content = <OfficeView data={data} targetJob={targetJob} running={running} onStart={startPipeline} onCancel={cancelActiveRun} onOpenDocuments={() => setActiveNav('문서 보관함')}/>;

  return <main className="app-shell"><SideRail active={activeNav} onChange={setActiveNav}/><section className="workspace"><AppHeader health={health} connected={connected}/>{error && <div className="connection-banner"><b>로컬 비서 연결 필요</b><span>{error}</span><button onClick={refresh}>다시 연결</button></div>}{content}</section><FocusTimer/></main>;
}
