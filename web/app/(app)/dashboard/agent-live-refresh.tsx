'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function AgentLiveRefresh({ enabled }: { enabled: boolean }) {
  const router = useRouter();

  useEffect(() => {
    // 대기 중에도 다른 화면에서 출발시킨 임무와 러너 연결 변화를 받아야 한다.
    const refresh = () => { if (document.visibilityState === 'visible') router.refresh(); };
    const timer = window.setInterval(refresh, enabled ? 2200 : 15000);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [enabled, router]);

  return null;
}
