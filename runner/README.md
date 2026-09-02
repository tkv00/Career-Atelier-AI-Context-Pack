# runner/ — 3·4·5단계 완료, 6단계 일부·7단계 착수, 6번째 비서(소제목/Gemini) 추가

`docs/DESIGN-V2-CLOUD.md` §4·§6·§16·§19.3에 따라 잡 큐 폴링·claim·하트비트·
구독 인증 검사·환경변수 제거·스트림 중계를 구현했다(3단계). 4단계(에이전트
이식)는 **렌즈(검수)·뮤즈(작성)·루미(뉴스)·솔(기업조사)·모카(채용탐색)**
5개 비서 전부를 수직 슬라이스로 완성했고, 전부 실제 구독으로 라이브 검증
했다 — 잡 생성 → claim → 컨텍스트 팩 → 구조화 출력 → DB 저장까지 실제로
동작한다. 5단계(일정)는 **노바**(모카 저장 직후 결정론적 마감일 파싱 →
`calendar_events` 동기화)와 15시 자동 채용 탐색 스케줄러까지 구현·라이브
검증했다. 6단계(문항·제안)는 붙여넣기 파서와 JD 자동 연결까지 완료했고
**인라인 제안은 사용자 결정으로 범위에서 뺐다.** 7단계(다듬기)는 실행
기록 대시보드(프로바이더 아이콘 구분)를 시작으로 착수했다. 그리고
**6번째 비서 소제목**을 Gemini(정확히는 Antigravity CLI)로 새로 붙였다.
자세한 내용은 아래 각 단계 절 참고.

## 파일

| 파일 | 역할 |
|---|---|
| `index.mjs` | CLI 진입점(`login`/`logout`/`start`), 폴링·claim·하트비트 루프 |
| `execute.mjs` | 프로바이더 공통 실행기 — 스트림 파싱, 200ms 배칭, 유료 초과 감지 |
| `safety.mjs` | v1(`server/index.mjs`)에서 이식한 안전장치 — 상수, UI에서 끌 수 없음 |
| `providers/codex.mjs`, `providers/claude.mjs`, `providers/gemini.mjs` | CLI 인자 구성 (§9 매트릭스 + 아래 소제목 절) |
| `context-pack.mjs` | 6개 비서 각각의 컨텍스트 팩 + 구조화 출력 스키마 생성 |
| `nova.mjs` | 노바 — 마감일 결정론적 파싱(1단계) + `calendar_events` 동기화 |
| `scheduler.mjs` | 매일 15시(KST) 자동 채용 탐색 트리거 여부 판정(§12) |
| `lib/env.mjs` | `.env` 로더 |
| `lib/keychain.mjs` | macOS 키체인 read/write/delete (`security` CLI) |
| `lib/supabase-client.mjs` | 이메일 OTP 로그인, 세션을 키체인에 저장·자동 갱신 |

## 상시 러너 기기

사용자가 "노트북뿐"이라고 확인했다(2026-08-31). 매일 15시 자동 채용 탐색(§12)은
5단계에서 "노트북이 켜져 있을 때만" 실행되는 형태로 구현한다.

## 러너의 Supabase 로그인

이 앱은 매직링크 로그인만 지원하는데 러너는 브라우저가 없는 백그라운드
프로세스다. 그래서 매직링크 메일에 함께 오는 **6자리 OTP 코드**로 로그인한다
(`supabase/templates/magic_link.html`에 코드 표시를 추가함). service_role
키는 쓰지 않는다 — 러너도 앱의 유일한 사용자 세션으로 로그인해 RLS를 그대로
적용받는다(§6, §19.2 #2·#3).

세션(access/refresh token)은 **macOS 키체인**(`career-atelier-runner` 항목)에만
저장한다. 리프레시 토큰 로테이션이 켜져 있어(`config.toml`
`enable_refresh_token_rotation`) 갱신될 때마다 키체인 값도 같이 갱신한다.

## 사용법

```bash
cd runner
npm install
cp .env.example .env   # SUPABASE_URL / SUPABASE_ANON_KEY 채우기 (web/.env.local과 동일한 값)
npm run login           # 이메일 입력 → 메일의 6자리 코드 입력
npm run start            # 폴링 시작
```

첫 실행 시 `runners` 테이블에 `approved=false`로 등록된다. 웹 대시보드의
"러너" 섹션에서 승인해야 잡을 집는다.

## 안전 상수 (UI에서 끌 수 없음, `safety.mjs`)

일일 실행 상한 40회 · 동시 실행 1개 · 단일 실행 타임아웃 상한 15분 ·
재시도 0회 · 잡 유효기간 6시간 · 하트비트 15초(90초 넘게 끊기면 클라우드
쪽에서 `queued`로 되돌림).

## 검증

`npm run verify`에 준하는 것을 아직 이 폴더에 스크립트로 넣지 않았다(§19.5는
v1의 `scripts/verify-local.mjs` 계승을 요구 — 다음 손질 때 추가 예정). 모의
CLI(PATH 최우선, 실제 Codex/Claude 미호출)로 확인한 것: `providerStatus`/
`assertSubscriptionProvider`의 구독/비구독 판정, `runProvider`의 JSONL 스트림
파싱과 200ms 배칭, Claude `rate_limit_event` 유료 초과 감지 →
`blocked_paid_overage` 즉시 중단.

**실제 Supabase 로그인 + 실제 Codex 구독으로 전 구간 라이브 테스트도 완료했다**
(2026-09-01): 러너 로그인(이메일 OTP) → 등록(`approved=false`) → 대시보드/SQL로
승인 → 잡 생성 → 5초 내 claim → 실제 `codex exec` 실행 → `run_events` 스트림
기록 → `agent_runs`/`jobs` 모두 `completed`, 출력 정확히 확인. 이 과정에서 실제
버그 3개를 잡았다:

1. `claim_next_job`이 "없음"을 bare `null`이 아니라 전 필드 `null`인 row로
   반환하는 경우가 있어 `!job` 체크만으론 안 걸러졌다 → `!job.id`도 같이 확인.
2. 프로바이더 stdio를 `'ignore'`로 두면 Codex가 "stdin이 파이프면 이어붙인다"를
   시도하다 tty 없는 헤드리스 환경에서 `os error 2`로 죽었다 → 실제 파이프를
   열고 즉시 닫아 EOF를 준다.
3. **가장 치명적이었던 버그**: `context-pack.mjs`가 `{root, contextDir,
   outputDir}`를 반환하는데 `index.mjs`는 `{workspace, contextDir}`로
   구조분해하고 있었다. 존재하지 않는 키라 `workspace`가 `undefined`였고,
   `-C undefined`가 그대로 Codex 커맨드라인에 들어가 항상 실패했다. 모의 CLI
   테스트는 `workspace`를 하드코딩해서 호출했기 때문에 이 버그를 못 잡았다 —
   실제 라이브 테스트로만 드러났다.

**렌즈(검수) 수직 슬라이스도 실제 Claude 구독으로 라이브 테스트했다**
(2026-09-01): 경험 카드가 하나도 없는 상태에서 "네이버에서 매출 300%
향상시켰다" 같은 근거 없는 문장을 넣은 자소서를 검수 요청 → `fact_error`/
`overclaim`으로 정확히 잡아내고 구체적 수정 제안까지 스키마대로 반환함을
확인했다. 이 과정에서 §9 문서 예시와 실제 Claude Code CLI(2.1.252) 동작이
다른 부분을 2개 더 찾았다:

4. `--json-schema`는 §8 예시(`"$WS/schema/review.json"`)처럼 파일 경로가
   아니라 **JSON 문자열 자체**를 요구한다(`claude -p --help`로 확인). 파일
   경로를 주면 `JSON Parse error: Unrecognized token '/'`로 즉시 실패한다.
5. `-p`(`--print`) + `--output-format stream-json` 조합은 **`--verbose`가
   필수**다. 없으면 "When using --print, --output-format=stream-json
   requires --verbose"로 실패한다.

두 경우 다 CLI가 명확한 오류 메시지를 줘서 실제 호출 없이는 알 수 없었던
디테일이다 — 앞으로 새 에이전트를 붙일 때도 §9 표를 그대로 믿지 말고
`--help`로 먼저 확인할 것.

**뮤즈(작성) 수직 슬라이스도 실제 Codex 구독으로 라이브 테스트했다**
(2026-09-01): 진짜 경험 카드 1개("교내 스터디 운영진 활동", 출석률
40%→85%) + 문항("팀을 이끌어 목표를 달성한 경험을 서술하시오")으로 초안
생성 → 그 경험만 근거로 자연스러운 초안이 나오고, evidence 배열의
`experience_id`가 전부 실제 카드 id와 정확히 일치함을 확인했다(§14 2·3겹).
3겹(가짜 id 탐지) 필터 로직도 합성 데이터로 별도 검증했다. 이 과정에서 실수
2개를 더 겪었다 — 둘 다 기록해 둔다:

6. **코드를 고치고 러너를 재시작하지 않아 옛날 코드로 계속 실패했다.**
   Node는 핫리로드가 안 된다 — `index.mjs`/`context-pack.mjs` 등을 고쳤으면
   `npm run start`를 다시 실행해야 반영된다. 당연한 얘기 같지만 실제로
   이걸 놓쳐서 "안 고쳐진 것처럼 보이는" 잡 실패를 두 번 만들었다.
7. **OpenAI 구조화 출력(Codex의 `--output-schema`)은 모든 object 레벨에
   `additionalProperties: false`를 명시해야 한다.** 없으면 CLI가 아니라
   OpenAI API 자체가 `invalid_json_schema` 400 에러를 낸다
   (`WRITER_OUTPUT_SCHEMA`에 반영함). Claude의 `--json-schema`는 이 제약이
   없었다(§14 예시 결과에 스키마에 없던 `short_summary` 필드가 그대로 붙어
   나왔다) — 프로바이더마다 구조화 출력 엄격도가 다르다는 뜻이니, 새
   스키마를 만들 때 프로바이더별로 실제 호출로 확인할 것.

**나머지 세 비서(루미·솔·모카)도 실제 구독으로 라이브 검증했다**(2026-09-01).
셋 다 Codex의 자동 `web_search` 도구(모델이 필요하면 알아서 검색 — CLI
플래그 불필요, §9 실측)로 실제 웹 검색을 했고, 실제 URL·날짜·수치가 나왔다:

- **루미**: 관심분야 미설정 상태에서 IT/채용 시장 뉴스 4건을 실제 출처(연합뉴스·Axios·Fast Company 등)와 함께 정확히 조사.
- **솔**: "토스 백엔드 엔지니어"로 조사 요청 → 2026년 실제 흡수합병 공시, 실제 재무제표 수치, 실제 기술 블로그 사례를 정확한 출처 URL과 함께 반환. 자소서 작성 각도 제안까지 구체적이었음.
- **모카**: 실제 채용 플랫폼(greetinghr.com 등) URL 4건을 찾았고, 경험 카드가 없는 상태에서 fit_score를 18~30%로 보수적으로 매김(프롬프트 지시 정확히 준수). 프로필 미설정 시에는 억지로 채우지 않고 빈 배열을 정직하게 반환함.

이 과정에서 모카에서 실제 버그 2개를 더 잡았다:

8. **`job_posts`의 유니크 인덱스가 partial index**(`unique (owner_id, url)
   where url <> ''`)라서, supabase-js `upsert()`의 `onConflict` 옵션으로는
   못 잡는다 — "no unique or exclusion constraint matching" 오류로 실제
   실행에서 확인했다. supabase-js upsert는 WHERE 조건이 붙은 부분 유니크
   인덱스를 타깃팅할 방법이 없다. v1(`server/index.mjs`)과 같은 방식 —
   select 후 있으면 update, 없으면 insert — 로 대체했다.
9. **`job_posts.deadline`은 `date` 컬럼인데, 모델이 "채용 시 마감"·"상시채용"
   같은 비-날짜 문자열을 그대로 반환해 insert 자체가 깨졌다.** `/^\d{4}-\d{2}-\d{2}$/`
   정규식으로 검증해 아니면 `null`로 저장하도록 방어 코드를 추가했고,
   프롬프트에도 형식을 명시했다(원문 보존은 5단계 `calendar_events.raw_deadline_text`
   몫 — job_posts엔 그 컬럼이 없다).

## 5단계(일정) — 노바 + 15시 스케줄러

노바는 §11대로 "대부분의 경우 LLM을 안 쓴다"를 따라 결정론적 정규식
파싱(ISO 날짜·`N월 N일`·`N/N`·`D-N`)만으로 1단계를 구현했다. 모카가
`job_posts` 한 건을 저장할 때마다 바로 이어서 `syncCalendarEvent`가
호출되어(§12 "모카 완료 시 자동 연쇄") `calendar_events`를 만들거나
갱신한다. 파싱에 실패하면 `confidence='needs_review'`로 남기고(2주 뒤로
임시 배정), 캘린더 페이지에서 노란 배지로 표시한다. LLM 폴백(§11 2단계)은
아직 미구현이다 — 현재 커버리지로도 §16 완료판정은 통과하지만, 애매한
마감일 표기("상시채용" 등)는 전부 "확인 필요"로만 남는다.

15시 스케줄러(`scheduler.mjs`)는 `node-cron` 없이 기존 폴링 하트비트
위에 얹었다 — 매 하트비트마다 "오늘 KST 날짜 ≥ 트리거 시각이고 오늘 아직
안 돌았으면 실행"만 확인하는 상태 파일(`~/.career-atelier/scheduler-state.json`)
방식이라, 노트북이 15시에 꺼져 있어도 그날 안에 켜지면 실행되고 하루가
넘어가면 소급 실행하지 않는다. 날짜 계산 로직은 목(mock) 타임스탬프로
단위 테스트했지만, **실제 시계가 15시를 넘기는 순간을 기다려 종단
검증하지는 못했다** — 다음 15시 이후 러너가 켜져 있을 때 첫 자동 실행
로그를 직접 확인할 것.

**노바도 모카의 실제 저장 결과로 라이브 검증했다**(2026-09-01): 실제
Codex 구독으로 모카가 찾은 채용 공고 4건(선시안·LinqAlpha×2·아트라미)을
저장 → 노바가 즉시 `calendar_events` 4건을 만들었고, 그중 "채용 시
마감"이라는 명시적 마감일 텍스트가 있던 1건은 `confidence='confirmed'`·
`raw_deadline_text="채용 시 마감"`으로, 나머지 3건은 명시적 마감일 텍스트가
없어 `confidence='needs_review'`로 정확히 갈렸다. 이 과정에서 버그 1개를
더 잡았다:

10. **`raw_deadline_text`에 명시적 마감일 텍스트가 없을 때 직무 설명
    전문이 그대로 저장됐다.** `syncCalendarEvent`가 마감일 *파싱*
    폴백으로는 `jobPost.description`도 시도하게 해뒀는데(날짜 패턴이
    설명 안에 섞여 있는 경우 대응), 파싱 실패 시 *저장*되는
    `raw_deadline_text` 값도 같은 `description`으로 떨어지도록 잘못
    짜여 있었다. 그 결과 캘린더 페이지의 "확인 필요" 배지 옆에 마감일
    원문 대신 채용 공고 설명 전체(최대 200자 잘림)가 떴다 — 마감일
    표기가 아닌 걸 마감일 표기처럼 보여줘 오해를 줬다. 파싱용 폴백과
    저장용 값을 분리해, `raw_deadline_text`는 모카가 반환한 명시적
    마감일 텍스트가 있을 때만 채우고 없으면 `null`로 고쳤다. 실제 저장된
    4건을 재생(replay)해 고친 코드로 다시 돌려 확인했다(선시안만
    `"채용 시 마감"`, 나머지 3건은 `null`).

**추가 결정 (2026-09-01): 상시채용은 조사하지 않는다.** "상시채용"·
"수시채용"·"채용 시 마감"·"채용 시까지" 같은 표기는 마감일이 아예 없는
채용이다 — 날짜를 지어내거나(+14일 임시값) "확인 필요"로 애매하게 남기지
않고, `isRollingHire()` 정규식으로 인식되면 `syncCalendarEvent`가 아예
`calendar_events`를 만들지 않는다(기존 이벤트가 있었다면 지운다). 정규식
매칭·날짜 파싱 회귀·fake supabase로 삭제/미생성 동작까지 17개 케이스로
검증했다(스크립트는 세션 scratchpad).

**15시 트리거가 실제로 KST 기준인지 검증(2026-09-01).**
`currentKstHour`가 `.getUTCHours()`(타임존 무관, 서버 로컬 설정에 안 흔들림)
기반으로 UTC+9를 고정 shift하는 방식이 맞는지, Node의 실제 IANA 타임존
DB(`Intl.DateTimeFormat({timeZone:'Asia/Seoul'})`)로 독립 계산한 값과
여러 UTC 타임스탬프(자정 넘어가는 경계, 1월·8월 등 서머타임 유무 무관
포함)에서 전부 대조해 일치함을 확인했다. 코드 변경은 없었다 — 기존
구현이 이미 맞았다.

## 6단계(문항·제안) — 붙여넣기 파서·JD 연결 완료, 인라인 제안은 범위 제외

§10 붙여넣기 파서(`web/lib/parse-questions.ts`)는 문서의 8개 테스트
케이스 전부 통과하고 실제 로그인 → 붙여넣기 → 저장 → 재붙여넣기 병합까지
라이브 검증했다. JD 입력(§10 후반)은 실행 다이얼로그의 텍스트 영역
자체는 4단계 때 이미 있었지만, 두 가지가 빠져 있었다: 모카가 찾은
공고에서 바로 자소서를 시작할 방법이 없었고(`startEssayForJobPost`
추가), "기업 조사 다시 요청"이 매번 새 `job_posts` 행을 만들어 고아
행이 쌓이고 모카의 `url`·`fit_score`가 사라졌다(연결된 job_post가 있으면
update하도록 수정). 둘 다 실제 로그인으로 라이브 검증했다.

**인라인 제안(§8 후반, 문단 단위 실시간 제안)은 사용자 결정으로 구현하지
않는다.** `essay_suggestions` 테이블과 `jobs.priority` 컬럼은 스키마만
존재하고 미사용 상태로 남는다.

## 7단계(다듬기) — 실행 기록 대시보드 착수

`web/app/(app)/activity/page.tsx` 신규. 5개 비서가 어떤 LLM 구독으로
돌았는지 한 화면에서 보여준다 — Codex(라임 배경 "GPT")와 Claude
Code(초록 배경 "CL") 원형 배지로 구분하고, 프로바이더별 실행
횟수·완료/실패 집계 카드 + 최근 100건 리스트(에이전트 한글명·상태·소요
시간)를 보여준다. `agent_runs` 테이블만 조회하며 새 컬럼·마이그레이션
없음. **실제 토큰 사용량 계측은 아니다** — CLI 스트림에서 usage/token
필드를 아직 뽑아내지 않아서(§13), 지금 계측 가능한 건 실행 횟수·상태·
소요시간뿐이다. 실제 쌓여 있던 검증 이력 13건(Codex 8·Claude 5)으로
라이브 확인했다 — 집계 숫자, 아이콘 배경색(getComputedStyle로 확인),
정렬 순서 전부 정확했다.

## 6번째 비서 — 소제목(Gemini, 실제로는 Antigravity CLI)

사용자 요청(2026-09-01)으로 추가. 완성된 자소서 본문을 읽고 문항 소제목을
15자 이내로 제안/수정한다(§14 evidence 3겹은 적용 안 함 — 새 주장을
만드는 게 아니라 본문 압축이라서. 대신 본문이 비어 있으면 실행을
거부한다). `essay_projects.subtitle` 컬럼에 저장하고, 다른 비서들처럼
AI 제안은 `artifacts`(kind='subtitle')에 먼저 쌓아 사용자가 [반영]을
눌러야 확정된다.

**"Gemini CLI"는 이미 없다 — Antigravity CLI를 대신 쓴다.** 설치 직후 첫
실행에서 `IneligibleTierError: This client is no longer supported for
Gemini Code Assist for individuals`를 만났다 — 조사해보니 구글이
2026-06-18부로 Gemini CLI의 개인 계정(무료·Google AI Pro/Ultra 구독 포함)
지원을 완전히 끊고 후속 도구 **Antigravity CLI**(바이너리명 `agy`,
`curl -fsSL https://antigravity.google/cli/install.sh | bash`로 설치)로
이전시켰다. 이건 이 세션의 지식 컷오프 이후 일어난 변화라 사용자에게
먼저 확인받고 진행했다. `agy`는 개인 Google 계정 OAuth를 지원하고
내부적으로 Gemini 3 계열 모델을 쓴다 — provider 값은 여전히 `gemini`로
남겨 사용자가 요청한 이름과 실제 화면 라벨("Gemini(Google 계정)")을
일치시켰다.

`agy`의 인자는 Claude Code와 거의 같다(`-p`, `--add-dir`, `--model`,
`--effort`, `--json-schema`) — 그래서 `providers/gemini.mjs`는 claude.mjs를
본떠 만들었다. 다만 실측(2026-09-01)해보니 세 군데가 Claude와 달랐다:

1. **`--mode plan`은 "읽기전용 실행"이 아니라 "실행하지 않고 계획서
   파일만 써서 사용자 확인을 기다리는" 워크플로우다.** Claude의
   `--permission-mode plan`(§9 표의 통념)과 이름은 같지만 의미가 다르다
   — 헤드리스 단발 실행(`-p`)에서 이 모드를 쓰면 응답이 텅 빈다.
   `--mode accept-edits`로 바꿔야 그 자리에서 바로 실행하고 결과를 낸다.
2. **`--json-schema`를 쓰면 최종 데이터는 `response`가 아니라
   `structured_output` 필드에 따로 온다.** `response`는 사람이 읽는
   자유 텍스트(가끔 "계획서를 작성했습니다" 같은 메타 설명만 담김)이고,
   실제 스키마 준수 객체는 `structured_output`이다.
3. **스키마 각 필드에 `description`을 반드시 채워야 한다.** 없으면
   모델이 "작업을 완료했다"는 메타 요약을 필드에 채워 넣는 오작동을
   보였다(예: `subtitle` 필드에 실제 소제목 대신 "소제목 제안 완료"가
   들어옴) — description으로 "이건 메타 설명이 아니라 진짜 산출물이다"를
   명시하니 정확히 원하는 값이 나왔다.

인증 상태 확인도 Codex/Claude와 다르다 — `agy`엔 `login status`/`auth
status` 같은 쿼터 안 쓰는 전용 서브커맨드가 없다. 대신 `agy models`(모델
목록 조회, 추론 자체는 안 함)의 성공 여부로 판별한다 — `childEnvironment()`가
이미 `GEMINI_API_KEY`/`GOOGLE_GENAI_USE_VERTEXAI` 등을 지운 환경에서
실행하므로, 그 상태로 성공했다는 것 자체가 API 키/Vertex 경로가 아니라
개인 계정 OAuth라는 근거가 된다.

**실제 Google 계정 구독으로 라이브 검증했다**(2026-09-01, 계정
tkv0000@yu.ac.kr — 이 앱의 사용자 계정과는 다른, 별도의 AI 도구
구독 계정이다. Codex가 OpenAI 계정으로, Claude가 Anthropic 계정으로
로그인하는 것과 같은 성격): 실제 자소서 본문("3개월간 목표를 정량화해
출석률을 85%까지 끌어올렸다") → 잡 큐 → 러너 claim → Antigravity CLI
실행 → `{"subtitle":"목표 정량화로 출석률 85%","rationale":"..."}` 정확히
스키마 준수 → artifacts 저장 → 에디터에 표시 → [반영] 클릭 →
`essay_projects.subtitle`에 정확히 반영까지 전 구간 확인했다. 본문에
없는 사실을 지어내지 않고 본문 표현만 그대로 압축한 것도 확인했다.

**부수 확인**: 이 라이브 테스트 도중 15시(KST)가 실제로 지나면서
5단계의 자동 채용 탐색 스케줄러가 처음으로 실전에서 트리거되는 걸
우연히 목격했다("15시 자동 채용 탐색 트리거 (모카 → 노바 연쇄)" 로그) —
5단계 README에 "실제 시계 기반 종단 테스트는 못 했다"고 남겨뒀던
부분이 이번에 저절로 해소됐다. 모카는 프로필/관심사가 비어 있어
채용공고 0건을 찾고 정상 종료했다(빈 프로필에서 억지로 채우지 않는다는
기존 검증과 일치하는 동작).

## 절대 Vercel에 포함되지 않음

리포 루트의 `.vercelignore`가 `runner/`를 명시적으로 제외한다. Vercel 프로젝트의
Root Directory를 `web/`로 설정하면 애초에 이 폴더가 안 올라가지만, 이중 안전장치로
남겨 둔다.
