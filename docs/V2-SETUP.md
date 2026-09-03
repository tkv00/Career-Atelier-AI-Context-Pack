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
4. Authentication → Providers → Email에서 **"Allow new users to sign up"을 끈다.**
   이게 "허용 이메일 1개"를 실제로 강제하는 지점이다. 그런 다음
   Authentication → Users에서 본인 이메일 1개만 초대(invite)한다.
5. Authentication → URL Configuration에서 Redirect URLs에
   `https://<your-domain>/auth/confirm`과 로컬 개발용
   `http://localhost:3000/auth/confirm`을 등록한다.

## 2. Vercel 프로젝트

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
