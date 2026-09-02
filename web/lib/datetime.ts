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
