// 구독 사용량 읽기.
//
// CLI 실행 스트림은 작업별 사용량과 달리 계정 한도 전체를 항상 알지 못한다.
// Claude는 스트림을, Codex는 App Server의 계정 RPC를 통해 실제 한도 창을 준다.
//
//  - Claude  : rate_limit_event.rate_limit_info.unifiedWindows
//              → 5시간·7일 창의 사용률(0~1)과 초기화 시각. 이게 진짜 "잔량"이다.
//  - Codex   : runners.codex_rate_limits
//              → App Server가 읽은 실제 사용률과 초기화 시각. 토큰을 한도처럼
//                역산하지 않아 모델·플랜별 한도 변화에도 거짓 수치를 만들지 않는다.
//  - Gemini  : 아직 관측된 사용량 이벤트가 없다.
//
// 잔량을 모르는 프로바이더에 그럴싸한 막대를 그리지 않는다 — 화면이 거짓말을
// 하느니 "제공 안 함"이라고 적는 편이 낫다.

export type QuotaWindow = {
  label: string;
  usedRatio: number; // 0~1
  resetsAt: string | null; // ISO
};

export type ProviderUsage = {
  provider: 'codex' | 'claude' | 'gemini';
  runs: number;
  windows: QuotaWindow[]; // 비어 있으면 잔량 정보 없음
  tokens: number | null; // 누적 토큰. 없으면 null
};

const WINDOW_LABELS: Record<string, string> = {
  five_hour: '5시간',
  seven_day: '7일',
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

// Claude의 rate_limit_event에서 창별 사용률을 뽑는다. 형태가 바뀌면 조용히
// 빈 배열을 돌려줘, 잘못된 수치를 그리는 대신 "정보 없음"으로 떨어지게 한다.
export function parseClaudeWindows(payload: unknown): QuotaWindow[] {
  const root = asRecord(payload);
  const info = asRecord(root?.rate_limit_info);
  const unified = asRecord(info?.unifiedWindows);
  if (!unified) return [];

  const windows: QuotaWindow[] = [];
  for (const [key, raw] of Object.entries(unified)) {
    const win = asRecord(raw);
    const utilization = win?.utilization;
    if (typeof utilization !== 'number' || !Number.isFinite(utilization)) continue;

    const resetsAt = typeof win?.resetsAt === 'number' ? new Date(win.resetsAt * 1000).toISOString() : null;
    windows.push({
      label: WINDOW_LABELS[key] ?? key,
      usedRatio: Math.min(Math.max(utilization, 0), 1),
      resetsAt,
    });
  }
  // 짧은 창을 먼저 보여준다 — 당장 막히는 건 그쪽이다.
  return windows.sort((a, b) => a.label.localeCompare(b.label));
}

function durationLabel(minutes: number | null): string | null {
  if (minutes === null || minutes <= 0) return null;
  if (minutes % 1_440 === 0) return `${minutes / 1_440}일`;
  if (minutes % 60 === 0) return `${minutes / 60}시간`;
  return `${minutes}분`;
}

// 저장된 App Server 응답은 버전·플랜에 따라 버킷 이름이 달라질 수 있다. 그래서
// codex/codex_other를 하드코딩하지 않고 서버가 준 이름과 창 길이로 구분한다.
export function parseCodexWindows(payload: unknown): QuotaWindow[] {
  const root = asRecord(payload);
  const buckets = asRecord(root?.rateLimitsByLimitId);
  if (!buckets) return [];

  const windows: QuotaWindow[] = [];
  for (const [limitId, rawLimit] of Object.entries(buckets)) {
    const limit = asRecord(rawLimit);
    if (!limit) continue;
    const name = typeof limit.limitName === 'string' && limit.limitName.trim() ? limit.limitName.trim() : limitId;
    for (const key of ['primary', 'secondary']) {
      const rawWindow = asRecord(limit[key]);
      const usedPercent = rawWindow?.usedPercent;
      if (typeof usedPercent !== 'number' || !Number.isFinite(usedPercent)) continue;
      const duration = typeof rawWindow?.windowDurationMins === 'number' && Number.isFinite(rawWindow.windowDurationMins)
        ? Math.max(rawWindow.windowDurationMins, 0)
        : null;
      const resetsAt = typeof rawWindow?.resetsAt === 'number'
        ? new Date(rawWindow.resetsAt * 1000).toISOString()
        : null;
      windows.push({
        label: `${name} · ${durationLabel(duration) ?? (key === 'primary' ? '기본 창' : '추가 창')}`,
        usedRatio: Math.min(Math.max(usedPercent / 100, 0), 1),
        resetsAt,
      });
    }
  }
  return windows.sort((a, b) => (new Date(a.resetsAt ?? 0).getTime() - new Date(b.resetsAt ?? 0).getTime()) || a.label.localeCompare(b.label));
}

export function formatResetsAt(iso: string | null, now = new Date()): string | null {
  if (!iso) return null;
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return null;

  const minutes = Math.round((target - now.getTime()) / 60_000);
  if (minutes <= 0) return '곧 초기화';
  if (minutes < 60) return `${minutes}분 뒤 초기화`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}시간 뒤 초기화`;
  return `${Math.round(hours / 24)}일 뒤 초기화`;
}
