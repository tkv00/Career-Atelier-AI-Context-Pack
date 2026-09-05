import type { ReactNode } from 'react';
import { createClient } from '@/lib/supabase/server';
import { SignOutButton } from './sign-out-button';
import { FocusTimer } from './focus-timer';
import { NavRail } from './nav-rail';
import { RouteAmbience } from './route-ambience';
import { BrandIcon } from '../brand-icon';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <RouteAmbience />
      <main className="app-shell">
        <aside className="side-rail" aria-label="주요 메뉴">
          <BrandIcon priority />
          <NavRail />
        </aside>
        <section className="workspace">
          {/* 예전에는 여기서 브랜드명과 "ORBITAL CAREER COMMAND"를 반복하고,
              바로 40px 아래 페이지 제목이 같은 문장을 또 한 번 찍었다. 지금
              화면이 어디인지는 페이지 제목이 말하므로 상단바는 계정만 맡는다. */}
          <header className="topbar">
            <div className="top-actions">
              <div className="avatar">{user?.email?.[0]?.toUpperCase() ?? '?'}</div>
              <span className="user-email">{user?.email}</span>
              <SignOutButton />
            </div>
          </header>
          {user?.user_metadata?.generated_password && (
            <div className="banner info" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, margin: '0 0 14px' }}>
              <span>설치 마법사가 자동으로 만들어 준 비밀번호를 아직 쓰고 있습니다.</span>
              <a href="/auth/update-password" className="secondary-button">비밀번호 바꾸기</a>
            </div>
          )}
          {children}
        </section>
        <FocusTimer />
      </main>
    </>
  );
}
