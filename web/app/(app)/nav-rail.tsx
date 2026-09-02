'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// 현재 위치 표시가 없으면 어느 구역에 있는지 알 수 없어 관제실 은유가 깨진다.
// aria-current까지 함께 붙여 스크린리더에도 현재 위치를 알린다.
const NAV = [
  { id: '관제실', href: '/dashboard', icon: '⌂' },
  { id: '항해 일정', href: '/calendar', icon: '◷' },
  { id: '기억 아카이브', href: '/experiences', icon: '✦', agent: true },
  { id: '나의 정보', href: '/records', icon: '▦' },
  { id: '면접 훈련실', href: '/interviews', icon: '◎' },
  { id: '프롬프트 생성실', href: '/prompts', icon: '◇' },
  { id: '데이터고', href: '/activity', icon: '▤' },
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
            title={item.id}
            aria-current={active ? 'page' : undefined}
          >
            {item.agent ? <span className="nav-muse-agent" aria-hidden="true" /> : <span aria-hidden="true">{item.icon}</span>}
            <small>{item.id}</small>
          </Link>
        );
      })}
    </nav>
  );
}
