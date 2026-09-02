# Career Atelier v2 — 클라우드 웹 + 로컬 러너 설계안

작성일: 2026-08-31
대상: v1(로컬 전용 SQLite 앱) → v2(다기기 웹 + 구독 LLM 로컬 실행)
상태: 설계 확정 전 초안. 구현 착수 전 §2의 불가능 판정에 대한 사용자 승인이 필요하다.

---

## 0. 한 문단 요약

요구사항 17개 중 **13개는 그대로 가능하고, 4개는 형태를 바꿔야 가능하며, 그중 1개(자소설닷컴 서버 자동 수집)는 불가능**하다.

가장 중요한 결론은 이것이다. **Vercel 위에서는 구독 LLM을 절대 실행할 수 없다.** 따라서 v2는 하나의 서버가 아니라 두 개의 면(plane)으로 나뉜다.

- **클라우드 면** (Vercel + Supabase): 화면, 데이터, 인증, 1분 자동저장, 캘린더, 스케줄. **LLM을 절대 실행하지 않는다.**
- **로컬 러너 면** (내 컴퓨터 중 켜져 있는 것): Codex CLI와 Claude Code의 구독 로그인을 쥐고, 클라우드의 작업 큐를 아웃바운드로만 물어 와서 실행하고 결과를 되돌려 놓는다.

이 분리 덕분에 **글쓰기·열람·자동저장은 어디서든 언제든 되고, AI 실행만 러너가 켜져 있을 때 된다.** 이건 타협이 아니라 요구사항 4(구독제만 사용, 추가 비용 0)를 지키는 유일한 구조다.

---

## 1. 왜 Vercel에서 LLM을 못 돌리는가

이건 구현 난이도 문제가 아니라 구조적 불가능이다. 세 가지 이유가 각각 독립적으로 치명적이다.

**첫째, 인증이 기기에 묶여 있다.** Codex의 ChatGPT 로그인과 Claude Code의 Claude 로그인은 `~/.codex/`, `~/.claude/`와 macOS 키체인에 있는 OAuth 세션이다. 이걸 Vercel로 옮기려면 토큰을 서버 환경변수에 넣어야 하는데, 그 순간 v1이 지켜 온 "로그인 정보는 브라우저·DB·백업·소스에 저장하지 않는다"가 무너진다. 서버가 털리면 내 ChatGPT와 Claude 계정이 통째로 털린다.

**둘째, 약관 위반이다.** 개인 구독 좌석은 사람이 대화형으로 쓰라고 파는 것이지, 헤드리스 서버 백엔드의 모델 공급원으로 쓰라고 파는 게 아니다. 계정 정지 위험을 감수할 이유가 없다.

**셋째, 실행 환경이 안 맞는다.** Vercel은 서버리스다. 프로세스가 요청 사이에 살아남지 않고, 실행 시간에 상한이 있고, 임의 바이너리(Codex CLI, Claude Code)를 설치해 상주시킬 수 없다. 기업 조사 한 건이 수 분씩 걸리는 에이전트 작업과는 태생이 다르다.

**따라서 "Vercel에 배포된 웹에서 내 구독 LLM이 돌아간다"는 요구는 성립하지 않는다.** 대신 "Vercel에 배포된 웹에서 작업을 지시하면, 내 컴퓨터가 그걸 실행한다"로 바꾼다. 사용자 경험은 거의 같다. 차이는 러너가 꺼져 있으면 AI 작업이 대기열에 쌓인다는 것 하나다.

---

## 2. 요구사항별 판정표

| # | 요구사항 | 판정 | 근거 / 대체 형태 |
|---|---|---|---|
| 1 | 다른 컴퓨터에서도 통합 | **가능** | 데이터는 Supabase 단일 원본. 기기별 SQLite 복사·병합을 폐기한다 |
| 2 | 웹 + 1분 자동저장 | **가능** | 클라우드만으로 완결. 러너 불필요 |
| 3 | A에서 작성 → B에서 수정 | **가능** | 낙관적 잠금 + 실시간 편집 표시. §7 |
| 4 | 구독 LLM만, 추가 비용 0 | **가능** | 단, **클라우드 실행 불가. 로컬 러너 필수** |
| 5 | 다양한 LLM 설정 | **가능** | 하네스에서 에이전트별 프로바이더·모델 지정. §9 |
| 6 | Vercel 배포 + 최고 보안 + 모바일 2FA | **부분 가능** | 웹·데이터·인증은 4중 방어로 가능. **LLM 실행부는 Vercel에 못 올린다.** §6 |
| 7 | 실시간 자소서 제안 | **부분 가능** | 키 입력 단위 인라인 제안은 **불가능**. 문단 단위 스트리밍 제안으로 대체. §8 |
| 8 | 자소설닷컴 문항·글자수·JD 자동 수집 | **불가능** | 서버 자동 로그인·크롤링 금지. **붙여넣기 임포트로 확정(2026-08-31).** §10 |
| 9 | 일정 에이전트 + 캘린더 자동 기록 | **가능** | 새 에이전트 노바 신설. 마감일 100% 자동 파싱은 불가 → 확인 대기 상태. §11 |
| 10 | 뉴스·채용 독립 실행 + 매일 15시 | **부분 가능** | 러너가 켜져 있을 때만 실행. 꺼져 있으면 지연 실행 후 6시간 경과 시 폐기. §12 |
| 11 | 자소서 플로우(조사 → 파일 세팅 → 작성) | **가능** | 컨텍스트 팩 패턴. §8 |
| 12 | 설계본 md 저장 | **완료** | 이 문서 |
| 13 | Supabase 사용 | **가능** | 무료 티어 제약 명시. §5 |
| 14 | 자소서 데이터 보관·열람 | **가능** | §7 |
| 15 | 프롬프트·컨텍스트·시스템·모델·사용량 조절 | **가능** | 실제 CLI 플래그로 확인함. 프로바이더별 지원 차이 있음. §9 |
| 16 | 토큰 사용량 최소화 | **가능** | 9가지 전략. §13 |
| 17 | 자소서 작성 시 내 경험 필수 참조 | **가능** | 스키마 강제 + 사후 대조 검증. §14 |

### 불가능하다고 명시하는 것 (4건)

1. **Vercel·Supabase 등 어떤 클라우드에서도 구독 LLM 직접 실행** — §1. 대체 없음. 러너 구조가 유일한 답이다.
2. **자소설닷컴 서버측 자동 로그인·문항 크롤링** — §10. **붙여넣기 임포트로 확정.** 브라우저 확장도 v2 범위 밖.
3. **키 입력 단위 인라인 제안(Copilot 방식)** — §8. 지연과 쿼터 양쪽에서 성립하지 않는다. 문단 단위로 대체.
4. **러너 전원이 꺼진 상태에서의 AI 실행** — §12. 물리적으로 불가능. 상시 러너 1대 지정을 권장한다.

### 조건부로만 되는 것 (3건)

5. **마감일 100% 자동 인식** — "상시채용", "채용 시 마감" 같은 공고가 흔하다. 파싱 실패는 `needs_review` 상태로 남기고 사용자가 확정한다.
6. **Supabase 무료 티어** — DB 500MB, 7일 무활동 시 프로젝트 일시정지. 자소서는 텍스트라 용량은 문제없고, 매일 15시 스케줄이 돌면 일시정지도 사실상 안 걸린다. 다만 이 두 가지가 있다는 걸 알고 쓴다.
7. **Vercel Hobby 플랜** — Cron이 하루 1회로 제한된다. 15시 1회면 정확히 맞는다. 단 Hobby는 상업적 사용 금지이므로 개인용을 유지해야 한다. (러너 자체 스케줄러를 쓰면 이 제약도 사라진다. §12에서 그쪽을 권장한다.)

---

## 3. 시스템 구조

```text
                          [ 내 기기: 노트북 A / 데스크톱 B / 휴대폰 ]
                                          │  HTTPS
                                          ▼
                          ┌─────────────────────────────────┐
                          │  Cloudflare Access (Zero Trust) │  ← 1차 관문
                          │  이메일 1개 허용 + 패스키(생체)  │     미인증은 여기서 차단
                          └─────────────────────────────────┘
                                          │
                                          ▼
      ┌──────────────────────────── 클라우드 면 ────────────────────────────┐
      │  Vercel (Next.js)                                                   │
      │   ├─ 자소서 에디터 · 1분 자동저장 · 버전 열람                        │
      │   ├─ 캘린더 · 채용 보드 · 경험 보관함                                │
      │   ├─ Prompt Lab · 하네스 · 실행 로그                                 │
      │   └─ 작업 큐에 job을 넣기만 한다 (LLM 호출 코드 0줄)                 │
      │                                                                     │
      │  Supabase (Postgres + Auth + Realtime + RLS)                        │
      │   ├─ 모든 데이터의 단일 원본                                         │
      │   ├─ jobs 큐 · agent_runs · run_events                              │
      │   └─ RLS: 전 테이블 owner_id = auth.uid(), 기본 거부                │
      └─────────────────────────────────────────────────────────────────────┘
                                          ▲
                     아웃바운드 전용 (인바운드 포트 0, 터널 없음)
                                          │
      ┌──────────────────────────── 러너 면 ────────────────────────────────┐
      │  Career Atelier Runner  ·  내 컴퓨터에서 상주 (Node 프로세스)        │
      │   ├─ jobs 큐 폴링/구독 → claim → 실행 → 결과 업로드                 │
      │   ├─ 구독 인증 검사 · API 환경변수 제거 · 유료 초과 차단             │
      │   ├─ 컨텍스트 팩 생성 → CLI 실행 → 스트림 중계                       │
      │   ├─ Codex CLI    ── ChatGPT 구독 OAuth (이 기기 안에만)            │
      │   └─ Claude Code  ── Claude 구독 OAuth (이 기기 안에만)             │
      │                                                                     │
      │  ~/.career-atelier/  (러너 로컬 전용, 클라우드로 안 감)              │
      │   ├─ 러너 자격증명 → macOS 키체인                                    │
      │   └─ workspaces/<run_id>/  실행별 격리 작업 폴더                     │
      └─────────────────────────────────────────────────────────────────────┘
```

### 절대 넘지 않는 선

| 항목 | 클라우드에 있는가 |
|---|---|
| 자소서 본문·버전·경험 카드·공고·조사 결과 | **있다** (그래야 다기기가 된다) |
| 프롬프트·하네스·실행 로그 | **있다** |
| ChatGPT / Claude 로그인 토큰 | **절대 없다** |
| OpenAI / Anthropic API 키 | **절대 없다** (애초에 만들지 않는다) |
| Supabase `service_role` 키 | **절대 없다** (Vercel 환경변수에도 두지 않는다) |

v1이 "개인 데이터도 로컬에 둔다"였다면, v2는 **"개인 데이터는 내 Supabase에 두되, AI 자격증명은 끝까지 내 기기에 둔다"**로 선을 다시 긋는다. 다기기 요구를 받아들이면 앞의 것은 양보해야 하고, 뒤의 것은 양보할 수 없다.

---

## 4. 러너 프로토콜

러너는 서버가 아니다. **인바운드 포트를 열지 않고, 터널도 쓰지 않는다.** 오직 Supabase로 나가는 연결만 만든다. 공유기 설정, 방화벽 구멍, DDNS가 전부 필요 없다는 뜻이고, 외부에서 러너를 직접 때릴 표면이 애초에 존재하지 않는다는 뜻이다.

### 잡 생명주기

```text
queued ──claim──▶ running ──▶ completed
   │                 │
   │                 ├──▶ failed
   │                 ├──▶ cancelled            (사용자 중단)
   │                 ├──▶ blocked_auth         (구독 로그인 아님)
   │                 ├──▶ blocked_paid_overage (Claude 유료 초과 신호)
   │                 └──▶ waiting_for_reset    (구독 한도 도달)
   │
   └──expired──▶ expired  (생성 후 6시간 내 러너가 안 집으면 폐기)
```

v1의 상태 8종을 그대로 계승하고 `expired` 하나만 추가한다. 러너가 며칠 꺼져 있다가 켜졌을 때 밀린 잡이 한꺼번에 터지는 걸 막는 장치다.

### claim 규칙

동시에 여러 러너(노트북 A와 데스크톱 B가 둘 다 켜진 경우)가 같은 잡을 집으면 중복 실행으로 구독 쿼터가 두 배로 나간다. Postgres 함수로 원자적 claim을 구현한다.

```sql
create or replace function claim_next_job(p_runner_id uuid)
returns jobs language plpgsql security definer as $$
declare j jobs;
begin
  select * into j from jobs
   where owner_id = auth.uid()
     and status = 'queued'
     and created_at > now() - interval '6 hours'
   order by priority desc, created_at asc
   for update skip locked
   limit 1;
  if not found then return null; end if;
  update jobs set status='running', runner_id=p_runner_id, claimed_at=now()
   where id = j.id returning * into j;
  return j;
end $$;
```

`for update skip locked`가 핵심이다. 두 러너가 동시에 호출해도 서로 다른 잡을 가져가거나 한쪽이 빈손으로 돌아간다.

### 하트비트와 유령 잡 회수

러너는 15초마다 `runners.last_seen_at`을 갱신한다. `running` 상태인데 러너 하트비트가 90초 넘게 끊긴 잡은 클라우드 측 정리 작업이 `queued`로 되돌린다(재시도 1회 한정). 러너가 실행 도중 노트북을 닫아도 잡이 영원히 갇히지 않는다.

### 스트림 중계

Codex는 `--json`(JSONL 이벤트), Claude Code는 `--output-format stream-json --include-partial-messages`로 실행한다. 러너는 이 청크를 받아 `run_events`에 넣고, 웹은 Supabase Realtime으로 구독한다. 결과적으로 **브라우저에서 글자가 흘러나오는 걸 실시간으로 본다.** 요구사항 7의 "생성형 AI처럼"에 해당하는 체감은 여기서 나온다.

전송량을 줄이기 위해 청크는 200ms 단위로 묶어서 보낸다. 매 토큰마다 DB에 쓰면 무료 티어 대역과 행 수를 낭비한다.

---

## 5. 데이터 모델 (Supabase / Postgres)

v1의 13개 테이블을 계승하되, 다기기·큐·캘린더를 위해 조정한다. 모든 테이블에 `owner_id uuid not null references auth.users`가 붙고 RLS 기본 거부가 걸린다.

### 계승 (스키마 거의 그대로)

`profiles`, `experience_cards`, `job_posts`, `research_notes`, `prompt_templates`, `prompt_versions`, `harness_configs`, `essay_projects`, `essay_versions`, `agent_runs`, `run_events`, `artifacts`

`settings`는 없앤다. v1에서 이 테이블이 하던 안전 잠금(API 키 차단 등)은 **DB 값이 아니라 러너 코드의 상수**로 옮긴다. 값으로 두면 백업 조작이나 DB 접근으로 꺼질 수 있지만, 코드 상수는 그럴 수 없다. v1도 "가져오기 내용과 무관하게 다시 강제한다"로 이미 이 방향이었고, v2에서는 아예 저장을 안 하는 게 맞다.

### 신설

```sql
-- 작업 큐. 웹은 여기에 넣기만, 러너는 여기서 꺼내기만 한다.
create table jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  kind text not null,             -- news | jobs | schedule | company | writer | review | review_inline
  pipeline_id uuid,
  payload jsonb not null,         -- 컨텍스트 팩 재료 (본문 원문이 아니라 참조 id 위주)
  harness_snapshot jsonb not null,-- 실행 시점 하네스를 동결해 재현성 확보
  status text not null default 'queued',
  priority int not null default 0,-- 인라인 제안은 10, 야간 배치는 0
  runner_id uuid,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);

-- 러너 등록부. 신규 러너는 웹에서 수동 승인해야 잡을 집을 수 있다.
create table runners (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  device_name text not null,
  fingerprint text not null unique,
  approved boolean not null default false,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

-- 캘린더 (요구사항 9)
create table calendar_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  job_post_id uuid references job_posts(id) on delete cascade,
  title text not null,
  company text,
  event_type text not null,        -- deadline | interview | result | custom
  starts_at timestamptz not null,
  all_day boolean not null default true,
  source_url text,
  confidence text not null default 'confirmed', -- confirmed | needs_review
  raw_deadline_text text,          -- "상시채용" 원문 보존
  memo text,
  created_at timestamptz not null default now()
);

-- 자소서 문항 (요구사항 8, 11)
create table essay_questions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  job_post_id uuid references job_posts(id) on delete cascade,
  order_no int not null,
  question text not null,
  char_limit int,                  -- 목표/제한 글자 수
  char_limit_basis text,           -- with_spaces | without_spaces
  guide text,                      -- 문항 안내문
  source text not null,            -- manual | paste_import | extension
  created_at timestamptz not null default now()
);

-- 1분 자동저장 스냅샷 (명시 버전과 별개, 롤링 50개)
create table essay_autosaves (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  essay_id uuid not null references essay_projects(id) on delete cascade,
  content text not null,
  chars_with_spaces int not null,
  chars_without_spaces int not null,
  device_name text,
  created_at timestamptz not null default now()
);

-- 인라인 제안 (요구사항 7)
create table essay_suggestions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  essay_id uuid not null references essay_projects(id) on delete cascade,
  paragraph_hash text not null,    -- 같은 문단 재요청 캐시 키
  original text not null,
  suggested text not null,
  rationale text,
  category text,                   -- evidence_missing | overclaim | wordy | structure | tone
  status text not null default 'pending', -- pending | applied | dismissed
  created_at timestamptz not null default now()
);
```

`essay_projects`에는 `revision bigint not null default 0`을 추가한다. §7의 충돌 감지에 쓴다.

### RLS 정책 (모든 테이블 동일 패턴)

```sql
alter table jobs enable row level security;
create policy owner_all on jobs
  for all using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
```

정책을 만들기 전에는 `anon` 키로도 `service_role` 없이는 **한 행도 못 읽는다.** 이게 기본값이어야 한다.

---

## 6. 보안 설계 (요구사항 6)

"나만 쓰는데 최고 등급"이라는 요구는 사실 유리하다. 사용자가 1명이면 화이트리스트를 극단적으로 좁힐 수 있다.

### 4중 방어

**1층 — Cloudflare Access (Zero Trust).** 커스텀 도메인을 Cloudflare에 올리고 Access Application을 건다. 정책은 `email == 내 이메일` 단 하나. IdP는 Google, 그리고 **WebAuthn 패스키를 필수로 요구**한다. 휴대폰 지문/얼굴 인증이 두 번째 요소가 되고, 이게 요구사항 6의 "모바일 2중 인증"이다. TOTP보다 패스키를 권하는 이유는 피싱에 원천적으로 안 뚫리기 때문이다. 무료 플랜 50석이라 비용은 0이다.

인증을 통과하지 못한 요청은 **Vercel에 도달조차 하지 않는다.** 앱 코드의 버그가 노출로 이어질 경로가 하나 줄어든다.

**2층 — Vercel Deployment Protection.** `*.vercel.app` 기본 도메인은 Cloudflare 뒤에 못 넣으므로 여기가 우회로가 된다. Vercel Authentication을 켜서 프리뷰·기본 도메인 직접 접근을 막는다. 이걸 빼먹으면 1층 전체가 무의미해진다.

**3층 — Supabase Auth.** 앱 내부 세션. 허용 이메일 1개, MFA 활성화. Cloudflare가 뚫려도 앱은 여전히 잠겨 있다.

**4층 — RLS.** 위가 전부 뚫려도 `owner_id = auth.uid()` 없이는 데이터가 안 나온다. 기본 거부.

### 러너 보안

- **아웃바운드 전용.** 인바운드 포트 0, 터널 0. 외부에서 러너로 향하는 경로가 없다.
- **러너 자격증명은 macOS 키체인**에 넣는다. 파일·리포·환경변수 어디에도 평문으로 두지 않는다.
- **신규 러너는 수동 승인.** 새 기기가 큐에 붙으면 `approved=false`로 등록되고, 내가 웹에서 승인해야 잡을 집는다. 러너 토큰이 유출돼도 승인 단계에서 걸린다.
- **`service_role` 키는 러너에도 주지 않는다.** 러너는 전용 Supabase 계정으로 로그인하고 RLS 적용을 받는다.

### LLM 남용 방지 (요구사항 6 후반부)

"LLM을 함부로 쓰지 못하게"는 러너 쪽에서 강제하는 게 맞다. 웹이 뚫려도 웹은 잡을 큐에 넣을 수만 있고, 실제 소비 결정은 러너가 한다.

| 장치 | 값 |
|---|---|
| 일일 실행 상한 | 기본 40회 (러너 설정 파일, 초과 시 거부) |
| 동시 실행 | 1개 |
| 단일 실행 타임아웃 | 하네스 값, 상한 15분 |
| 잡 유효기간 | 6시간 (초과 시 `expired`) |
| 재시도 | 0회 (v1 계승) |
| 감사 | 모든 실행이 `agent_runs` + `run_events`에 기록, 웹에서 조회 |

### v1에서 그대로 가져오는 불변식

러너 코드의 상수로 박아 둔다. UI에서 끌 수 없다.

- 자식 프로세스에서 `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, `CLAUDE_CODE_USE_BEDROCK`, `CLAUDE_CODE_USE_VERTEX`, `CLAUDE_CODE_USE_FOUNDRY` 제거
- 실행 직전 `codex login status` / `claude auth status` 확인, 구독·OAuth가 아니면 `blocked_auth`
- Claude 유료 초과 신호 → `blocked_paid_overage` 즉시 중단
- 한도 도달 → 우회 없이 `waiting_for_reset`
- Codex는 `--sandbox read-only --ephemeral`, Claude Code는 `--permission-mode plan --restricted`
- API 키 입력란은 UI에 만들지 않는다

---

## 7. 자소서 에디터: 자동저장과 다기기 충돌 (요구사항 2, 3, 14)

### 자동저장

- **로컬 즉시**: 타이핑 시 IndexedDB에 계속 저장. 브라우저를 강제 종료해도 안 날아간다.
- **클라우드 1분**: 60초 주기 + 변경 있을 때만 + 마지막 입력 후 2초 디바운스. 변경이 없으면 요청 자체를 안 보낸다.
- **스냅샷**: `essay_autosaves`에는 10분마다 또는 500자 이상 변경 시에만 한 행. 매분 새 행을 만들면 무료 티어 행 수를 헛되이 쓴다. 롤링 50개 유지.
- **명시 버전**: 사용자가 "버전 저장"을 누를 때만 `essay_versions`에 불변 기록. v1 방식 계승.

### 충돌 해결

컴퓨터 A와 B에서 동시에 열어 놓는 상황은 반드시 온다. **조용한 덮어쓰기는 절대 하지 않는다** — v1의 비파괴 원칙을 그대로 잇는다.

```sql
update essay_projects
   set draft = $1, revision = revision + 1, updated_at = now()
 where id = $2 and revision = $3
returning revision;
```

`revision` 불일치로 0행이 반환되면 충돌이다. 이때:

1. 서버가 상대 버전을 함께 돌려준다.
2. UI에 "다른 기기에서 수정됨" 배너와 좌우 diff를 띄운다.
3. 사용자가 [내 것 유지] / [상대 것 가져오기] / [수동 병합]을 고른다.
4. **어느 쪽을 고르든 버려지는 쪽은 `essay_autosaves`에 보존한다.** 잃어버리는 글자가 없어야 한다.

**예방이 더 낫다.** Supabase Realtime Presence로 같은 자소서를 연 기기를 표시한다. 편집기 상단에 "데스크톱 B에서도 열려 있음"이 뜨면 대부분의 충돌은 애초에 안 생긴다.

### 오프라인

인터넷이 끊기면 IndexedDB에 계속 쓰고 배너로 알린다. 복구되면 자동 동기화하되, 그 사이 다른 기기가 수정했으면 위 충돌 흐름을 탄다.

---

## 8. 자소서 작성 플로우와 실시간 제안 (요구사항 7, 11, 17)

### 컨텍스트 팩 — 요구사항 11의 "파일로 세팅"

러너가 실행 작업 폴더에 파일을 쓰고, 에이전트에게 **그 폴더만** 근거로 쓰라고 지시한다. 프롬프트에 원문을 다 붙여넣지 않으므로 토큰도 아낀다(요구사항 16).

```text
~/.career-atelier/workspaces/<run_id>/
  context/
    00-INDEX.md              읽는 순서와 각 파일의 권한(근거로 인용 가능/금지)
    01-questions.md          자소서 문항 + 글자수 + 안내문
    02-job-description.md    JD 원문
    03-company-research.md   솔의 기업 분석서
    04-experiences.md        내가 선택한 경험 카드만 (id 부착)
    05-target-role.md        지원 직무 정의와 평가 포인트
    06-style-guide.md        문체 규칙, 금지 표현
  output/
    draft.md
    evidence.json
```

에이전트 호출은 이렇게 된다.

```bash
# 뮤즈 (Codex)
codex exec \
  -C "$WS" --skip-git-repo-check --ephemeral --ignore-user-config \
  -s read-only \
  -m "$MODEL" -c model_reasoning_effort="$EFFORT" \
  --output-schema "$WS/schema/writer.json" \
  -o "$WS/output/draft.md" \
  --json \
  "$PROMPT"

# 솔 / 렌즈 (Claude Code)
claude -p "$PROMPT" \
  --add-dir "$WS/context" \
  --model "$MODEL" --effort "$EFFORT" \
  --permission-mode plan --restricted \
  --append-system-prompt-file "$WS/system.md" \
  --output-format stream-json --include-partial-messages \
  --json-schema "$WS/schema/review.json"
```

### 흐름 (요구사항 11)

```text
[사용자가 시작 버튼을 누른 시점에만 실행]

1. 솔 — 기업·직무 조사
   입력: 기업명 + JD(요구사항 8) + 채용 URL
   출력: 03-company-research.md

2. 세팅 (LLM 안 씀, 코드가 한다)
   01-questions.md   ← essay_questions
   02-job-description.md ← job_posts.description
   04-experiences.md ← 사용자가 고른 경험 카드만
   05-target-role.md ← 직무 정의
   → 팩 무결성 검사: 04가 비어 있으면 실행 거부 (요구사항 17)

3. 뮤즈 — 자소서 작성
   컨텍스트 팩만 근거. output/draft.md + evidence.json

4. 검증 (LLM 안 씀)
   evidence.json의 experience_id가 04에 실재하는지 대조
   글자 수가 char_limit 안에 드는지 계산
   → 위반 시 evidence_violation 표시

5. 렌즈 — 교차 검수 (사용자가 원할 때)
```

### 실시간 제안 — 무엇이 불가능하고 무엇이 되는가

**불가능**: 키를 칠 때마다 인라인으로 회색 글씨가 따라 나오는 Copilot 방식. 이유가 두 개다. 첫째, 구독 CLI 호출은 프로세스 기동 포함 수 초에서 수십 초가 걸린다. 타이핑 속도를 못 따라간다. 둘째, 매 키 입력마다 호출하면 구독 쿼터가 몇 분 만에 소진된다. 요구사항 16과 정면으로 충돌한다.

**되는 것**: 문단 단위 제안. 체감은 충분히 "생성형 AI처럼"이다.

| 항목 | 설계 |
|---|---|
| 트리거 | 문단 완결(빈 줄) + 3초 유휴, 또는 사용자가 문단 옆 [제안] 클릭 |
| 전송 범위 | 해당 문단 ±1개, 문항, 글자수, **관련 경험 카드 요약만** — 전체 본문 안 보냄 |
| 캐시 | `paragraph_hash`로 중복 요청 차단. 안 바뀐 문단은 호출 자체를 안 한다 |
| 프로바이더 | 렌즈의 경량 프로파일 (`review_inline`): sonnet + `--effort low` |
| 표시 | 문단 옆 카드에 diff. 스트리밍으로 흘러나온다 |
| 반영 | [반영] 클릭 시 본문에 삽입 → 요구사항 7의 "자소서 칸에 배치" |
| 큐 우선순위 | `priority=10` — 배치 작업보다 먼저 처리 |
| 러너 오프라인 시 | 버튼이 "러너 대기 중"으로 바뀐다. 글쓰기는 계속 된다 |

새 에이전트를 만들지 않고 렌즈의 프로파일로 둔 이유는, 검수 관점의 프롬프트를 두 벌 유지하면 반드시 어긋나기 때문이다. 같은 프롬프트 계열에 하네스만 가볍게 바꾸는 게 관리도 토큰도 이득이다.

---

## 9. 하네스와 모델 제어 (요구사항 5, 15)

실제 CLI 플래그를 확인한 결과, 요구사항 15는 대부분 그대로 구현 가능하다.

### 프로바이더 지원 매트릭스

| 제어 항목 | Codex CLI | Claude Code |
|---|---|---|
| 모델 선택 | `-m <MODEL>` | `--model <alias\|full>` (fable/opus/sonnet) |
| 사용량·추론 강도 | `-c model_reasoning_effort="high"` | `--effort low\|medium\|high\|xhigh\|max` |
| 시스템 프롬프트 | 전용 플래그 없음 → 프롬프트 선두 주입 또는 `AGENTS.md` | `--append-system-prompt` / `--append-system-prompt-file` |
| 컨텍스트 주입 | `-C <DIR>`, `--add-dir` | `--add-dir` |
| 구조화 출력 | `--output-schema <FILE>` | `--json-schema <schema>` |
| 스트리밍 | `--json` (JSONL) | `--output-format stream-json --include-partial-messages` |
| 도구 제한 | `-s read-only` | `--restricted`, `--allowedTools`, `--permission-mode plan` |
| 세션 격리 | `--ephemeral`, `--ignore-user-config` | `--session-id`, 저장 안 함 옵션 |
| 폴백 모델 | 없음 | `--fallback-model` |

요구사항 15의 "Extrahigh, high, medium"은 Claude Code의 `--effort`에 `xhigh`, `high`, `medium`으로 **정확히 대응한다.** Codex는 같은 개념을 config 오버라이드로 표현한다.

**주의**: `--max-budget-usd`는 API 키 사용자 전용이므로 구독 실행에서는 무의미하다. 비용 상한은 이 플래그가 아니라 §6의 러너 측 실행 횟수 제한으로 건다.

### 하네스 스키마

```jsonc
{
  "agent_id": "writer",
  "provider": "codex",           // codex | claude
  "model": "gpt-5-codex",
  "effort": "high",              // low | medium | high | xhigh | max
  "max_turns": 12,
  "timeout_minutes": 10,
  "sandbox": "read-only",
  "system_prompt_id": "writer-sys-v7",
  "context_pack": ["01","02","03","04","05","06"],
  "output_schema": "writer.json",
  "evidence_required": true,     // 요구사항 17, 끌 수 없음
  "retry_count": 0
}
```

UI는 지원 매트릭스를 읽어 **해당 프로바이더가 지원하지 않는 옵션은 비활성화하고 이유를 표시한다.** 예를 들어 프로바이더를 Codex로 바꾸면 `--fallback-model` 칸이 회색이 되고 "Codex 미지원"이 뜬다. 조용히 무시하면 사용자가 설정했다고 착각한다.

`evidence_required`, 샌드박스, 재시도 0, API 키 차단은 **UI에서 해제 불가능한 고정값**이다(v1 계승).

### 하네스 동결

잡을 만들 때 하네스 전체를 `jobs.harness_snapshot`에 복사한다. 실행 후 하네스를 바꿔도 과거 실행이 어떤 설정으로 돌았는지 정확히 남는다. 프롬프트 엔지니어링을 반복할 때 "이 결과는 어떤 설정이었지"를 되짚을 수 있어야 한다.

---

## 10. 자소서 문항 수집 (요구사항 8) — 붙여넣기 임포트로 확정

> **결정됨 (2026-08-31): 붙여넣기 임포트 단일 방식.** 브라우저 확장·북마클릿은 v2 범위 밖이다. 서버 자동 로그인·크롤링은 영구 금지다.

### 채택하지 않는 방식

서버가 자소설닷컴에 자동 로그인해 문항·글자수·Job Script를 긁어 오는 방식은 **만들지 않는다.**

1. **v1 계약 위반.** "자소설닷컴 계정에 자동 로그인하거나 자동 저장하지 않는다"가 이미 명시돼 있다.
2. **약관 위험.** 회원 전용 데이터의 서버 자동 수집은 계정 정지 사유가 될 수 있다.
3. **자격증명 문제.** 크롤링하려면 자소설닷컴 로그인 정보를 클라우드에 둬야 한다. §3의 선을 넘는다.
4. **유지가 안 된다.** 봇 차단과 DOM 변경으로 중요한 순간에 조용히 깨진다.

구현자는 이 항목을 **재검토하거나 우회 구현하지 않는다.** 헤드리스 브라우저, Puppeteer, 스크래핑 라이브러리를 이 목적으로 도입하지 않는다.

### 채택 방식 — 붙여넣기 임포트

내가 자소설닷컴에서 문항 영역을 드래그 복사 → 앱의 "문항 붙여넣기" 상자에 붙여넣기 → **결정론적 파서**가 문항 번호·본문·글자수를 분리해 `essay_questions`에 넣는다. 체감 비용은 복사 1회, 붙여넣기 1회, 5초다.

**LLM을 절대 호출하지 않는다.** 순수 정규식·문자열 처리다. 요구사항 16에 부합하고, 틀려도 내가 즉시 고칠 수 있다. 파싱이 애매하다고 LLM 폴백을 넣지 않는다 — 애매하면 사용자에게 보여 주고 고치게 한다.

### 파서 명세 (구현자는 이 명세를 그대로 따른다)

**입력**: 여러 줄 문자열 (`\r\n`은 `\n`으로 정규화)
**출력**: `ParsedQuestion[]`

```ts
type ParsedQuestion = {
  order_no: number;          // 1부터. 원문 번호가 아니라 등장 순서
  question: string;          // 글자수 표기를 제거한 문항 본문
  char_limit: number | null; // 상한. 없으면 null
  char_min: number | null;   // "최소 N자"가 있을 때만
  char_limit_basis: 'with_spaces' | 'without_spaces' | 'unspecified';
  raw: string;               // 원문 그대로 보존 (사용자 확인용)
};
```

#### 1단계 — 문항 경계 분할

다음 중 하나에 매칭되는 줄에서 새 문항이 시작된다. **위에서부터 순서대로 시도하고 첫 매칭을 쓴다.**

| 우선 | 패턴 | 예 |
|---|---|---|
| 1 | `/^\s*(?:문항|Q|q)\s*(\d+)\s*[.)\]:]/` | `문항 1.` `Q1)` |
| 2 | `/^\s*\[\s*(\d+)\s*번?\s*\]/` | `[1번]` `[ 2 ]` |
| 3 | `/^\s*(\d+)\s*[.)]\s/` | `1. ` `2) ` |
| 4 | `/^\s*[-•▪◦*]\s+/` | `- 지원동기` |

**매칭 안 되는 줄은 직전 문항 본문에 이어 붙인다.** 문항이 여러 줄인 경우가 흔하므로 빈 줄만으로 문항을 나누지 않는다. 첫 문항 시작 전의 텍스트(안내문 등)는 버린다.

`order_no`는 원문 번호를 신뢰하지 않고 **등장 순서로 1부터 재부여한다.** 원문에 번호가 `1, 2, 4`로 튀거나 `3-1` 같은 게 섞여도 안전하다.

#### 2단계 — 글자수 추출

문항 본문 **전체**에서 찾는다(괄호 안에만 있다고 가정하지 않는다).

```
숫자:      /(\d{1,3}(?:,\d{3})+|\d+)\s*자/g      → 매칭 시 콤마 제거 후 Number()
최소:      /최소\s*(\d[\d,]*)\s*자/
최대:      /최대\s*(\d[\d,]*)\s*자/
공백 포함: /(?:띄어쓰기|공백)\s*포함/            → 'with_spaces'
공백 제외: /(?:띄어쓰기|공백)\s*(?:제외|미포함)/ → 'without_spaces'
```

`char_limit` 결정 순서:

1. `최대 N자`가 있으면 그 값
2. 없고 숫자가 1개면 그 값
3. 없고 숫자가 2개 이상이면 **가장 큰 값** (`500자 이상 1000자 이내` 같은 표기 대응)
4. 숫자가 없으면 `null`

`char_min`은 `최소 N자` 또는 `N자 이상`이 있을 때만 채운다. 그 외엔 `null`.

`char_limit_basis`는 표기가 없으면 `'unspecified'`다. **임의로 `with_spaces`를 기본값으로 추정하지 않는다** — 기업마다 다르고, 틀리면 글자수 초과로 제출이 막힌다. UI에서 사용자가 확정한다.

#### 3단계 — 본문 정리

- 글자수 표기가 들어 있던 **괄호 그룹만** 제거: `/\s*[（(][^)）]*\d+\s*자[^)）]*[)）]\s*/g`
- 선행 번호/불릿 제거
- 앞뒤 공백 트림, 연속 공백 1칸으로
- **본문 안의 다른 괄호는 건드리지 않는다** (`(주)`, 영문 병기 등)

#### 테스트 케이스 (구현자는 이걸 그대로 유닛 테스트로 만든다)

| # | 입력 줄 | question | char_limit | char_min | basis |
|---|---|---|---|---|---|
| 1 | `1. 지원 동기를 기술해 주십시오. (1000자 이내)` | `지원 동기를 기술해 주십시오.` | 1000 | null | unspecified |
| 2 | `2. 직무 관련 경험을 서술하시오. (띄어쓰기 포함 1500자)` | `직무 관련 경험을 서술하시오.` | 1500 | null | with_spaces |
| 3 | `Q1) 본인의 강점은? (공백제외 800자)` | `본인의 강점은?` | 800 | null | without_spaces |
| 4 | `[1번] 성장과정 (1,000자 이내)` | `성장과정` | 1000 | null | unspecified |
| 5 | `3. 입사 후 포부 (최소 500자, 최대 1000자)` | `입사 후 포부` | 1000 | 500 | unspecified |
| 6 | `- 지원동기` | `지원동기` | null | null | unspecified |
| 7 | `문항 2. 협업 경험을 쓰시오.`<br>`구체적 사례 중심으로. (700자)` | `협업 경험을 쓰시오. 구체적 사례 중심으로.` | 700 | null | unspecified |
| 8 | `1. 우리 회사(주)에 지원한 이유 (500자 이내)` | `우리 회사(주)에 지원한 이유` | 500 | null | unspecified |

케이스 7(여러 줄)과 8(본문 내 괄호 보존)이 가장 자주 깨진다. 반드시 테스트에 포함한다.

### UI 명세

```text
[문항 붙여넣기]  ← 채용 보드 · 공고 상세 패널의 버튼

┌─ 붙여넣기 모달 ────────────────────────────────┐
│ 자소설닷컴에서 문항 영역을 복사해 붙여넣으세요 │
│ ┌────────────────────────────────────────────┐ │
│ │ (textarea, 자동 포커스)                    │ │
│ └────────────────────────────────────────────┘ │
│                                    [문항 인식] │
├─ 인식 결과 (전부 인라인 편집 가능) ────────────┤
│ 1 │ 지원 동기를 기술해 주십시오.               │
│   │ 1000자  [공백 기준: 미지정 ▾]         [×] │
│ 2 │ 직무 관련 경험을 서술하시오.               │
│   │ 1500자  [공백 기준: 포함 ▾]           [×] │
│                                  [+ 문항 추가] │
│                          [취소]  [N개 저장]    │
└────────────────────────────────────────────────┘
```

규칙 세 가지.

1. **파싱 결과를 바로 저장하지 않는다.** 항상 확인 화면을 거친다. 파서는 초안일 뿐이다.
2. **`char_limit_basis`가 `unspecified`면 노란 배지**로 표시한다. 글자수 기준을 모르는 채 자소서를 쓰면 마지막에 분량이 안 맞는다.
3. **재붙여넣기는 병합이다.** 같은 `job_post_id`에 다시 붙여넣으면 기존 문항을 지우지 않는다. `order_no`가 겹치면 신규를 뒤에 붙이고 사용자가 정리하게 한다 — v1의 비파괴 원칙 계승.

### JD 입력 (요구사항 8 후반)

"기업조사 실행할 때 JD만 입력값으로 추가"는 그대로 구현한다. 솔 실행 다이얼로그에 JD 텍스트 영역을 두고, 모카가 이미 수집한 공고면 `job_posts.description`을 자동으로 채워 넣는다. 이게 `02-job-description.md`가 된다. **JD도 파싱하지 않고 원문 그대로 넘긴다** — 솔이 읽을 재료지 구조화 대상이 아니다.

---

## 11. 일정 에이전트 노바와 캘린더 (요구사항 9)

### 노바 — 하이브리드 에이전트

여섯 번째 비서를 신설한다. 색은 앞의 다섯과 겹치지 않게 **회청색 러시안블루**, 성격은 조용하고 정확한 비서. 모카가 공고를 찾으면 노바를 호출한다.

**중요한 설계 결정: 노바는 대부분의 경우 LLM을 안 쓴다.** 마감일 정규화는 결정론적 파싱으로 90% 이상 처리된다. LLM은 파싱이 실패했을 때만 부른다. 요구사항 16을 만족시키면서 정확도는 오히려 올라간다 — 날짜 계산에서 LLM은 코드보다 못하다.

```text
모카 결과 → 노바
  ├─ 1단계: 정규식 파싱
  │    "2026-09-15", "9월 15일", "9/15(월) 18:00", "D-7" → 확정
  │    "상시채용", "채용시 마감", "충원시 마감"       → needs_review
  ├─ 2단계: 1단계 실패 시에만 LLM (sonnet + effort low)
  │    출력 스키마 강제: {date|null, reason, confidence}
  └─ 3단계: calendar_events 저장
       confidence=confirmed  → 캘린더에 정상 표시
       confidence=needs_review → 노란 배지 + "마감일 확인 필요"
```

**100% 자동은 불가능하다고 명시한다.** 채용 공고의 마감 표기는 표준이 없다. 잘못 파싱한 날짜를 확신에 차서 보여 주는 것보다, 모르는 걸 모른다고 표시하고 내가 확정하는 게 낫다. 마감일을 놓치는 사고는 이 앱이 절대 내면 안 되는 종류의 사고다.

### 캘린더 UI

| 항목 | 설계 |
|---|---|
| 뷰 | 월 / 주 / 리스트(다가오는 순) |
| 카드 정보 | 기업명, 직무, D-day, 적합도, 원문 URL |
| 색상 | D-3 이내 빨강, D-7 주황, 그 외 기본, `needs_review` 노랑 |
| 상호작용 | 클릭 → 공고 상세 패널. "기업 조사 시작" / "자소서 프로젝트 만들기" 버튼 |
| 수동 추가 | 면접일, 결과 발표일 직접 등록 (`event_type`) |
| 알림 | 웹 푸시로 D-3, D-1 (선택) |
| 외부 연동 | `.ics` 내보내기로 기본 캘린더 앱과 구독 연동. **양방향 동기화는 범위 밖** |
| 시각 톤 | 기존 고양이 사무실의 라임·딥그린 팔레트 계승. 노바가 캘린더 위를 걸어 다니며 마감 임박 날짜에 반응 |

기존 문서의 "기능만 동작하고 화면이 퇴보하면 완료가 아니다"를 캘린더에도 적용한다. 예쁜 캘린더는 요구사항에 명시된 항목이다.

---

## 12. 트리거와 스케줄 (요구사항 10)

### 독립 실행

v1의 5단계 고정 파이프라인을 해체한다. 각 에이전트가 독립적으로 호출 가능해진다.

| 에이전트 | 트리거 |
|---|---|
| 루미 (뉴스) | **수동만.** 자동 실행 없음 |
| 모카 (채용) | 수동 + **매일 15:00 자동** |
| 노바 (일정) | 모카 완료 시 자동 연쇄 (LLM 거의 안 씀) |
| 솔 (기업조사) | 수동 |
| 뮤즈 (작성) | 수동 (솔 완료 후에만 활성화) |
| 렌즈 (검수) | 수동 |
| 렌즈 인라인 | 문단 완결 + 유휴 (§8) |

### 매일 15시 자동 채용 탐색

두 가지 방법이 있고, **러너 자체 스케줄러를 권장한다.**

| 방식 | 장점 | 단점 |
|---|---|---|
| **러너 로컬 스케줄러 (권장)** | Vercel Cron 제약 없음, 러너 꺼져 있으면 애초에 잡을 안 만듦 | 러너가 시각을 놓칠 수 있음 |
| Vercel Cron | 러너 상태와 무관하게 잡 생성 | Hobby는 하루 1회 제한, 러너 없으면 잡만 쌓임 |

러너 쪽이 나은 이유는 단순하다. **어차피 러너가 꺼져 있으면 실행이 안 된다.** 그러면 잡을 만들 주체도 러너인 게 맞다. 죽은 잡이 큐에 쌓이지 않는다.

```text
러너 스케줄러 (node-cron, Asia/Seoul)
  15:00 매일
    ├─ 오늘 이미 실행했나? → 예: skip (중복 방지)
    ├─ 일일 실행 상한 남았나? → 아니오: skip + 알림
    ├─ 구독 인증 정상인가? → 아니오: blocked_auth 기록
    └─ 모카 잡 생성 → 실행 → 노바 연쇄 → 캘린더 갱신
                                    └─ 신규 공고 있으면 웹 푸시
```

노트북을 15시에 닫아 뒀다면: 다음에 켜질 때 **당일 안이면** 실행하고, 날짜가 넘어갔으면 건너뛴다. 어제 자 채용 탐색을 오늘 돌리는 건 의미가 적고 쿼터만 쓴다.

---

## 13. 토큰 최소화 전략 (요구사항 16)

| # | 전략 | 효과 |
|---|---|---|
| 1 | **컨텍스트 팩(파일)** — 프롬프트에 원문 붙여넣기 금지, `-C`/`--add-dir`로 폴더 제공 | 에이전트가 필요한 파일만 읽는다 |
| 2 | **경험 카드 선택 로딩** — 전체가 아니라 내가 고른 3~5장만 팩에 씀 | 입력이 수분의 일로 준다 |
| 3 | **결정론 우선** — 글자수 계산, 마감일 파싱, URL 중복 제거, 문항 파싱은 코드가 한다 | LLM 호출 자체를 없앤다 |
| 4 | **조사 캐시** — 같은 기업+직무는 24시간 내 재사용, "다시 조사" 눌러야 새로 호출 | 반복 조사 제거 |
| 5 | **effort 계층화** — 뉴스·일정 `low`, 인라인 제안 `low`, 기업조사·작성 `high` | 무거운 추론을 필요한 데만 |
| 6 | **인라인 제안 디바운스 + 해시 캐시** — 안 바뀐 문단은 호출 안 함 | 최대 소비원을 차단 |
| 7 | **구조화 출력** — `--output-schema` / `--json-schema` | 파싱 실패로 인한 재호출 제거 |
| 8 | **온디맨드 기본** — 뉴스는 자동 실행 없음 (요구사항 10) | 무의식적 소비 0 |
| 9 | **실행 전 예상 입력량 표시** — "약 12,000자 전송 예정" | 내가 판단할 기회 |

`retry_count: 0`을 유지하는 것도 여기 포함된다. 실패한 실행을 자동 재시도하면 쿼터가 조용히 두 배로 나간다.

---

## 14. 경험 근거 강제 (요구사항 17)

"자소서 작성 시 반드시 내 경험을 읽게 한다"는 프롬프트에 부탁하는 것으로는 부족하다. 세 겹으로 강제한다.

**1겹 — 실행 전 차단.** 컨텍스트 팩에 `04-experiences.md`가 없거나 비어 있으면 러너가 뮤즈 실행을 **거부한다.** 하네스의 `evidence_required`는 UI에서 끌 수 없다.

**2겹 — 출력 스키마 강제.** 뮤즈의 `--output-schema`에 근거 배열을 필수로 넣는다.

```jsonc
{
  "type": "object",
  "required": ["draft", "evidence"],
  "properties": {
    "draft": { "type": "string" },
    "evidence": {
      "type": "array", "minItems": 1,
      "items": {
        "type": "object",
        "required": ["paragraph_index", "experience_id", "quoted_fact"],
        "properties": {
          "paragraph_index": { "type": "integer" },
          "experience_id":   { "type": "string" },
          "quoted_fact":     { "type": "string" }
        }
      }
    }
  }
}
```

**3겹 — 사후 대조 (LLM 안 씀).** 반환된 `experience_id`가 팩에 실재하는 id인지 코드로 대조한다. 없는 id를 지어냈거나, 근거 없는 문단이 있으면 `evidence_violation`으로 표시하고 편집기에서 해당 문단을 빨갛게 띄운다. **자동으로 버리지는 않는다** — 내가 보고 판단한다.

렌즈는 여기에 더해 "팩에 없는 수치·회사명·성과가 본문에 있는가"를 교차 검수한다. 자소서에서 지어낸 숫자는 면접에서 무너진다.

---

## 15. v1 → v2 마이그레이션

기존 로컬 SQLite 데이터를 잃지 않는다.

```text
1. v1 앱에서 `전체 백업 내려받기` (기존 /api/export/download 그대로 사용)
2. v2 웹의 설정 화면에서 백업 JSON 업로드
3. 서버가 Supabase 스키마로 변환 삽입
     - 모든 행에 owner_id = 내 uid 부착
     - id는 기존 문자열 id를 uuid로 매핑 (매핑표 보존)
     - 삭제 연산 없음, 트랜잭션 1회 (v1 비파괴 병합 원칙 계승)
4. v1 앱은 읽기 전용으로 보관. 한 달간 병행 후 정리
```

`settings` 테이블은 이관하지 않는다(§5). 백업에 들어 있던 안전 설정 값은 무시하고 러너 상수가 다시 강제한다 — v1의 "백업을 통한 안전 설정 변조 시도" 방어를 그대로 잇는다.

---

## 16. 구현 로드맵

각 단계는 그 자체로 쓸 수 있는 상태여야 한다. 중간에 멈춰도 손해가 없게 자른다.

| 단계 | 내용 | 이 단계가 끝나면 |
|---|---|---|
| **1. 기반** | Supabase 스키마 + RLS + Auth, Vercel 배포, Cloudflare Access, v1 데이터 이관 | 다기기에서 **읽기**가 된다 |
| **2. 에디터** | 자소서 편집기, 1분 자동저장, 충돌 해결, 버전 열람, Presence | **요구사항 1·2·3·14 완료.** LLM 없이도 실사용 가능 |
| **3. 러너** | 잡 큐, claim, 하트비트, 구독 인증 검사, 환경변수 제거, 스트림 중계 | AI 실행이 살아난다. **요구사항 4·6 완료** |
| **4. 에이전트 이식** | 루미·모카·솔·뮤즈·렌즈를 컨텍스트 팩 방식으로 재구성, 하네스 매트릭스 | **요구사항 5·11·15·17 완료** |
| **5. 일정** | 노바 신설, 결정론 파서, 캘린더 UI, 15시 스케줄 | **요구사항 9·10 완료** |
| **6. 문항·제안** | 붙여넣기 파서(§10 명세대로), `essay_questions`, 인라인 제안 | **요구사항 7·8 완료** |
| **7. 다듬기** | 토큰 계측 대시보드, 푸시 알림, `.ics` 내보내기, 모바일 QA | **요구사항 16 계측 가능** |

2단계까지만 해도 "어느 컴퓨터에서든 자소서를 쓰고 이어서 고친다"는 핵심 요구가 충족된다. 3단계부터가 AI다. 이 순서면 초반에 뭔가 틀어져도 잃는 게 없다.

---

## 17. 남은 리스크

| 리스크 | 성격 | 완화 |
|---|---|---|
| 러너가 꺼져 있으면 AI 정지 | **구조적, 제거 불가** | 상시 러너 1대 지정. 웹에 러너 상태 상시 표시 |
| 개인 데이터가 클라우드로 나간다 | **다기기의 대가** | RLS + 4중 인증. 자격증명만은 끝까지 로컬 |
| Supabase 무료 티어 정책 변경 | 외부 의존 | 주 1회 JSON 백업 자동 내려받기 유지 |
| 자소설닷컴 DOM 변경 | **해당 없음** | 붙여넣기 방식은 DOM에 의존하지 않는다 |
| 구독 쿼터 소진 | 요구사항 4의 필연 | `waiting_for_reset` 대기. **API 폴백은 만들지 않는다** |
| 두 러너 동시 실행 | 중복 소비 | `for update skip locked` + 동시 실행 1개 제한 |
| 마감일 오인식 | 데이터 품질 | `needs_review` 배지. 확신 없는 날짜를 확신하지 않는다 |
| 인라인 제안 남용 | 쿼터 | 해시 캐시 + 디바운스 + 일일 상한 |

---

## 18. 결정이 필요한 것

구현 착수 전에 답이 필요한 항목이다.

1. **상시 러너를 어느 기기로 할 것인가.** 데스크톱이 있으면 그쪽이 맞다. 노트북뿐이면 매일 15시 자동 탐색은 "켜져 있을 때만"으로 낮춰 받아들여야 한다.
2. **개인 데이터의 클라우드 이전을 승인하는가.** v1은 자소서까지 전부 로컬이었다. v2는 다기기를 위해 Supabase로 옮긴다. 자격증명은 여전히 로컬이지만 이건 방향 전환이므로 명시적 승인이 필요하다.
3. **Cloudflare Access를 쓸 것인가.** 커스텀 도메인이 필요하다(연 1~2만 원). 안 쓰면 Vercel Authentication + Supabase Auth 2중이 되고, 방어가 한 겹 얇아진다.
4. **v1 로컬 앱을 유지할 것인가, 완전 대체할 것인가.**

> **결정 완료 (2026-08-31)**
> - 자소서 문항 수집 = **붙여넣기 임포트 단일 방식.** 브라우저 확장은 범위 밖. §10
> - 코드 구현 담당 = **Sonnet.** 구현 지침은 §19.

---

## 19. 구현자(Sonnet) 지침

이 절은 실제 코드를 작성하는 AI를 위한 것이다. 위 §1~§18이 "무엇을 만드는가"라면, 여기는 **"만들면서 무엇을 하면 안 되는가"**다.

### 19.1 시작 전에 읽을 것

1. 이 문서 전체 (특히 §2 판정표, §6 보안, §10 파서 명세)
2. `docs/AI-HANDOFF.md` — v1의 안전 계약. v2도 이걸 계승한다
3. `docs/PRIVACY-AND-COST.md` — 비용·인증 규칙
4. `server/index.mjs`, `server/db.mjs` — v1 구현. 러너는 이 코드를 옮겨 오는 것에 가깝다

### 19.2 절대 위반 금지

아래는 구현 중 **실제로 유혹을 느끼게 되는** 항목들이다. 하나라도 어기면 그 변경은 완료가 아니다.

| # | 금지 | 왜 유혹적인가 | 대신 할 것 |
|---|---|---|---|
| 1 | **CLI 실패 시 API 폴백 추가** | "안정성"처럼 보인다 | 실패는 실패로 보고한다. `waiting_for_reset` / `failed`로 남기고 끝 |
| 2 | **`service_role` 키를 Vercel 환경변수에 넣기** | RLS 씨름이 사라져 편하다 | 러너 전용 계정 + RLS. Vercel엔 `anon` 키만 |
| 3 | **RLS 우회용 `service_role` 사용** | 정책 디버깅이 귀찮다 | 정책을 고친다. 우회하면 4층 방어가 무너진다 |
| 4 | **문항 파싱 실패 시 LLM 폴백** | 정확도가 올라 보인다 | 사용자에게 보여 주고 고치게 한다 (§10) |
| 5 | **헤드리스 브라우저·스크래핑 도입** | 요구사항 8을 "더 잘" 푸는 것처럼 보인다 | 붙여넣기만. §10 재검토 금지 |
| 6 | **자소서 충돌 시 last-write-wins** | 구현이 20줄 줄어든다 | `revision` 낙관적 잠금 + 사용자 선택 (§7) |
| 7 | **실패한 실행 자동 재시도** | 견고해 보인다 | `retry_count: 0` 고정. 재시도는 쿼터를 조용히 2배로 쓴다 |
| 8 | **스트림 청크마다 DB write** | 코드가 단순하다 | 200ms 배칭 (§4) |
| 9 | **모델·effort 하드코딩** | 하네스 배선이 번거롭다 | 전부 `harness_snapshot`에서 읽는다 (§9) |
| 10 | **안전 설정을 DB/env로 노출** | "설정 가능"이 좋아 보인다 | 러너 코드 상수. UI에서 끌 수 없다 (§5, §6) |
| 11 | **API 키 입력란 추가** | 로그인 실패 시 대안처럼 보인다 | 만들지 않는다. `blocked_auth`로 끝 |
| 12 | **러너에 인바운드 포트·터널 개설** | 웹→러너 직접 호출이 간단하다 | 아웃바운드 폴링/구독만 (§4) |

특히 **1번과 2번**이 가장 흔하고 가장 치명적이다. 막혔을 때 이 두 방향으로 흘러가기 쉬우니, 그 순간이 오면 코드를 쓰지 말고 사용자에게 묻는다.

### 19.3 파일 배치

```text
web/                      Next.js (Vercel 배포 대상)
  app/                    화면
  lib/supabase/           클라이언트, 타입, 쿼리
  lib/parser/
    essay-questions.ts    §10 파서 — 순수 함수, 의존성 0
    essay-questions.test.ts  §10 테스트 케이스 8개
supabase/
  migrations/             스키마 + RLS 정책
  functions/              (필요 시) Edge Function
runner/                   로컬 러너 (Vercel에 배포하지 않는다)
  index.mjs               큐 폴링 · claim · 하트비트
  providers/codex.mjs     v1 server/index.mjs에서 이식
  providers/claude.mjs
  safety.mjs              환경변수 제거 · 인증 검사 · 상한 (상수)
  context-pack.mjs        §8 팩 생성
  scheduler.mjs           §12 매일 15시
docs/                     이 문서 포함
```

`runner/`는 **절대 Vercel 빌드에 포함되지 않게** 한다. `.vercelignore`에 넣는다.

### 19.4 작업 순서와 완료 판정

§16 로드맵을 따른다. 각 단계는 **다음 단계 없이도 동작**해야 하고, 아래 판정을 통과해야 다음으로 간다.

| 단계 | 완료 판정 |
|---|---|
| 1. 기반 | 로그인 안 한 브라우저에서 앱 URL 접근 → Cloudflare Access에서 차단됨. `anon` 키로 REST 직접 호출 → 0행 반환 |
| 2. 에디터 | 브라우저 A·B에서 같은 자소서를 열고 양쪽에서 수정 → 충돌 배너 + diff가 뜨고, **버려진 쪽이 `essay_autosaves`에 남아 있다** |
| 3. 러너 | 러너를 끈 채 잡 생성 → 큐에 대기. 러너 켜면 실행. 6시간 지난 잡은 `expired` |
| 4. 에이전트 | `04-experiences.md`를 비운 채 뮤즈 실행 → **거부된다** (요구사항 17) |
| 5. 일정 | "상시채용" 공고 → `needs_review` 배지. 정상 날짜 → 캘린더에 D-day 표시 |
| 6. 문항·제안 | §10 테스트 케이스 8개 전부 통과. 같은 문단 재요청 시 **CLI 호출이 발생하지 않음** (캐시 확인) |
| 7. 다듬기 | 데스크톱·모바일 시각 검수 |

### 19.5 검증

v1의 `scripts/verify-local.mjs` 방식을 계승한다. **실제 Codex/Claude를 호출하지 않는다.**

- 모의 CLI 스크립트를 임시 디렉터리에 만들고 `PATH` 앞에 끼운다
- 러너 통합 테스트: 잡 생성 → claim → 실행 → 결과 업로드 → 상태 전이 8종
- 파서 유닛 테스트: §10 케이스 8개
- RLS 테스트: 다른 `owner_id`로 접근 시 0행

검증이 구독 쿼터를 소비하면 그 검증은 잘못 만든 것이다.

### 19.6 막혔을 때

**추측해서 만들지 않는다.** 아래는 사용자에게 물어야 하는 것들이다.

- Supabase 프로젝트·Cloudflare 계정 등 외부 서비스 생성이 필요할 때
- 이 문서와 실제 CLI 동작이 어긋날 때 (플래그가 없거나 다르게 동작)
- §19.2의 금지 항목을 우회하지 않으면 진행이 안 될 때
- 스키마를 §5와 다르게 바꿔야 할 때

### 19.7 보고 형식

v1 규칙을 계승한다. 작업이 끝나면 다음 네 가지를 적는다.

1. 변경한 파일
2. 사용자 입장에서 달라진 점
3. 검증 결과 (통과·실패를 사실대로. 실패했으면 출력과 함께)
4. 남은 제한
