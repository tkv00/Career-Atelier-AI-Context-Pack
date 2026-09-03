# 하네스 엔지니어링 및 에이전트 개발 가이드

이 문서는 Career Atelier의 핵심 실행 엔진인 러너(Runner)와 AI 비서 오케스트레이션(Harness Engineering)의 내부 구조, 설계 원칙, 프로바이더 연동 방식을 설명합니다.

새로운 비서를 추가하거나, 새로운 AI CLI 도구를 연동하거나, 하네스 실행 로직을 개선하려는 기여자를 위한 기술 문서입니다.

---

## 1. 하네스 엔지니어링 개요

Career Atelier는 상용 클라우드 API(토큰당 종량제 과금)를 사용하지 않습니다. 사용자가 이미 결제하고 있는 개인 구독제 CLI(Codex, Claude Code, Antigravity)를 로컬 컴퓨터에서 하네스로 감싸서 실행합니다.

### 핵심 원칙
- 무과금 불변식: 자식 프로세스를 띄울 때 모든 API 키 환경변수(`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` 등)를 강제로 제거합니다. 구독 로그인 상태가 확인되지 않으면 실행을 차단합니다.
- 투 플레인(Two-Plane) 분리: Vercel에 배포된 웹 앱(`web/`)은 작업을 데이터베이스(`jobs` 테이블)에 등록만 하며, 실제 CLI 프로세스는 사용자의 로컬 기기에서 동작하는 러너(`runner/`)가 아웃바운드로 폴링하여 실행합니다.
- 결정론적 샌드박스: 모든 AI 실행은 격리된 임시 작업 폴더(`~/.career-atelier/workspaces/<run_id>/`)를 생성하고, 필요한 파일만 담긴 컨텍스트 팩(Context Pack)을 전달하여 근거 중심의 추론을 강제합니다.

---

## 2. 비서 및 엔진 체계

Career Atelier는 7개의 특화 AI 비서와 2개의 비(非) LLM 결정론적 엔진으로 구성됩니다.

| 식별자 | 명칭 | 주 역할 | 기본 CLI | 결과 저장 테이블 |
|---|---|---|---|---|
| `news` | 루미 (Lumi) | 관심 분야 기반 최신 기술/채용 뉴스 검색 | Codex | `research_notes` (kind: news) |
| `jobs` | 모카 (Moka) | 사용자 경험 기반 맞춤 채용공고 탐색 | Codex | `job_posts` (URL 기준 갱신) |
| `company` | 솔 (Sol) | 기업 공시, 기술 블로그 등 1차 자료 조사 | Claude Code | `research_notes` (kind: company) |
| `writer` | 뮤즈 (Muse) | 경험 카드 기반 자소서 초안 및 수정 작성 | Codex | `artifacts` (kind: draft) |
| `review` | 렌즈 (Lens) | 수치 과장, 사실 오류 검수 | Claude Code | `artifacts` (kind: review) |
| `interview` | 에코 (Echo) | 기업/직무/경험 연계 면접 질문 생성 | Codex | `interview_questions` |
| `subtitle` | 콤마 (Comma) | 자소서 문항별 15자 이내 소제목 제안 | Antigravity | `artifacts` (kind: subtitle) |
| `nova` | 노바 (Nova) | 공고 마감일 결정론적 파싱 및 캘린더 동기화 | (순수 정규식 코드) | `calendar_events` |
| `parser` | 문항 파서 | 복사된 채용 문항 텍스트의 글자수/안내문 파싱 | (순수 정규식 코드) | `essay_questions` |

* 비서별 사용 모델은 프롬프트 관리 화면(`prompt_templates.provider`)에서 사용자가 언제든 Codex, Claude, Gemini(Antigravity) 중 하나로 변경할 수 있습니다.

---

## 3. 작업 생명주기 및 처리 파이프라인

작업은 다음 단계로 처리됩니다.

```text
[웹 클라이언트]
  │ 작업 생성 (jobs INSERT, status='queued')
  ▼
[Postgres (Supabase)]
  │ 원자적 큐잉 (claim_next_job RPC: FOR UPDATE SKIP LOCKED)
  ▼
[로컬 러너 (runner/index.mjs)]
  ├─ 1. 구독 인증 상태 확인 (assertSubscriptionProvider)
  ├─ 2. 컨텍스트 팩 생성 (runner/context-pack.mjs)
  ├─ 3. 프로바이더별 인자 및 스키마 정규화 (schema-compat.mjs)
  ├─ 4. CLI 자식 프로세스 구동 및 표준입출력 파이핑 (runner/execute.mjs)
  ├─ 5. 실시간 이벤트 200ms 배칭 업로드 (run_events INSERT)
  ├─ 6. 구조화 출력 검증 및 사후 대조 (지어내기 방지 필터)
  └─ 7. 최종 결과물 저장 및 후속 파이프라인 연쇄 (예: Moka -> Nova)
```

### 원자적 클레임 (`claim_next_job`)
여러 대의 컴퓨터에서 러너가 동시에 실행 중이더라도, `FOR UPDATE SKIP LOCKED` 쿼리를 통해 하나의 작업은 정확히 하나의 러너만 선점합니다. 15초마다 하트비트를 전송하며, 하트비트가 90초 이상 끊긴 작업은 `reap_stale_jobs` 함수가 자동으로 큐로 되돌립니다.

---

## 4. 컨텍스트 팩과 지어내기(Hallucination) 방지 3겹 장치

자소서 초안 작성 비서인 뮤즈(`writer`)는 없는 사실을 지어내는 환각을 방지하기 위해 3중 안전장치를 거칩니다.

```text
1겹: 사전 검증 (index.mjs)
   - 등록된 경험 카드가 0건이면 뮤즈 실행 자체를 거부하고 작업을 종료합니다.

2겹: 구조화 스키마 강제 (context-pack.mjs)
   - 출력 JSON 스키마에서 문단별 evidence 배열 생성을 필수로 요구합니다.
   - evidence에는 문단 번호, 근거 경험 카드 ID, 인용한 사실이 포함되어야 합니다.

3겹: 코드 레벨 사후 대조 (index.mjs)
   - 모델이 응답한 evidence[].experience_id가 실제 사용자의 카드 ID 집합에
     존재하는지 순수 코드로 대조합니다.
   - 존재하지 않는 ID는 위반 사항(evidenceViolations)으로 분류하여 기록합니다.
```

### 컨텍스트 팩 폴더 구조
작업이 시작되면 러너는 격리된 폴더에 마크다운과 스키마를 구성합니다.

```text
~/.career-atelier/workspaces/<run_id>/
  ├─ context/
  │    ├─ 00-INDEX.md            읽을 순서 및 근거 참조 규칙
  │    ├─ 01-questions.md        자소서 문항 및 목표 글자수
  │    ├─ 02-job-description.md  지원 기업 및 직무 설명(JD)
  │    ├─ 04-experiences.md      사용자의 실제 경험 카드 목록 (ID 포함)
  │    └─ 06-style-guide.md      문체 가이드
  ├─ schema/
  │    └─ writer.json            구조화 출력 검증용 JSON 스키마
  └─ output/                     결과 산출물 폴더
```

---

## 5. 프로바이더별 실행 옵션 및 실측 노하우

각 AI 도구는 비대화형(Headless) CLI 실행 시 서로 다른 동작 특성을 보입니다. 하네스는 이 차이를 코드 레벨에서 흡수합니다.

### 1. Codex CLI (`runner/providers/codex.mjs`)
- 실행 커맨드: `codex exec -C <workspace> --skip-git-repo-check --ephemeral --ignore-user-config -s read-only`
- 스키마 옵션: `--output-schema <file_path>` (파일 경로를 전달)
- 표준입력(stdin) 주의점: 헤드리스 환경에서 stdin을 `ignore`로 설정하면 tty 부재로 인해 `os error 2`가 발생합니다. child process 생성 즉시 stdin 파이프를 열고 `child.stdin.end()`로 EOF를 명시적으로 보내야 정상 동작합니다.
- 스키마 제약: 모든 object 타입에 `additionalProperties: false`가 선언되어 있지 않으면 OpenAI API 수준에서 `invalid_json_schema` 400 에러를 반환합니다.

### 2. Claude Code CLI (`runner/providers/claude.mjs`)
- 실행 커맨드: `claude -p <prompt> --add-dir <context_dir> --permission-mode plan --restricted`
- 스키마 옵션: `--json-schema <schema_json_string>` (파일 경로가 아닌 JSON 문자열을 직접 전달)
- 스트리밍 옵션: `-p`와 `--output-format stream-json`을 조합할 때는 반드시 `--verbose` 플래그를 함께 넘겨야 에러가 발생하지 않습니다.
- 유료 초과 과금 방지: 스트림 이벤트 중 `rate_limit_event`에서 `isUsingOverage: true`가 감지되면 즉시 프로세스를 강제 종료하고 `blocked_paid_overage` 상태로 작업을 정지시킵니다.

### 3. Antigravity CLI (`runner/providers/gemini.mjs`)
- 실행 커맨드: `agy -p <prompt> --add-dir <context_dir> --mode accept-edits --sandbox --output-format json`
- 실행 모드 주의점: `--mode plan`을 사용하면 실제 코드를 실행하지 않고 계획 파일만 작성한 뒤 사용자 입력을 대기하므로 출력이 비어버립니다. 헤드리스 단발 실행에는 `--mode accept-edits`를 지정해야 합니다.
- 구조화 출력 추출: 최종 스키마 준수 데이터는 `response` 필드가 아니라 `structured_output` 필드에 들어옵니다.
- description 강제: 스키마 내 각 프로퍼티에 `description`이 없으면 모델이 결과 대신 "작업 완료" 같은 메타 요약문을 채워 넣는 현상이 발생합니다.

---

## 6. 동적 스키마 정규화 (`runner/schema-compat.mjs`)

비서별로 모델을 교체하더라도 동일한 JSON 스키마가 세 도구 모두에서 정상 동작하도록 변환기를 제공합니다.

1. 재귀 트리 탐색(`walk`): 스키마의 모든 객체를 순회합니다.
2. `additionalProperties: false` 보장: 객체 정의에 누락된 경우 기본값으로 닫아 Codex 호환성을 확보합니다.
3. `description` 보장: Gemini(Antigravity) 프로바이더 실행 시, 설명이 없는 필드에 대체 설명을 주입하여 메타 텍스트 오염을 방지합니다.
4. 전달 방식 분기(`schemaArgsFor`):
   - Codex: 정규화된 스키마를 임시 파일에 기록하고 `--output-schema <path>`로 연결
   - Claude / Antigravity: 정규화된 스키마 객체를 JSON 문자열로 직렬화하여 `--json-schema <string>`으로 연결

---

## 7. 새로운 비서 및 프로바이더 추가 가이드

### 1. 새로운 비서 추가 절차
1. 스키마 및 컨텍스트 팩 정의: `runner/context-pack.mjs`에 새 비서용 JSON 스키마와 컨텍스트 생성 함수(`createXxxContextPack`)를 작성합니다.
2. 실행 핸들러 작성: `runner/index.mjs`에 `processXxxJob` 함수를 추가하고 `recordAndRun`을 호출하도록 연결합니다.
3. 작업 분기 추가: `runner/index.mjs`의 `processJob` 스위치문에 `job.kind` 분기를 등록합니다.
4. 프롬프트 마이그레이션: `supabase/migrations/`에 `prompt_templates` 시드 SQL을 추가합니다.

### 2. 새로운 AI CLI 프로바이더 연동 절차
1. 하네스 파일 생성: `runner/providers/<provider>.mjs`를 생성하고 `spawn<Provider>` 및 `extractOutput` 함수를 구현합니다.
2. 인증 검사 추가: `runner/safety.mjs`의 `providerStatus`에 CLI 설치 여부 및 구독 로그인 여부 판별 함수를 등록합니다.
3. 스키마 규칙 반영: 새 도구의 CLI 특이사항을 `runner/schema-compat.mjs`의 정규화 파이프라인에 반영합니다.
4. 실행기 연결: `runner/execute.mjs`에서 새 프로바이더의 프로세스를 실행하고 출력을 파싱하도록 매핑합니다.
