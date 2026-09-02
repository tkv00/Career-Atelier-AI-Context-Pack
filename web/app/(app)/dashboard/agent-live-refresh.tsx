'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function AgentLiveRefresh({ enabled }: { enabled: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => router.refresh(), 2200);
    return () => window.clearInterval(timer);
  }, [enabled, router]);

  return null;
}
