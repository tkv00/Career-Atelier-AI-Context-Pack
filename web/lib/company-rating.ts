// 모카가 조사한 잡플래닛 평점을 화면 문구로 바꾼다(요청 2026-09-06).
// 출처(잡플래닛)는 이 앱에서 항상 고정이라 값이 보이는 모든 곳에서 이
// 한 함수를 거치게 해, "잡플래닛에서 조사했다"는 표시를 빠뜨리지 않는다.
export function formatCompanyRating(rating: number | null): string {
  return rating === null ? '잡플래닛 없음' : `잡플래닛 ${rating.toFixed(1)}`;
}
