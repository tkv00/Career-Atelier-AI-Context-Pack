import type { ReactNode } from 'react';
import { createClient } from '@/lib/supabase/server';
import { SignOutButton } from './sign-out-button';
import { FocusTimer } from './focus-timer';
import { NavRail } from './nav-rail';
import { RouteAmbience } from './route-ambience';

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
          <div className="brand-mark" aria-label="Career Atelier">
            C<span>A</span>
            <i>04</i>
          </div>
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
          {children}
        </section>
        <FocusTimer />
      </main>
    </>
  );
}
