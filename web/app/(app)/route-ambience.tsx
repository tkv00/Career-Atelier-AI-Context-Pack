'use client';

import { usePathname } from 'next/navigation';

// 화면마다 "같은 우주의 다른 좌표"로 느껴지게 하는 배경 레이어. 실제 연출은
// globals.css의 .space-ambience 변형이 하고, 여기서는 현재 경로에 맞는 변형
// 이름만 고른다. 장식 전용이라 aria-hidden이며 포인터 이벤트를 받지 않는다.
const AMBIENCE_BY_ROUTE: { prefix: string; variant: string }[] = [
  { prefix: '/dashboard', variant: 'deck' }, // 우주선 중앙 관제실
  { prefix: '/calendar', variant: 'chart' }, // 항해·지원 일정 지도
  { prefix: '/experiences', variant: 'archive' }, // 개인 기억 아카이브
  { prefix: '/interviews', variant: 'sim' }, // 시뮬레이션 훈련실
  { prefix: '/essays', variant: 'archive' }, // 문서 작성실
  { prefix: '/prompts', variant: 'sim' }, // 프롬프트 생성실 — 훈련실과 같은 계열(실험적 성격)
  { prefix: '/activity', variant: 'vault' }, // 데이터 저장고
];

export function RouteAmbience() {
  const pathname = usePathname();
  const variant = AMBIENCE_BY_ROUTE.find((route) => pathname.startsWith(route.prefix))?.variant ?? 'deck';
  return <div className={`space-ambience ${variant}`} aria-hidden="true" />;
}
