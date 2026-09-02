import { createClient } from '@supabase/supabase-js';
import { createInterface } from 'node:readline/promises';
import { env } from './env.mjs';
import { clearSession, loadSession, saveSession } from './session-store.mjs';

// 러너는 서버가 아니라 이 앱의 유일한 사용자 본인 세션으로 로그인해 RLS 적용을
// 받는다(§6) — service_role은 절대 쓰지 않는다(§19.2 #2, #3). 브라우저가 없는
// 백그라운드 프로세스라 매직링크 클릭 대신 같은 메일에 함께 오는 6자리 OTP
// 코드로 로그인한다.

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
  // shouldCreateUser: false를 주면 기존 사용자여도 "Signups not allowed for
  // otp"로 실패하는 것을 실제 로그인 시도로 확인했다 — 웹 로그인 폼과 동일하게
  // 기본값(true)으로 호출한다. 신규 계정 생성 자체는 Supabase Auth 쪽에서
  // 이미 단일 허용 이메일로 막혀 있다(§6 3층).
  const { error: otpError } = await supabase.auth.signInWithOtp({ email });
  if (otpError) throw new Error(`OTP 발송 실패: ${otpError.message}`);

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const code = (await rl.question(`${email}로 보낸 메일의 6자리 코드를 입력하세요: `)).trim();
  rl.close();

  const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
  if (error || !data.session) throw new Error(`인증 실패: ${error?.message ?? '세션을 받지 못했습니다.'}`);

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
