# v2 외부 서비스 준비 (1단계 완료를 위해 사용자가 직접 해야 하는 일)

`docs/DESIGN-V2-CLOUD.md`의 코드(스키마·RLS·`web/` 앱)는 다 준비돼 있다. 여기 세 가지는
AI가 대신 만들 수 없는 부분이다 — 각 서비스의 계정 소유자만 할 수 있는 동작이라서다.
2026-08-31 확인: 클라우드 이전 승인함, Cloudflare Access 쓰기로 함, 계정은 아직 없음.

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
   `supabase/migrations/`의 3개 파일이 순서대로 적용된다 (`supabase/README.md` 참고).
4. Authentication → Providers → Email에서 **"Allow new users to sign up"을 끈다.**
   이게 §6 3층("허용 이메일 1개")의 실제 강제 지점이다. 그런 다음
   Authentication → Users에서 본인 이메일 1개만 초대(invite)한다.
5. Authentication → URL Configuration에서 Redirect URLs에
   `https://<너의-도메인>/auth/confirm` (Cloudflare Access 뒤 도메인 확정 후)과
   로컬 개발용 `http://localhost:3000/auth/confirm`을 등록한다.

## 2. Vercel 프로젝트

1. 이 리포를 Vercel에 연결한다 (GitHub 연동 또는 `vercel` CLI).
2. **Root Directory를 `web/`로 설정한다.** (Project Settings → General → Root Directory)
   이렇게 하면 `runner/`, `app/`, `server/` 등 v1/러너 코드는 애초에 빌드 대상에서
   빠진다. `.vercelignore`는 그 위에 얹는 이중 안전장치다.
3. Environment Variables에 `web/.env.example`에 있는 두 개만 넣는다:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - (선택) `NEXT_PUBLIC_ALLOWED_EMAIL`
   **`SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` 종류는 여기에
   절대 추가하지 않는다.** `web/lib/env.ts`가 실수로라도 이런 이름이 설정돼 있으면
   빌드/런타임에서 즉시 에러를 낸다 — 안전장치이지 우회 대상이 아니다.
4. Deployment Protection (Settings → Deployment Protection)에서 Vercel Authentication을
   켠다. `*.vercel.app` 기본 도메인이 Cloudflare Access를 우회하는 구멍이 되지 않게
   막는 §6 2층이다.

## 3. Cloudflare Access (1층 방어, 패스키 2중 인증)

커스텀 도메인이 필요하다(연 1~2만 원 수준). 이미 쓰는 도메인이 있으면 그걸 서브도메인
(`career.example.com` 등)으로 붙여도 된다.

1. 도메인을 Cloudflare에 네임서버 이전(또는 CNAME 위임)한다.
2. Zero Trust → Access → Applications → **Add an application** → Self-hosted.
   도메인에 위 서브도메인을 지정하고 Vercel 배포 대상을 가리키게 한다.
3. Access Policy: **Include = email == 본인 이메일 1개만.** 그 외 모두 거부(기본값).
4. Authentication → Login methods에서 Google(또는 이메일) + **WebAuthn(패스키)를
   필수로 요구**하도록 설정한다. 이게 "모바일 2중 인증"의 실체다 — 휴대폰의
   지문/얼굴 인증이 두 번째 요소가 된다.
5. Vercel 프로젝트의 커스텀 도메인으로 이 서브도메인을 연결한다(Vercel → Domains).

## 1단계 완료 판정 재확인 (`docs/DESIGN-V2-CLOUD.md` §19.4)

위 세 가지를 마치면 다음 두 가지로 확인한다.

- **로그인 안 한 브라우저로 도메인 접근 → Cloudflare Access 로그인 화면에서 막힘.**
  (이건 Cloudflare 쪽에서만 확인 가능 — 로컬 재현 불가)
- **anon 키로 REST 직접 호출 → 0행 반환.** 이건 이미 로컬 Postgres로 검증했고
  (`supabase/README.md` 참고), 실제 프로젝트에 `db push` 한 뒤 같은 방식으로
  한 번 더 확인하면 된다.

## v1 데이터 이관 (§15)

1. v1 앱에서 설정 → 전체 내보내기로 백업 JSON을 받는다.
2. 위 1번을 마친 뒤:
   ```bash
   cd scripts/migrate-v1-to-v2
   npm install   # 최초 1회
   SUPABASE_URL=https://<project-ref>.supabase.co \
   SUPABASE_ANON_KEY=<anon-key> \
     npm run migrate -- /path/to/career-atelier-backup-YYYY-MM-DD.json
   ```
   이메일 입력 → 받은 6자리 코드 입력 순서로 로그인하면 본인 세션으로만 데이터가
   들어간다. `service_role`은 쓰지 않는다. id 매핑표는
   `<백업파일 위치>/v2-migration/id-map-*.json`에 남는다.
3. v1 로컬 앱은 그대로 둔다 — §15에 따라 한 달간 읽기 전용으로 병행 후 정리한다.
