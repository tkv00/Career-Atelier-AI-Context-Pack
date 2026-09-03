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
          <header className="topbar">
            <div>
              <p className="eyebrow">ORBITAL CAREER COMMAND</p>
              <h1>
                Career Atelier <span>AI 채용 작전선 · CLOUD</span>
              </h1>
            </div>
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
