type AuthFailure = { code?: string; status?: number; message?: string };

export function authErrorMessage(error: AuthFailure, action: 'login' | 'signup' | 'forgot'): string {
  if (error.code === 'email_not_confirmed' || /email not confirmed/i.test(error.message ?? '')) return '가입 확인이 필요합니다. 메일함의 확인 링크를 먼저 열어 주세요.';
  if (error.status === 429 || error.code?.startsWith('over_')) return '요청이 많아 잠시 제한됐습니다. 잠시 후 다시 시도해 주세요.';
  if (error.code === 'weak_password') return '비밀번호가 보안 기준을 충족하지 않습니다. 8자 이상의 다른 비밀번호를 정해 주세요.';
  if (error.code === 'user_already_exists' || error.code === 'email_exists') return '이미 가입한 이메일입니다. 로그인하거나 비밀번호를 재설정해 주세요.';
  if (error.code === 'signup_disabled' || error.code === 'hook_error' || /only.*owner|single.*user|가입.*허용|소유자/i.test(error.message ?? '')) return '이 작업실은 첫 소유자 계정만 사용할 수 있습니다. 기존 계정으로 로그인하거나 설치 프로젝트를 확인해 주세요.';
  if (error.code === 'invalid_credentials' || /invalid login credentials/i.test(error.message ?? '')) return '이메일 또는 비밀번호를 확인해 주세요. 처음 사용한다면 먼저 계정을 만드세요. Supabase DB 비밀번호로는 로그인할 수 없습니다.';
  if (!error.status || error.status >= 500) return '인증 서버에 연결하지 못했거나 서버 설정에 문제가 있습니다. 연결 상태를 확인하고 다시 시도해 주세요.';
  return action === 'signup' ? '계정을 만들지 못했습니다. 이메일·비밀번호와 이 작업실의 가입 설정을 확인해 주세요.' : '요청을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.';
}

// 가입 성공 응답과 로그인 세션은 다르다. 이메일 확인이 켜져 있으면 세션이 없다.
export function signupOutcome(data: { session: unknown; user: { identities?: unknown[] } | null }): 'ready' | 'confirm' | 'existing' {
  if (data.session) return 'ready';
  if (data.user?.identities?.length === 0) return 'existing';
  return 'confirm';
}
