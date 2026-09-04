# Career Atelier 러너 (Runner)

Career Atelier의 로컬 실행 엔진입니다. 사용자의 로컬 컴퓨터에서 백그라운드로 동작하며, 작업 큐를 감시하고 개인 구독 중인 AI CLI(Codex, Claude Code, Antigravity)를 안전하게 호출하여 결과를 데이터베이스에 저장합니다.

상세한 하네스 아키텍처 및 프로바이더별 실행 옵션은 [docs/HARNESS-ENGINEERING.md](../docs/HARNESS-ENGINEERING.md)를 참고하세요.

---

## 1. 주요 역할 및 구조

- 작업 큐 폴링 및 클레임: Supabase의 `claim_next_job` 함수를 주기적으로 호출해 대기 중인 작업을 선점합니다.
- 구독 인증 강제: 실행 직전 CLI의 로그인 상태를 확인하고, API 키 환경변수를 자식 프로세스에서 원천 차단합니다.
- 컨텍스트 팩 빌드: 임시 폴더에 작업별 근거 파일과 입력을 준비하고 격리된 상태로 모델에 전달합니다.
- 실시간 스트리밍 중계: CLI가 생성하는 청크 이벤트를 200ms 단위로 묶어 `run_events` 테이블에 저장합니다.
- 마감일 일정 자동 연쇄: 모카(채용 탐색) 완료 즉시 노바(Nova)가 마감일을 파싱해 캘린더에 동기화합니다.
- 로컬 데이터 백업: 사용자가 설정한 로컬 폴더에 2시간 주기로 전체 데이터베이스 JSON 스냅샷을 백업합니다.

### 디렉터리 구성

| 파일 및 폴더 | 역할 |
|---|---|
| `index.mjs` | 진입점(`login`, `start`, `logout`), 작업 폴링 및 비서별 핸들러 오케스트레이션 |
| `execute.mjs` | 프로바이더 공통 실행기 (프로세스 관리, 200ms 스트림 배칭, 유료 초과 감지) |
| `safety.mjs` | 불변 안전장치 (민감 환경변수 제거, 동시 실행·타임아웃 제한, 구독 인증 검사) |
| `context-pack.mjs` | 비서별 작업 폴더 생성, 근거 파일 주입 및 JSON 스키마 정의 |
| `schema-compat.mjs` | 프로바이더 간 JSON 스키마 동적 정규화 (`additionalProperties`, `description`) |
| `nova.mjs` | 마감일 정규식 파싱 및 `calendar_events` 동기화 (LLM 미사용) |
| `scheduler.mjs` | 매일 15시(KST) 자동 채용 탐색 스케줄러 상태 관리 |
| `backup.mjs` | 로컬 지정 폴더 자동 백업 로직 |
| `providers/` | CLI별 커맨드라인 인자 구성 (`codex.mjs`, `claude.mjs`, `gemini.mjs`) |
| `lib/` | Supabase 클라이언트, 세션 스토리지, 환경변수 유틸리티 |
| `mcp/` | 외부 노트(Markdown, Notion) 무토큰 임포트용 로컬 MCP 서버 |

---

## 2. 러너 실행 및 사용 방법

### 1) 환경변수 설정
`runner/.env.example`을 복사해 `.env`를 생성하고, Supabase 접속 정보를 입력합니다. (설치 마법사 `npm run setup` 실행 시 자동 생성됩니다.)

```bash
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=eyJ...
```

### 2) 러너 로그인 (최초 1회)
웹 앱과 동일하게 이메일+비밀번호로 로그인합니다. 러너도 사용자 세션으로 로그인해 RLS를 그대로 적용받으며 `service_role` 키는 사용하지 않습니다.

```bash
npm run login
```

- 로그인 성공 시 세션 토큰은 운영체제와 관계없이 `~/.career-atelier/session.json`(권한 0600)에 저장됩니다.
- 리프레시 토큰이 갱신될 때마다 세션 파일도 자동으로 갱신됩니다.

### 3) 러너 시작
```bash
npm run start
```

- 첫 실행 시 `runners` 테이블에 미승인 기기로 등록됩니다.
- 웹 대시보드(관제실)의 하단 "러너" 목록에서 해당 기기를 [승인]해야 실제로 작업을 가져옵니다.

---

## 3. 안전 불변식

다음 값들은 코드에 상수로 고정되어 있으며 UI나 설정 파일에서 끌 수 없습니다.

- 동시 실행: 1개 프로세스
- 단일 실행 타임아웃: 15분
- 실패 재시도: 0회 (실패한 실행은 자동 재실행하지 않음)
- 검색 품질 재시도: 최대 1회 (루미·모카가 검색 도구를 호출하지 않았거나 저장 가능한 결과가 0건일 때만)
- 검색 재시도 우선순위: 원래 작업보다 1 높음 (새 일반 작업보다 먼저 마무리하도록 함)
- 작업 유효기간: 6시간 (초과 시 `expired` 처리)
- 하트비트 주기: 15초 (90초 이상 응답 없으면 작업을 큐로 회수)

---

## 4. 개발 시 주의사항

1. Node.js 프로세스 재시작: 러너 코드는 핫리로드를 지원하지 않습니다. `runner/` 내부의 코드를 수정한 뒤에는 반드시 `npm run start` 프로세스를 재시작해야 변경 사항이 반영됩니다.
2. CLI 프로바이더 동작 확인:
   - Codex: 모든 스키마 객체에 `additionalProperties: false` 필수.
   - Codex 실시간 검색: 전역 옵션이라 `codex --search exec` 순서여야 함. 루미·모카 실행 스트림에 `item.type = "web_search"`가 실제로 있었는지도 검증함.
   - Claude Code: `--json-schema`는 파일 경로가 아닌 JSON 문자열을 직접 전달해야 함.
   - Antigravity: 스키마 프로퍼티마다 `description`이 필수이며, 결과값은 `structured_output`에서 파싱.
3. Vercel 배포 제외: `runner/` 폴더는 로컬 머신 전용 프로세스이므로 클라우드 웹 배포에 포함되지 않아야 합니다. 루트의 `.vercelignore`에 명시되어 있습니다.
4. 무음 대기 방지: 승인 해제나 Supabase 조회 실패로 큐가 멈추면 러너가 원인을 한 번 출력합니다.
