// web/에서 읽을 수 있는 환경변수는 이 두 개뿐이다. SUPABASE_SERVICE_ROLE_KEY 같은
// 이름을 실수로라도 참조하면 여기서 즉시 빌드/런타임 에러로 드러나게 한다
// (docs/DESIGN-V2-CLOUD.md §19.2 #2 — service_role 키를 Vercel에 두지 않는다).

const forbiddenServerVarNames = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'SERVICE_ROLE_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
];

for (const name of forbiddenServerVarNames) {
  if (process.env[name]) {
    throw new Error(
      `web/는 클라우드 면이며 이 값을 가지면 안 됩니다: ${name}. ` +
        'Vercel 프로젝트 환경변수 설정에서 제거하세요 (docs/DESIGN-V2-CLOUD.md §3, §19.2 #2).',
    );
  }
}

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`환경변수 ${name}이(가) 설정되지 않았습니다. web/.env.example을 참고하세요.`);
  }
  return value;
}

export const env = {
  supabaseUrl: required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: required('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  allowedEmail: process.env.NEXT_PUBLIC_ALLOWED_EMAIL || '',
};
