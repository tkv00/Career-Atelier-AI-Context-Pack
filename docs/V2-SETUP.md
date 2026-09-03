# Supabase와 Vercel 수동 설정

`npm run setup`이 이 과정을 대부분 자동으로 해 준다([README.md](../README.md) 참고). 이 문서는 마법사를 쓰지 않고 손으로 직접 설정하고 싶을 때, 또는 Vercel 배포 설정을 확인할 때 참고한다.

## 1. Supabase 프로젝트

1. https://supabase.com 에서 새 프로젝트 생성 (리전은 서울에 가장 가까운 곳 권장)
2. 프로젝트 설정 → API에서 **Project URL**과 **anon public key**를 복사해 둔다.
   **service_role key는 어디에도 붙여넣지 않는다** — 이 키가 필요한 곳은 이 프로젝트
   전체에 없다.
3. 로컬에서:
   ```bash
   supabase login
   supabase link --project-ref <project-ref>
   supabase db push
   ```
   `supabase/migrations/`의 파일들이 순서대로 적용된다 (`supabase/README.md` 참고).
4. 단일 사용자 방어("첫 가입자가 이 인스턴스의 소유자, 이후 가입은 전부 거부")는
   `supabase/migrations/0018_first_user_becomes_owner.sql`의 `before_user_created`
   훅이 맡는다. `supabase db push`로 마이그레이션을 적용하면 함수는 이미 배포돼
   있고, `supabase config push`로 `config.toml`의 `[auth.hook.before_user_created]`를
   원격에 반영해야 실제로 훅이 켜진다 — 3단계의 `db push`만으로는 안 켜진다.
5. Authentication → URL Configuration에서 Redirect URLs에
   `https://<your-domain>/auth/confirm`과 로컬 개발용
   `http://localhost:3000/auth/confirm`을 등록한다.

## 2. Vercel 프로젝트

`npm run deploy`(리포 루트에서)가 아래 1~3단계를 전부 대신 해 준다 — GitHub
Import 없이 `vercel` CLI로 `web/`을 그대로 프로젝트에 연결하고, `web/.env.local`의
값을 환경변수로 설정한 뒤 배포한다. 손으로 하고 싶을 때만 아래를 따라간다.

1. 이 리포를 Vercel에 연결한다 (GitHub 연동 또는 `vercel` CLI).
2. **Root Directory를 `web/`로 설정한다.** (Project Settings → General → Root Directory)
   이렇게 하면 `runner/`는 애초에 빌드 대상에서 빠진다. `.vercelignore`는 그 위에
   얹는 이중 안전장치다.
3. Environment Variables에 `web/.env.example`에 있는 두 개만 넣는다:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   **`SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` 종류는 여기에
   절대 추가하지 않는다.** `web/lib/env.ts`가 실수로라도 이런 이름이 설정돼 있으면
   빌드/런타임에서 즉시 에러를 낸다 — 안전장치이지 우회 대상이 아니다.
4. Deployment Protection (Settings → Deployment Protection)에서 Vercel Authentication을
   켜서 프리뷰 배포가 누구에게나 열려 있지 않게 한다.

## 완료 확인

- 로그인 안 한 브라우저로 배포 URL에 접근 → `/login`으로 리다이렉트되는지 확인한다.
- `anon` 키로 REST를 직접 호출 → 0행이 반환되는지 확인한다(RLS가 걸려 있다는 뜻).
