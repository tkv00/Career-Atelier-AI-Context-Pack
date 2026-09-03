import { createClient } from '@supabase/supabase-js';
import { createInterface } from 'node:readline/promises';
import { env } from './env.mjs';
import { clearSession, loadSession, saveSession } from './session-store.mjs';

// 러너는 서버가 아니라 이 앱의 유일한 사용자 본인 세션으로 로그인해 RLS 적용을
// 받는다(§6) — service_role은 절대 쓰지 않는다(§19.2 #2, #3). 웹 로그인과 동일하게
// 이메일+비밀번호로 인증한다. 예전에는 이메일로 발송되는 6자리 코드(OTP)를 썼지만,
// Supabase 기본 메일 발송 한도(시간당 소량)에 걸려 두어 번만 실패해도 한동안
// 로그인이 막히는 문제가 있었다 — 비밀번호 인증은 메일을 보내지 않으므로 이 한도의
// 영향을 받지 않으면서도 본인 세션 로그인(RLS 격리)은 그대로 유지한다.

function newClient() {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: true },
  });
}

function persist(session) {
  if (!session) return;
  void saveSession(JSON.stringify({ access_token: session.access_token, refresh_token: session.refresh_token }));
}

export async function loginInteractive(email) {
  const supabase = newClient();
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const password = (await rl.question(`${email} 계정의 비밀번호를 입력하세요: `)).trim();
  rl.close();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`로그인 실패: ${error?.message ?? '세션을 받지 못했습니다.'}`);

  persist(data.session);
  return data.session.user;
}

export async function logout() {
  await clearSession();
}

// 반환된 supabase 클라이언트는 토큰이 자동 갱신될 때마다(리프레시 토큰 로테이션
// 포함, config.toml enable_refresh_token_rotation) 세션 파일에 다시 저장한다 —
// 그러지 않으면 재시작 후 로그인이 끊긴다.
export async function connectAsRunner() {
  const stored = await loadSession();
  if (!stored) return { supabase: null, authenticated: false, user: null };

  let parsed;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return { supabase: null, authenticated: false, user: null };
  }

  const supabase = newClient();
  const { data, error } = await supabase.auth.setSession({
    access_token: parsed.access_token,
    refresh_token: parsed.refresh_token,
  });
  if (error || !data.session) return { supabase: null, authenticated: false, user: null };

  supabase.auth.onAuthStateChange((_event, session) => persist(session));

  return { supabase, authenticated: true, user: data.session.user };
}
