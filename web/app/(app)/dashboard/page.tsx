import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { isRunnerOnline } from '@/lib/runner-status';
import { formatDateTime } from '@/lib/datetime';
import { formatResetsAt, parseClaudeWindows, sumCodexTokens } from '@/lib/llm-usage';
// 라벨을 여기 또 적어 두면 프롬프트 생성실과 어긋난다. 한 곳에서 가져온다.
import { PROVIDER_META, isProvider } from '@/lib/agent-providers';
import { createEssay, startEssayForJobPost } from '../essays/actions';
import { approveRunner } from '../runners/actions';
import { RunnerBackupForm } from './runner-backup-form';
import { NewsSection } from './news-section';
import { NewsRunButton } from './news-run-button';
import { JobSearchButton } from './job-search-button';
import { QuestionImportButton } from './question-import';
import { AgentLiveRefresh } from './agent-live-refresh';

const ORBIT_AGENTS = [
  { id: 'news', name: '루미', role: '통신·뉴스', frame: 1 },
  { id: 'jobs', name: '모카', role: '항로·채용탐색', frame: 2 },
  { id: 'company', name: '솔', role: '기업정보 해독', frame: 3 },
  { id: 'writer', name: '뮤즈', role: '자소서 작성', frame: 4 },
  { id: 'review', name: '렌즈', role: '근거 검수', frame: 5 },
  { id: 'interview', name: '에코', role: '면접 코치', frame: 6 },
  { id: 'subtitle', name: '콤마', role: '15자 소제목', frame: 7 },
];


function agentSpeech(agentId: string, status: string | null | undefined, runnerOnline: boolean) {
  if (!runnerOnline) return '로컬 러너의 연결을 기다리고 있어요.';
  if (status === 'waiting_for_reset') return '구독 한도 초기화를 기다리고 있어요.';
  if (status === 'failed') return '오류 기록을 확인하고 재시도를 준비 중이에요.';
  if (status === 'cancelled') return '중단된 임무를 정리하고 대기 중이에요.';
  if (status === 'completed') return '결과물을 다음 에이전트에게 전달했어요.';
  if (status === 'queued') return '입력 자료를 확인하며 제 차례를 기다리고 있어요.';
  if (status === 'running') return ({
    news: '산업 뉴스와 원문 출처를 수집 중이에요.',
    jobs: '공고를 비교해 경험 적합도를 계산 중이에요.',
    company: '위성 신호로 기업 근거를 수신 중이에요.',
    writer: '경험 카드로 자소서 초안을 쓰고 있어요.',
    review: '과장 표현과 근거 누락을 검수 중이에요.',
    interview: 'JD와 경험을 대조해 예상 면접 질문을 설계 중이에요.',
    subtitle: '본문의 핵심 근거를 15자 소제목으로 압축 중이에요.',
  } as Record<string, string>)[agentId];
  return '다음 임무를 기다리며 작업함을 정리하고 있어요.';
}

// 1단계(기반) 산출물: "다기기에서 읽기가 된다"를 눈으로 확인하기 위한 읽기 전용 화면.
// 자소서 편집·자동저장·충돌 해결은 2단계에서 붙인다(§16).
export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    { data: profile },
    { data: experiences },
    { data: jobs },
    { data: essays },
    { data: runners },
    { data: newsNotes },
    { data: pendingNewsJobs },
    { data: pendingJobSearchJobs },
    { data: questionCounts },
    { data: agentRuns },
    { data: claudeLimitEvents },
    { data: codexUsageEvents },
    { data: promptTemplates },
  ] = await Promise.all([
    supabase.from('profiles').select('*').maybeSingle(),
    supabase.from('experience_cards').select('*').order('updated_at', { ascending: false }),
    supabase.from('job_posts').select('*').order('updated_at', { ascending: false }),
    supabase.from('essay_projects').select('*').order('updated_at', { ascending: false }),
    supabase.from('runners').select('*').order('created_at', { ascending: false }),
    supabase.from('research_notes').select('*').eq('kind', 'news').order('created_at', { ascending: false }).limit(1),
    supabase.from('jobs').select('id').eq('kind', 'news').in('status', ['queued', 'running']).limit(1),
    supabase.from('jobs').select('id').eq('kind', 'jobs').in('status', ['queued', 'running']).limit(1),
    supabase.from('essay_questions').select('job_post_id'),
    supabase.from('agent_runs').select('agent_id, provider, status, created_at').order('created_at', { ascending: false }).limit(50),
    // 구독 잔량은 별도 테이블 없이 실행 스트림에서 되읽는다(web/lib/llm-usage.ts).
    supabase.from('run_events').select('payload').eq('kind', 'rate_limit_event').order('created_at', { ascending: false }).limit(1),
    supabase.from('run_events').select('payload').eq('kind', 'turn.completed').order('created_at', { ascending: false }).limit(200),
    supabase.from('prompt_templates').select('agent_id, provider'),
  ]);

  const runnerOnline = (runners ?? []).some((runner) => isRunnerOnline(runner.last_seen_at));
  const newsPending = (pendingNewsJobs?.length ?? 0) > 0;
  const jobsPending = (pendingJobSearchJobs?.length ?? 0) > 0;
  const questionCountByJobPost = new Map<string, number>();
  for (const row of questionCounts ?? []) {
    if (!row.job_post_id) continue;
    questionCountByJobPost.set(row.job_post_id, (questionCountByJobPost.get(row.job_post_id) ?? 0) + 1);
  }
  const activeAgentIds = new Set((agentRuns ?? []).filter((run) => ['queued', 'running'].includes(run.status)).map((run) => run.agent_id));
  const researchActive = activeAgentIds.has('company');
  const codexRuns = (agentRuns ?? []).filter((run) => run.provider === 'codex').length;
  const claudeRuns = (agentRuns ?? []).filter((run) => run.provider === 'claude').length;
  const geminiRuns = (agentRuns ?? []).filter((run) => run.provider === 'gemini').length;

  // Claude만 실제 잔량(창별 사용률)을 스트림으로 준다. Codex는 토큰 수만 주고
  // 한도를 안 줘서 잔량 계산이 불가능하다 — 없는 값을 지어내지 않는다.
  const providerByAgent = new Map((promptTemplates ?? []).map((row) => [row.agent_id, row.provider]));

  const claudeWindows = parseClaudeWindows(claudeLimitEvents?.[0]?.payload ?? null);
  const codexTokens = sumCodexTokens((codexUsageEvents ?? []).map((row) => row.payload));

  return (
    <>
      <AgentLiveRefresh enabled={activeAgentIds.size > 0}/>
      <div className="page-title">
        <div>
          <p className="eyebrow">ORBITAL CAREER COMMAND · CLOUD DECK</p>
          <h2>오늘의 지원 작전실</h2>
          <p>
            {profile
              ? `${profile.display_name} · ${(profile.target_roles as string[] | null)?.join(', ') || '목표 직무 미설정'}`
              : '아직 v1에서 데이터를 이관하지 않았습니다.'}
          </p>
        </div>
      </div>

      <section className="cloud-mission-deck">
        <div className="cloud-orbit-scene">
          <div className="cloud-space-window" aria-hidden="true">
            <div className="cloud-stars"/><div className="cloud-planet"/>
            <div className={researchActive ? 'cloud-satellite transmitting' : 'cloud-satellite'}><i/><b/></div>
            <div className="cloud-signal signal-one"/><div className="cloud-signal signal-two"/>
          </div>
          <div className="cloud-mission-label"><span>CA-04</span><b>APPLICATION MISSION</b><small>{researchActive ? '기업 데이터 수신 중' : runnerOnline ? '러너 연결 · 임무 대기' : '러너 오프라인 · 큐 보존'}</small></div>
          <div className="cloud-agent-line">
            {ORBIT_AGENTS.map((agent) => {
              const active = activeAgentIds.has(agent.id);
              const latest = (agentRuns ?? []).find((run) => run.agent_id === agent.id);
              return <article className={active ? 'cloud-agent active' : 'cloud-agent'} key={agent.id}>
                <div className={active ? 'cloud-agent-speech live' : 'cloud-agent-speech'}><b>{agent.name}</b><span>{agentSpeech(agent.id, latest?.status, runnerOnline)}</span></div>
                <div className={`cloud-space-agent frame-${agent.frame}`} aria-label={`${agent.name} 픽셀 채용 에이전트`}/>
                <div><b>{agent.name}</b><span>{agent.role}</span><small>{(() => { const p = providerByAgent.get(agent.id); return p && isProvider(p) ? PROVIDER_META[p].label : '미설정'; })()} · {active ? 'RUNNING' : latest?.status?.toUpperCase() || 'STANDBY'}</small></div>
                {agent.id === 'news' && <NewsRunButton pending={newsPending} runnerOnline={runnerOnline} />}
                {agent.id === 'jobs' && <JobSearchButton pending={jobsPending} runnerOnline={runnerOnline} />}
              </article>;
            })}
          </div>
        </div>
        <aside className="cloud-usage-panel">
          <div><p className="eyebrow">SUBSCRIPTION QUOTA</p><h3>구독 잔량</h3></div>

          <article className="quota-block">
            <header><span className="cloud-provider-icon claude">CL</span><b>Claude Code</b></header>
            {claudeWindows.length ? (
              claudeWindows.map((win) => {
                const left = Math.round((1 - win.usedRatio) * 100);
                const tone = left <= 10 ? 'danger' : left <= 30 ? 'warn' : 'ok';
                return (
                  <div className="quota-window" key={win.label}>
                    <p><span>{win.label} 창</span><strong className={tone}>{left}% 남음</strong></p>
                    <i><em className={tone} style={{ width: `${Math.round(win.usedRatio * 100)}%` }} /></i>
                    <small>{formatResetsAt(win.resetsAt) ?? '초기화 시각 미상'}</small>
                  </div>
                );
              })
            ) : (
              <p className="quota-empty">아직 측정된 값이 없습니다. 솔이나 렌즈를 한 번 실행하면 잔량이 표시됩니다.</p>
            )}
          </article>

          <article className="quota-block">
            <header><span className="cloud-provider-icon codex">OX</span><b>Codex · ChatGPT</b></header>
            <div className="quota-window">
              <p><span>누적 토큰</span><strong>{codexTokens.toLocaleString()}</strong></p>
              <small>ChatGPT는 남은 한도를 알려주지 않습니다. 실제 사용량만 표시합니다.</small>
            </div>
          </article>

          <article className="quota-block locked">
            <header><span className="cloud-provider-icon">00</span><b>API Fallback</b></header>
            <div className="quota-window">
              <p><span>종량 과금</span><strong className="ok">차단됨</strong></p>
              <small>한도에 닿아도 API로 넘어가지 않습니다.</small>
            </div>
          </article>

          <p>실행 {codexRuns + claudeRuns + geminiRuns}회 · 구독 인증은 로컬 기기에만 저장</p>
          <Link href="/activity" className="cloud-usage-link">전체 실행 기록 보기 →</Link>
        </aside>
      </section>

      <div className="stat-grid">
        <article className="card stat-card">
          <span>경험 카드</span>
          <b>{experiences?.length ?? 0}</b>
        </article>
        <article className="card stat-card">
          <span>채용공고</span>
          <b>{jobs?.length ?? 0}</b>
        </article>
        <article className="card stat-card">
          <span>자소서</span>
          <b>{essays?.length ?? 0}</b>
        </article>
      </div>

      <NewsSection latestNews={newsNotes?.[0] ?? null} />

      <section className="card card-pad" style={{ marginTop: 18 }}>
        <div className="section-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p className="eyebrow">LATEST DRAFTS</p>
            <h2 style={{ margin: 0, fontSize: 18 }}>자소서</h2>
          </div>
        </div>

        {essays && essays.length > 0 ? (
          <ul className="essay-list">
            {essays.map((essay) => (
              <li key={essay.id}>
                <Link href={`/essays/${essay.id}`}>{essay.title}</Link>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 12 }}>아직 자소서가 없습니다.</p>
        )}

        <form action={createEssay} className="inline-form">
          <input type="text" name="title" placeholder="새 자소서 제목" className="field-input" />
          <button type="submit" className="run-button">
            + 새 자소서
          </button>
        </form>
      </section>

      {runners && runners.length > 0 && (
        <section className="card card-pad" style={{ marginTop: 18 }}>
          <p className="eyebrow">LOCAL RUNNER</p>
          <h2 style={{ margin: 0, fontSize: 18 }}>러너</h2>
          <ul className="essay-list">
            {runners.map((runner) => {
              const online = isRunnerOnline(runner.last_seen_at);
              return (
                <li key={runner.id} style={{ padding: '13px 4px', fontSize: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <span>
                    {runner.device_name}
                    {' · '}
                    <span className={`status-pill ${online ? 'saved' : 'offline'}`} style={{ marginLeft: 4 }}>
                      <i />
                      {online ? '온라인' : '오프라인'}
                    </span>{' '}
                    <span className={`status-pill ${runner.approved ? 'saved' : 'dirty'}`}>
                      <i />
                      {runner.approved ? '승인됨' : '승인 대기'}
                    </span>
                    {runner.last_seen_at && (
                      <span style={{ color: 'var(--text-dim)', fontSize: 12, marginLeft: 8 }}>
                        마지막 연결 {formatDateTime(runner.last_seen_at)}
                      </span>
                    )}
                  </span>
                  {!runner.approved && (
                    <form action={approveRunner.bind(null, runner.id)}>
                      <button type="submit" className="secondary-button">
                        승인
                      </button>
                    </form>
                  )}
                  </div>
                  <RunnerBackupForm
                    runnerId={runner.id}
                    enabled={runner.backup_enabled}
                    dir={runner.backup_dir}
                    lastBackupAt={runner.last_backup_at}
                    lastBackupError={runner.last_backup_error}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="card card-pad" style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <p className="eyebrow">ROLE INTELLIGENCE</p>
            <h2 style={{ margin: 0, fontSize: 18 }}>채용공고</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--text-dim)', fontSize: 12 }}>관제실의 모카 카드에서 새 탐색을 시작할 수 있습니다.</p>
          </div>
        </div>
        {jobs && jobs.length > 0 ? (
          <ul className="essay-list">
            {jobs.map((job) => (
              <li
                key={job.id}
                style={{ padding: '13px 4px', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}
              >
                <span>
                  <a href={job.url || undefined} target="_blank" rel="noreferrer" style={{ color: job.url ? 'var(--cyan)' : 'inherit' }}>
                    {job.company} · {job.role}
                  </a>{' '}
                  {job.deadline ? `· D-day ${job.deadline}` : ''} · 적합도 {job.fit_score}%
                </span>
                <span style={{ display: 'flex', gap: 8 }}>
                  <form action={startEssayForJobPost.bind(null, job.id)}>
                    <button type="submit" className="secondary-button">
                      이 공고로 자소서 시작
                    </button>
                  </form>
                  <QuestionImportButton jobPostId={job.id} existingCount={questionCountByJobPost.get(job.id) ?? 0} />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 12 }}>아직 탐색한 채용공고가 없습니다.</p>
        )}
      </section>

      <section className="card card-pad" style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p className="eyebrow">EXPERIENCE VAULT</p>
            <h2 style={{ margin: 0, fontSize: 18 }}>경험 카드</h2>
          </div>
          <Link href="/experiences" className="secondary-button">
            경험 보관함 열기
          </Link>
        </div>
        {experiences && experiences.length > 0 ? (
          <ul className="essay-list">
            {experiences.map((experience) => (
              <li key={experience.id} style={{ padding: '13px 4px', fontSize: 14 }}>
                {experience.title}
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 12 }}>
            아직 경험이 없습니다 — 렌즈(검수)와 뮤즈(작성)가 이 카드를 근거로 씁니다.
          </p>
        )}
      </section>
    </>
  );
}
