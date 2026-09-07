# Career Atelier 경험 가져오기 MCP

Excel·Markdown·JSON·Notion의 구조화된 정리본을 기존 이력정보·경험 카드 저장 파이프라인으로 연결하는 로컬 서버다. 모델이 원문을 다시 작성하지 않아도 되도록 소스를 직접 파싱한다. MCP는 도구 발견·호출의 공통 인터페이스이며 파싱이나 토큰 압축 알고리즘 자체는 아니다.

## 시작하기

Node 22.13 이상에서 `cd runner && npm ci`를 실행한다. DB에 쓰려면 프로젝트 설치와 본인 계정의 `npm run login`을 먼저 완료한다. 파일 미리보기에는 DB 로그인이 필요 없다. 일반 작업 큐 러너를 계속 켜 둘 필요도 없다.

저장소 루트의 `.mcp.json`을 지원하는 클라이언트에서 열거나, MCP 서버 실행 명령을 `node`, 인자를 `<저장소 절대경로>/runner/mcp/server.mjs`로 등록한다. 클라이언트의 승인·재연결 절차를 완료하면 아래 세 도구를 사용할 수 있다.

| 도구 | 하는 일 |
|---|---|
| `preview_import` | 제목 예시·테이블별 건수·진단·소스 해시를 반환. DB에 쓰지 않음 |
| `import_records` | 기본 `dry_run=true`. 명시적으로 `false`를 전달하면 저장 |
| `db_snapshot` | 사용자 세션으로 테이블별 행 수 조회 |

`source`는 로컬 파일 경로 또는 Notion 소스 URI다. `section`은 종류, `sheet`는 엑셀 시트, `column_map`은 원래 열 이름 → 지원 필드 이름이다. 저장에는 `only`로 종류를 제한하고, 미리보기의 `source_digest`를 `expected_digest`로 전달할 수 있다. 해시는 읽은 내용과 section·sheet·column_map에 적용되며, only나 현재 DB 상태를 고정하지 않는다.

## Excel 가져오기

[합성 예제 XLSX](fixtures/sample-experiences.xlsx)를 복사해 가상 경험을 실제 내용으로 바꾼다. 첫 행은 열 제목, 이후 한 행은 경험 하나다. 시트 이름을 `Experience` 또는 `경험`으로 두거나 `section`을 전달한다.

| 열 | 의미 |
|---|---|
| title / 제목 | 경험명, 필수 |
| context / 상황 | 배경 |
| problem / 문제 | 해결 대상 |
| role_scope / 역할 | 자신의 역할 |
| judgment / 판단 | 선택한 이유 |
| action / 행동 | 수행 내용 |
| result / 결과 | 결과 |
| trial_error / 시행착오 | 실패와 수정 |
| reflection / 회고 | 배운 점 |
| metrics / 수치 | 쉼표로 나눈 수치 목록 |
| tags / 태그 | 쉼표로 나눈 태그 목록 |

```bash
cd runner
node mcp/server.mjs preview --source /절대경로/경험.xlsx --sheet Experience --section 경험
node mcp/server.mjs import --source /절대경로/경험.xlsx --sheet Experience --section 경험
```

위 두 명령은 저장하지 않는다. 미리보기를 확인한 후 같은 import 명령에 `--only experience --expected-digest <미리보기 해시> --write`를 추가하면 쓴다.

기존 열 이름은 도구 인자 `column_map: {"경험 이름":"title","성과 요약":"result"}`로 연결한다. CLI에서는 `--column-map '{"경험 이름":"title","성과 요약":"result"}'`를 사용한다. 기본적으로 보이는 모든 시트를 읽고, `sheet`를 지정하면 그 시트만 읽는다.

- 지원: .xlsx, 날짜의 ISO 변환, 여러 시트, 셀 내부 줄바꿈·# 문자, rich text의 텍스트.
- 제한: 파일 10 MiB, 시트당 데이터 10,000행·100열. 압축 해제 후 메모리의 엄격한 격리 한도는 아니다.
- 수식·병합 셀은 거부한다. 일반 값으로 정리해야 한다. 숫자로 저장된 등록번호의 앞자리 0은 복원하지 못하므로 텍스트 셀을 사용한다.
- 제목 누락은 skipped, 알 수 없는 열은 warnings로 보고하며 **그 열의 값은 저장하지 않는다**. 중복 열·중복 필드 매핑은 오류다.
- 구형 .xls·CSV·OCR·자유 서술의 AI 추출은 지원하지 않는다.

## Markdown과 JSON

[Markdown 예제](fixtures/sample-notes.md)의 형식을 따른다.

```markdown
# 경험
## 스터디 운영
- 상황: 참여자 출석률 하락
- 행동: 난이도별 문제 분리
- 결과: 다음 학기 운영 지속
- 태그: 협업, 문제해결
```

1단계 제목은 종류, 2단계 제목은 항목, 목록의 키는 필드다. 지원 종류는 `profile / education / certification / activity / training / project / work / award / experience`이며 한글 별칭도 받는다. Markdown의 일부 미인식 키는 상세 내용·메모에 남지만, 엑셀의 미인식 열 보존 정책과 같지는 않다.

JSON은 `[{"kind":"experience","title":"경험명","fields":{"action":"행동","result":"결과"}}]` 또는 `{"items":[...]}` 형식이다. 잘못된 항목은 skipped로 보고한다. DB 백업 JSON을 그대로 가져오는 기능은 아니다.

## Notion 연결

1. [내부 통합](https://www.notion.so/my-integrations)을 만들고 해당 페이지·DB 읽기 권한을 부여한다.
2. 로컬 `runner/.env`에 `NOTION_TOKEN=<발급 토큰>`을 저장한다. 서버가 실행 위치와 관계없이 읽으며 기존 프로세스 변수가 우선한다.
3. MCP 서버를 재시작한다. 토큰을 웹 환경변수에 넣거나 Git에 커밋하지 않는다.

| URI | 입력 |
|---|---|
| `notion://page/<ID>` | 본문의 제목·목록을 Markdown 규칙으로 해석 |
| `notion://database/<ID>` | `section` 필수. 소스가 하나면 자동 선택 |
| `notion://data-source/<ID>` | `section` 필수. 여러 소스 중 하나를 명시 |

```bash
cd runner
node mcp/server.mjs preview --source "notion://database/<DB-ID>" --section 경험
```

일반 공유 URL이나 보기 ID 대신 32자리 페이지·DB·데이터 소스 ID를 사용한다. Notion API `2025-09-03`의 data_sources 조회와 페이지네이션을 사용한다. DB의 제목 속성은 자동으로 title에 매핑하며, 나머지 이름은 `column_map`으로 연결할 수 있다. 행 본문·첨부파일·지원하지 않는 속성은 가져오지 않는다. 페이지 중첩은 8단계, 블록/DB 행은 10,000개, 요청은 200회, HTTP 요청별 시간 제한은 20초다. 429 재시도나 자동 양방향 동기화는 없다.

## 저장과 진단

러너의 사용자 세션과 기존 Supabase 클라이언트를 사용한다. service_role 키를 요구하지 않고 기존 RLS의 적용을 받는다. 경험 제목 같은 자연키가 같으면 갱신하고, 없으면 추가한다. 삭제·일괄 롤백은 없다. 일부 행이 성공하고 일부가 실패할 수 있으므로 `written.created / updated / failed`와 `failures`를 확인한다. 제목 충돌이나 동시 가져오기의 경쟁 조건까지 막는 DB 유니크 제약은 이번 변경에 포함하지 않았다.

미리보기와 import의 `diagnostic_counts`는 전체 건수이며, skipped·rejected·warnings와 테이블별 제목 예시는 각 20개까지 반환한다. `expected_digest`는 선택적 변경 감지다. 검토·동의 여부를 서버가 판정하거나 트랜잭션으로 보장하지 않는다.

## 원리·코드 위치

초기화(`initialize → notifications/initialized`) 이후 `tools/list`로 스키마를 찾고 `tools/call`로 호출한다. stdin/stdout의 한 줄 JSON-RPC를 쓰며 로그는 stderr에 남긴다. MCP 서버는 로컬 파일·Notion을 읽고 검증한 뒤 사용자의 DB 세션으로 저장한다. AI 자격증명을 웹에 전달하지 않는다.

| 파일 | 책임 |
|---|---|
| server.mjs | 도구 스키마, 파이프라인, stdio/CLI, digest |
| sources.mjs / env.mjs | 파일·Notion 소스와 로컬 환경변수 |
| excel.mjs / tabular.mjs | XLSX 해석, 열 매핑, 표의 행 경계 보존 |
| parse.mjs / store.mjs | Markdown·필드 별칭, 행 검증과 기존 저장 로직 |
| metrics.mjs | 문자 종류별 토큰 추정, 로컬 기록 |
| research/benchmark.mjs | 실제 직접 호출 대 MCP 호출, 원시 데이터 |
| research/client.mjs | 별도 프로세스 stdio 측정 클라이언트 |
| test/mcp-import.test.mjs (runner 기준) | 소스·프로토콜·저장 함수 실행 테스트 |

새 직접 의존성 ExcelJS 4.4.0은 표준 라이브러리에 없는 OOXML ZIP/XML·공유 문자열·날짜 처리를 맡는다. 간접 uuid는 11.1.1로 제한했다. MCP SDK는 추가하지 않았으므로 프로토콜 변경의 유지보수는 이 구현이 담당한다. 현재 tools 중심의 stdio 구현이며 모든 MCP 기능의 완전한 적합성 검증을 주장하지 않는다.

## 성능 측정


```bash
cd runner
npm test
npm run mcp:research
cd ..
python3 scripts/render-mcp-research.py
```

결과는 로컬 `docs/research/mcp-import/`에 생성되며 Git 추적에서 제외된다.

`npm run mcp:bench`도 동일한 재현 실험을 실행한다. 렌더러에는 matplotlib·numpy·Pillow와 Graphviz, 한국어 글꼴이 필요하다. 서비스 런타임 의존성은 아니다.

- A: 원문 + DB 인자 재서술 문자열의 **가정 기준선**. 실제 모델 실행 없음.
- B: 같은 파서를 직접 호출하는 dry-run. 실제 시간 측정.
- C: 같은 파서를 별도 MCP stdio 프로세스로 호출하는 dry-run. 실제 시간·요청/응답 바이트 측정.
- 한글/영문 × MD/XLSX × 10/100/1,000건, 각 B·C 20회 = 480회. 합성 입력 48,840개 필드 일치.
- 실제 DB 쓰기·Notion 네트워크·LLM 실행 시간·사용자 입력 시간·제공자 토큰은 이 벤치마크에서 측정하지 않았다.

`token_metrics`는 과거 형식과의 호환을 위한 문자 기반 추정이다. 도구 스키마·요청·프로토콜 외피·metrics 필드를 제외하므로 자체 절감률을 실제 비용 절감으로 인용하면 안 된다. 연구 벤치마크는 이들과 미리보기 왕복을 별도로 포함해 기록한다. 일반 호출의 로컬 메트릭 로그도 성능에 영향을 줄 수 있어 실험에서는 `CAREER_MCP_METRICS_DISABLED=1`로 끈다.


## 이번 변경에서 실제로 검증한 범위

2026-09-06 macOS에서 실제 XLSX 생성·파싱, 한글·영문 필드값, 수식·병합 셀 거부, 날짜, 열 매핑, JSON 진단, 변경 해시를 검사했다. 별도 Node 프로세스로 MCP 초기화·발견·미리보기·dry-run·오류 응답을 주고받았다.

Notion은 고정 HTTP 응답으로 데이터 소스 탐색·페이지네이션·중첩·권한 오류를 검사했다. 저장 함수는 메모리 DB 대역으로 생성·갱신·소유자 필터·일부 실패를 검사했다. **실 Notion 계정, 운영 Supabase 쓰기, 실제 LLM 호출과 Windows/Linux는 이번 검증에 포함하지 않았다.** 기존 실데이터는 변경하지 않았다. 합성 템플릿의 일치율을 임의 사용자 문서의 정확도로 일반화할 수 없다.
