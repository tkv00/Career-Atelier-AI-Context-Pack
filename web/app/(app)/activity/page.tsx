import { createClient } from '@/lib/supabase/server';
import { formatDateTime } from '@/lib/datetime';

// 7단계(다듬기) 첫 조각 — 5개 비서가 실제로 어떤 LLM(Codex/Claude 구독)으로
// 돌았는지 한 화면에서 아이콘으로 구분해 보여준다. 실제 토큰 사용량은 CLI
// 스트림에서 아직 뽑아내지 않아(§13) 계측하지 못한다 — 지금 계측 가능한
// 것은 실행 횟수·상태·소요시간이다.
const AGENT_LABEL: Record<string, string> = {
  review: '렌즈 · 검수',
  writer: '뮤즈 · 작성',
  news: '루미 · 뉴스',
  company: '솔 · 기업조사',
  jobs: '모카 · 채용탐색',
  interview: '에코 · 면접 코치',
  subtitle: '소제목 · 헤드라인',
};

// 배지 색은 여기서 다시 정의하지 않고 디자인 시스템의 .cloud-provider-icon
// 변형(codex/claude)을 그대로 쓴다 — 대시보드 사용량 패널과 같은 배지를
// 두 군데서 따로 칠하면 반드시 어긋난다.
const PROVIDER_META: Record<string, { label: string; icon: string; tone: string }> = {
  codex: { label: 'Codex · ChatGPT 구독', icon: 'OX', tone: 'codex' },
  claude: { label: 'Claude Code · Claude 구독', icon: 'CL', tone: 'claude' },
  gemini: { label: 'Gemini · Google 계정', icon: 'GM', tone: '' },
};

const STATUS_META: Record<string, { label: string; pill: string }> = {
  running: { label: '실행 중', pill: 'dirty' },
  completed: { label: '완료', pill: 'saved' },
  retrying: { label: '자동 재시도', pill: 'dirty' },
  failed: { label: '실패', pill: 'error' },
  blocked_paid_overage: { label: '유료 초과 차단', pill: 'error' },
  waiting_for_reset: { label: '쿼터 대기', pill: 'dirty' },
};

function ProviderIcon({ provider }: { provider: string }) {
  const meta = PROVIDER_META[provider] ?? { label: provider, icon: '??', tone: '' };
  return (
    <span className={`cloud-provider-icon ${meta.tone}`} title={meta.label}>
      {meta.icon}
    </span>
  );
}

function durationLabel(startedAt: string | null, finishedAt: string | null): string | null {
  if (!startedAt || !finishedAt) return null;
  const seconds = Math.round((new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 1000);
  if (seconds < 60) return `${seconds}초`;
  return `${Math.floor(seconds / 60)}분 ${seconds % 60}초`;
}

export default async function ActivityPage() {
  const supabase = await createClient();
  const { data: runs } = await supabase
    .from('agent_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(100);

  const rows = runs ?? [];
  const byProvider = new Map<string, { total: number; completed: number; failed: number }>();
  for (const run of rows) {
    const bucket = byProvider.get(run.provider) ?? { total: 0, completed: 0, failed: 0 };
    bucket.total += 1;
    if (run.status === 'completed') bucket.completed += 1;
    if (run.status === 'failed' || run.status === 'blocked_paid_overage') bucket.failed += 1;
    byProvider.set(run.provider, bucket);
  }
  const providerOrder = ['codex', 'claude', 'gemini'];

  return (
    <>
      <div className="page-title">
        <div>
          <p className="eyebrow">AGENT ACTIVITY</p>
          <h2>데이터 저장고</h2>
          <p>
            승무원이 어떤 LLM 구독으로 실행됐는지 한눈에 봅니다. 최근 100건 · 실제 토큰이 아니라 실행 횟수·상태·소요 시간
            기준입니다.
          </p>
        </div>
      </div>

      <div className="stat-grid">
        {providerOrder.map((provider) => {
          const meta = PROVIDER_META[provider] ?? { label: provider, icon: '??', tone: '' };
          const stat = byProvider.get(provider) ?? { total: 0, completed: 0, failed: 0 };
          return (
            <article key={provider} className="card stat-card">
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ProviderIcon provider={provider} />
                {meta.label}
              </span>
              <b>{stat.total}</b>
              <span style={{ color: 'var(--text-dim)' }}>
                완료 {stat.completed} · 실패 {stat.failed}
              </span>
            </article>
          );
        })}
      </div>

      <section className="card card-pad" style={{ marginTop: 18 }}>
        {rows.length > 0 ? (
          <ul className="essay-list">
            {rows.map((run) => {
              const statusMeta = STATUS_META[run.status] ?? { label: run.status, pill: 'dirty' };
              const duration = durationLabel(run.started_at, run.finished_at);
              return (
                <li
                  key={run.id}
                  style={{ padding: '13px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <ProviderIcon provider={run.provider} />
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{AGENT_LABEL[run.agent_id] ?? run.agent_id}</span>
                    <span className={`status-pill ${statusMeta.pill}`}>
                      <i />
                      {statusMeta.label}
                    </span>
                  </span>
                  <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>
                    {run.started_at ? formatDateTime(run.started_at) : '—'}
                    {duration ? ` · ${duration}` : ''}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>아직 실행 기록이 없습니다. 비서를 하나 실행하면 여기 쌓입니다.</p>
        )}
      </section>
    </>
  );
}
