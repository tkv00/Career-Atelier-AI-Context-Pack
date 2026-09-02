// 구독 사용량 읽기.
//
// 어떤 CLI도 "남은 토큰"을 물어보는 명령을 주지 않는다(`codex login status`는
// 로그인 여부만, `claude auth status`는 플랜 이름만 준다). 대신 실행 중
// 스트림에 실려 오는 값을 이미 run_events에 그대로 저장해 두고 있어서, 그걸
// 되읽으면 별도 테이블 없이 실제 수치를 보여줄 수 있다(2026-09-02 실측).
//
//  - Claude  : rate_limit_event.rate_limit_info.unifiedWindows
//              → 5시간·7일 창의 사용률(0~1)과 초기화 시각. 이게 진짜 "잔량"이다.
//  - Codex   : turn.completed.usage
//              → 실제 토큰 수. 다만 한도를 안 주므로 잔량은 계산할 수 없다.
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

// Codex의 turn.completed.usage를 합산한다. 캐시 읽기는 과금·한도에 거의
// 영향이 없어 빼고, 실제로 소모되는 입력·출력만 센다.
export function sumCodexTokens(payloads: unknown[]): number {
  let total = 0;
  for (const payload of payloads) {
    const usage = asRecord(asRecord(payload)?.usage);
    if (!usage) continue;
    for (const key of ['input_tokens', 'output_tokens']) {
      const value = usage[key];
      if (typeof value === 'number' && Number.isFinite(value)) total += value;
    }
  }
  return total;
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
