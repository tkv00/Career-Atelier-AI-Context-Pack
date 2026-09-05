'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// 라벨은 각 페이지가 스스로를 부르는 이름과 한 글자도 다르지 않아야 한다.
// 예전에는 "데이터고"를 눌러 "데이터 저장고"에 도착했고, "항해 일정"을 눌러
// "채용 캘린더"에 도착했다 — 7개 중 5개가 어긋나 있었다.
const NAV = [
  { id: '관제실', href: '/dashboard' },
  { id: '지원 일정', href: '/calendar' },
  { id: '경험 카드', href: '/experiences' },
  { id: '이력 정보', href: '/records' },
  { id: '면접 준비', href: '/interviews' },
  { id: '프롬프트', href: '/prompts' },
  { id: '실행 기록', href: '/activity' },
];

export function NavRail() {
  const pathname = usePathname();
  return (
    <nav>
      {NAV.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.id}
            href={item.href}
            className={active ? 'nav-button active' : 'nav-button'}
            aria-current={active ? 'page' : undefined}
          >
            {item.id}
          </Link>
        );
      })}
    </nav>
  );
}
