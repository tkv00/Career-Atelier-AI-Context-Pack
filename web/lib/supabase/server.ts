import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { env } from '@/lib/env';
import type { Database } from './database.types';

// 서버 컴포넌트/라우트 핸들러에서 쓰는 클라이언트. 여기도 anon 키만 쓴다.
// service_role은 이 파일은 물론 web/ 전체 어디에도 등장하지 않는다.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // 서버 컴포넌트에서 호출되면 쓰기가 무시된다 — 세션 갱신은 middleware.ts가 담당.
        }
      },
    },
  });
}
