# supabase/ — Career Atelier v2 스키마

`migrations/`에 1단계(기반) 스키마가 있다. `settings` 테이블은 이관하지 않는다 —
v2에서 안전 잠금은 DB 값이 아니라 러너 코드 상수로만 존재한다
(`docs/DESIGN-V2-CLOUD.md` §5, §19.2 #10).

| 파일 | 내용 |
|---|---|
| `0001_init_schema.sql` | v1 계승 테이블 12개 (owner_id 추가, jsonb/timestamptz 전환) |
| `0002_v2_tables.sql` | 신설 테이블(jobs 큐, runners, calendar_events, essay_questions, essay_autosaves, essay_suggestions) + `claim_next_job`/`reap_stale_jobs`/`expire_old_jobs` 함수 |
| `0003_rls_policies.sql` | 전 테이블 RLS 활성화 + `owner_id = auth.uid()` 정책. **service_role로 우회하지 않는다** |

## 로컬에서 검증하기 (계정 없이, 쿼터 소비 없이)

이 스키마는 Docker 기반 로컬 스택으로 실제 Postgres 위에서 검증했다 — 진짜 Supabase
프로젝트 없이도 RLS가 "다른 owner_id는 0행"을 강제하는지 그대로 확인할 수 있다.

```bash
brew install supabase/tap/supabase   # 최초 1회
supabase start                        # Docker로 로컬 Postgres+Auth+PostgREST 기동
```

기동하면 `ANON_KEY`, `SERVICE_ROLE_KEY`, `API_URL`(기본 http://127.0.0.1:54321),
Studio URL(http://127.0.0.1:54323), Mailpit(http://127.0.0.1:54324, 로컬 인증
이메일 — 비밀번호 재설정·러너 로그인 코드 — 확인용)이 출력된다. `web/.env.local`에
`API_URL`과 `ANON_KEY`를 넣으면
`web/`이 로컬 스택을 바라본다.

**주의**: 여기서 나오는 `SERVICE_ROLE_KEY`는 로컬 테스트 계정을 만들 때만 쓴다
(GoTrue admin API로 두 사용자 생성 → RLS 소유자 격리 검증). 이 키를 `web/`나
`runner/` 코드, `.env.local` 어디에도 넣지 않는다 — 그 순간 §19.2 #2를 어긴다.

RLS를 실제로 확인했던 절차(다시 실행하고 싶다면):

```bash
# 1) service_role로 테스트 계정 2개 생성 (admin API, 로컬 전용)
curl -X POST "$API_URL/auth/v1/admin/users" -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" -H "Content-Type: application/json" \
  -d '{"email":"owner-a@test.local","password":"testpass123!","email_confirm":true}'

# 2) anon 키만으로 REST 직접 호출 → [] (0행)
curl "$API_URL/rest/v1/experience_cards?select=id" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"

# 3) 로그인 세션으로는 본인 행만, 다른 owner_id 세션으로는 0행
```

2026-08-31에 이 절차로 확인됨: anon 0행, 위장 삽입 403, 소유자 A/B 교차 조회 모두
설계대로 통과. `web/`의 매직링크 로그인 → 세션 쿠키 → `/dashboard` 접근 → 비로그인
`/login` 리다이렉트까지 로컬 스택 기준으로 end-to-end 확인됨.

## 실제 Supabase 프로젝트에 적용하기 (계정 생성 후)

```bash
supabase login
supabase link --project-ref <project-ref>
supabase db push          # migrations/ 3개를 순서대로 적용
supabase gen types typescript --linked > ../web/lib/supabase/database.types.ts
```

`db push`는 `service_role`이나 대시보드의 SQL Editor를 통한 수작업 없이 마이그레이션
파일 순서 그대로 적용한다. 적용 후 Supabase 대시보드 → Authentication → Providers에서
**이메일 가입을 비활성화**하고(신규 계정 차단), 허용 이메일 1개만 초대해 쓴다(§6 3층).
