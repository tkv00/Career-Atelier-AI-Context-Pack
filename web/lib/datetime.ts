// 날짜 표시는 반드시 타임존을 명시한다. toLocaleString('ko-KR')을 그냥 쓰면
// 서버(Vercel = UTC)와 브라우저(KST)가 서로 다른 문자열을 만들어 React
// 하이드레이션 불일치 오류가 난다 — 실제로 자소서 에디터에서 발생했다.
// 이 앱은 한국 사용자 1명 전용이라 Asia/Seoul로 고정하는 게 맞다.
const TIME_ZONE = 'Asia/Seoul';

export function formatDateTime(value: string | number | Date): string {
  return new Date(value).toLocaleString('ko-KR', { timeZone: TIME_ZONE });
}

export function formatDate(value: string | number | Date): string {
  return new Date(value).toLocaleDateString('ko-KR', { timeZone: TIME_ZONE });
}

export function formatTime(value: string | number | Date): string {
  return new Date(value).toLocaleTimeString('ko-KR', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit' });
}

/** <input type="time"> 값("HH:MM", 24시간제, KST)으로 되돌린다 — 편집기에
    기존 마감 시각을 다시 채워 넣을 때 쓴다. */
export function timeInputValue(value: string | number | Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '00';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';
  return `${hour}:${minute}`;
}

/** 마감까지 남은 시간 — 요청 2026-09-06(각 공고마다 남은 기간을 D-3/1시간전/
    3분전처럼 자동 표시). 하루 넘게 남았으면 날짜 단위, 하루 안쪽이면 시간
    단위, 그보다 가까우면 분 단위로 스스로 전환한다. value/unit은 큰 숫자 +
    작은 단위로 나눠 보여주는 배지(예: 다가오는 지원 일정 카드)를 위한 것이고,
    label은 그 둘을 합친 한 문장이 필요한 곳(표 안 등)을 위한 것이다. */
export type RemainingTime = { value: number; unit: string; label: string; pastDue: boolean; tone: UrgencyTone };

/** 남은 시간의 "급함" 단계. 예전에는 화면 세 곳이 모두 남은 시간을 무조건
    --danger로 칠했는데, D-45와 D-1이 같은 빨강이면 그 빨강은 "마감이 있다"는
    뜻일 뿐 "급하다"는 신호가 되지 못한다 — 공고 20개가 전부 빨간 배지를 달고
    있으면 눈이 그 색을 배경으로 처리해 버린다(진단 2026-09-08). 단계를 여기서
    한 번만 정해 두고 캘린더·카드·표가 같은 기준을 쓴다. */
export type UrgencyTone = 'now' | 'soon' | 'plan' | 'far' | 'past';

export function remainingLabel(value: string | number | Date, now: Date = new Date()): RemainingTime {
  const diffMs = new Date(value).getTime() - now.getTime();
  if (diffMs <= 0) return { value: 0, unit: '마감', label: '마감', pastDue: true, tone: 'past' };

  const diffMinutes = Math.ceil(diffMs / 60_000);
  if (diffMinutes < 60) return { value: diffMinutes, unit: '분 전', label: `${diffMinutes}분 전`, pastDue: false, tone: 'now' };

  const diffHours = Math.ceil(diffMs / 3_600_000);
  if (diffHours < 24) return { value: diffHours, unit: '시간 전', label: `${diffHours}시간 전`, pastDue: false, tone: 'now' };

  const diffDays = Math.ceil(diffMs / 86_400_000);
  return { value: diffDays, unit: '일 남음', label: `D-${diffDays}`, pastDue: false, tone: urgencyTone(diffDays) };
}

function urgencyTone(days: number): UrgencyTone {
  if (days <= 1) return 'now';
  if (days <= 5) return 'soon';
  if (days <= 14) return 'plan';
  return 'far';
}
