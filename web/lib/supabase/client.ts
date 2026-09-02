'use client';

import { createBrowserClient } from '@supabase/ssr';
import { env } from '@/lib/env';
import type { Database } from './database.types';

// 브라우저에서 쓰는 클라이언트. anon 키만 쓴다 — RLS(§5)가 실제 방어선이다.
export function createClient() {
  return createBrowserClient<Database>(env.supabaseUrl, env.supabaseAnonKey);
}
