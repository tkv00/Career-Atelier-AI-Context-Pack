# runner/mcp/ — Career Atelier MCP 서버

외부에 흩어져 있는 경험 정리본·기본정보를 **한 번에** 읽어 Career Atelier의
각 표에 바로 저장한다. MCP 클라이언트(Claude Code 등)가 stdio로 붙는다.

`runner/README.md`와 같은 규칙으로 쓴다 — **무엇이 실제로 검증됐고 무엇이
아직인지**를 분명히 적는다.

<br>

## 왜 만들었나

에이전트에게 "이 정리본 읽고 DB에 넣어 줘"라고 시키면 원문이 컨텍스트로
들어오고, 모델이 그걸 다시 구조화해 INSERT 인자로 뱉는다. **원문이 두 번,
정확히는 2.5배로 토큰이 된다.**

이 서버는 소스를 직접 읽고 DB에 직접 쓴다. 모델은 "어디서 가져와라"와 압축된
영수증만 주고받는다. 원문은 모델 컨텍스트를 **한 번도 통과하지 않는다.**

실제 측정 결과 동일한 입력에서 3,006 -> 114 토큰으로 약 96.2%의 토큰 소비를 절감합니다.

<br>

## 파일

| 파일 | 역할 |
|---|---|
| `server.mjs` | MCP JSON-RPC(stdio) 서버 + 툴 3종. CLI 모드도 겸한다 |
| `sources.mjs` | 소스 어댑터 — 로컬 파일 / Notion 페이지 · 데이터베이스 |
| `parse.mjs` | Markdown → 구조화 항목. 정규식만 쓴다(LLM 미사용) |
| `store.mjs` | 항목 → 표별 행 매핑·검증, Supabase 연결과 저장 |
| `metrics.mjs` | 토큰 계측 |
| `bench.mjs` | before/after 벤치마크 |
| `fixtures/sample-notes.md` | 표본 정리본. **입력 형식 문서 역할도 겸한다** |

<br>

## 툴 3종

| 툴 | 하는 일 |
|---|---|
| `preview_import` | 무엇이 저장될지 미리 보여준다. **DB에 쓰지 않는다** |
| `import_records` | 실제 저장. 기본값이 `dry_run=true`라 쓰려면 `dry_run=false` 명시 필요 |
| `db_snapshot` | 표별 현재 행 수. 임포트 전후 비교용 |

**기본값이 dry-run인 이유**: 이 DB에는 실제 지원 데이터가 들어간다. 툴은
모델이 자동으로 부를 수 있는 표면이라, 기본값이 쓰기면 오호출 한 번이 곧
오염이다. 보고 → 승인 → 쓰기 순서를 기본값으로 강제한다.

<br>

## 쓰는 법

### 1. MCP 클라이언트에 붙이기

리포 루트의 `.mcp.json`에 이미 등록돼 있다. Claude Code를 프로젝트 폴더에서
실행하면 잡히고, **최초 1회 승인**이 필요하다(`claude mcp list`에서
`[Pending approval]`로 보인다).

### 2. 정리본 형식

`fixtures/sample-notes.md`가 그대로 예시다. 규칙은 셋뿐이다.

```markdown
# 경험          ← 1단계 제목이 "어느 표에 넣을지"를 정한다
## 교내 스터디 운영진   ← 2단계 제목이 항목 하나(제목이 된다)
- 상황: ...            ← "- 키: 값"이 필드
- 결과: ...
- 수치: 출석률 40%→85%, 인원 12명   ← 쉼표로 나뉘어 배열이 된다
```

인식하는 섹션: `기본정보` · `경험` · `학력` · `자격증` · `대외활동` ·
`교육활동` · `프로젝트` · `경력사항` · `수상내역`

필드 이름은 별칭을 여럿 받는다(`상황`/`맥락`/`배경`, `결과`/`성과` 등).
**못 알아본 키는 버리지 않고** `detail`/`memo`로 흘려 넣는다 — 사용자가 쓴
내용이 조용히 사라지는 게 제일 나쁘다. 섹션 자체를 못 알아보면 `skipped`에
이유와 함께 담아 돌려준다.

### 3. 손으로 돌려보기

```bash
cd runner
npm run mcp:preview -- /절대경로/정리본.md   # 미리보기(안 씀)
node mcp/server.mjs import --source /절대경로/정리본.md          # dry-run
node mcp/server.mjs import --source /절대경로/정리본.md --write  # 실제 저장
npm run mcp:snapshot                          # 표별 행 수
npm run mcp:bench                             # 토큰 before/after
```

### 4. Notion 연결 (아직 안 해 둔 상태)

1. https://www.notion.so/my-integrations 에서 내부 통합 생성
2. 가져올 페이지·DB를 그 통합과 **공유**(Notion은 공유 안 하면 API에 안 보인다)
3. `runner/.env`에 `NOTION_TOKEN=secret_...` 추가
4. `source`를 `notion://page/<id>` 또는 `notion://database/<id>`로 지정

<br>

## 다른 LLM에서도 쓸 수 있는가 — 쓸 수 있다

**Claude 전용이 아니다.** Anthropic SDK를 안 쓰고 MCP 규약(JSON-RPC 2.0 over
stdio)만 구현했으므로, MCP를 지원하는 클라이언트면 무엇이든 붙는다.

이 기기에 설치된 세 CLI가 전부 MCP 서버를 붙일 수 있다는 걸 확인했다.

| CLI | 버전 | MCP 지원 | 등록 명령 |
|---|---|---|---|
| Codex (OpenAI) | 0.149.1 | `codex mcp` | `codex mcp add career-atelier -- node <경로>/server.mjs` |
| Claude Code (Anthropic) | 2.1.259 | `.mcp.json` · `--mcp-config` | 리포 루트 `.mcp.json`에 등록됨 |
| Antigravity (Google) | 1.1.24 | `agy mcp` | `agy mcp add career-atelier -- node <경로>/server.mjs` |

즉 **이 프로젝트가 쓰는 GPT · Claude · Gemini 세 구독 모두에서 같은 서버를
그대로 쓴다.** Cursor · Windsurf · Cline · Zed 등 MCP를 지원하는 다른 클라이언트도
같은 방식이다.

클라이언트마다 요청 습관이 달라서, 실제로 다양한 패턴을 넣어 확인했다.

- 구버전 프로토콜(`2024-11-05`)과 신버전(`2025-06-18`) 모두 협상 성공
- 지원하지 않는 버전을 요청하면 서버 지원 버전으로 폴백
- `clientInfo`·`capabilities.roots`·`capabilities.sampling`을 함께 보내도 정상
- `ping`, `tools/list {cursor:null}`, `arguments` 생략한 `tools/call` 모두 정상
- `notifications/cancelled` 같은 알림은 응답하지 않음(규약대로)
- `resources/list`·`prompts/list`는 빈 목록으로 답한다. 규약상 이 서버는
  tools만 선언하므로 클라이언트가 안 물어봐야 맞지만, 그냥 물어보는 구현이
  있어서 오류 대신 빈 목록으로 돌려준다 — 클라이언트 로그에 오류가 쌓여
  사용자가 고장으로 오해하는 걸 막는다.

**의존성이 0개**라는 점도 이식성에 그대로 기여한다. `node`만 있으면 돈다.

<br>

## 안전장치

러너와 같은 원칙을 그대로 따른다.

- **`service_role` 키를 쓰지 않는다.** 러너의 사용자 세션
  (`~/.career-atelier/session.json`)으로 로그인해 **RLS를 그대로 적용받는다.**
  남의 행은 애초에 안 보인다.
- **`runner/` 안에 있어 Vercel에 올라가지 않는다**(루트 `.vercelignore`).
- **쓰기 기본값은 dry-run.**
- **지우지 않는다.** 자연키가 같으면 갱신하고, 없으면 추가한다.
- **LLM을 부르지 않는다.** 파싱은 전부 정규식이다.
- **새 의존성 0개.** MCP 프로토콜을 직접 구현했고, Supabase 클라이언트는
  러너 것을 그대로 쓴다.

<br>

## 검증 상태

이 프로젝트의 기준("typecheck는 검증이 아니다")대로, 실제로 돌려 본 것과
아닌 것을 나눠 적는다. 전부 2026-09-03.

### 실제로 확인한 것

- **MCP 프로토콜 전 구간** — `initialize`(프로토콜 협상 포함) → `tools/list`
  → `tools/call` → 오류 경로(`isError:true`)까지 stdio로 직접 주고받아 확인.
  로그가 stdout을 오염시키지 않는 것도 확인(전부 stderr).
- **파싱·매핑** — 표본 12항목이 9개 표로 정확히 갈렸고, 학점 `3.82 / 4.5` →
  `gpa=3.82, gpa_scale=4.5`, 기간 `2020-03 ~ 2024-02` → 시작·종료일,
  `복수전공` → `secondary_major_type='복수전공'`, 수치·태그 배열 분리까지
  값 단위로 대조했다.
- **실제 Supabase 쓰기** — `[MCP-TEST]` 표식을 붙인 행 3건을 실제로 INSERT해
  `created:3, failed:0`을 확인하고, 저장된 값을 되읽어 대조한 뒤 **전부 삭제해
  원상복구**했다(검증 전후 행 수 동일).
- **멱등성** — 같은 소스로 재실행 시 `created:0, updated:3`. 중복이 쌓이지 않는다.
- **Claude Code 등록** — `claude mcp list`에 `career-atelier`로 잡히는 것 확인.

### 확인하지 못한 것

- **Notion 실호출.** 자격증명이 없어 **한 번도 호출하지 못했다.**
  `sources.mjs`의 Notion 코드는 API v1 문서 형태에 맞춰 썼을 뿐 실제 응답으로
  대조하지 않았다. 첫 호출 때 속성 이름이 어긋날 수 있다.
- **사용자의 실제 정리본 형식.** 표본은 내가 만든 것이다. 실제 정리본이 다른
  형식이면 `parse.mjs`의 별칭 표를 늘려야 한다.
- **Windows·Linux 실행.** macOS에서만 돌렸다. 경로 처리는 `fileURLToPath`로
  고쳐 뒀지만(`URL.pathname`은 Windows에서 `/C:/...`가 된다) 실제로 돌려보진 않았다.

<br>

## 작업 중 발견한 기존 결함

MCP와 무관하게 **원래 있던 문제**다. 여기서 걸려서 기록해 둔다.

**`education_records.gpa_scale`이 `numeric(4,2)`라 만점 100을 못 담는다.**
마이그레이션 `0020_personal_records.sql:27`의 주석은 만점 예시로
"4.5 / 4.3 / **100** 등"을 들고 있지만, `numeric(4,2)`의 상한은 99.99다.
실제로 `gpa_scale: 100`을 넣어 보면 `numeric field overflow`로 INSERT가 깨진다
(직접 확인).

백분위 학점을 쓰는 학교 출신이면 학력 저장이 실패한다. 이 서버는
`store.mjs`의 `safeNumeric()`으로 막고 경고로 올리지만(임포트 전체가 깨지지
않게), **근본 해결은 컬럼을 넓히는 마이그레이션**이다.

```sql
-- supabase/migrations/0023_widen_gpa_scale.sql (아직 만들지 않음)
alter table education_records alter column gpa_scale type numeric(5, 2);
```

마이그레이션은 append-only이고 스키마 변경에는 타입 재생성이 따라야 해서
(`supabase gen types typescript --linked`), 자는 사이에 임의로 추가하지 않고
판단을 남겨 둔다.
