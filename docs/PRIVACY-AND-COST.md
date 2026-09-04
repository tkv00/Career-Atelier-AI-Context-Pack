# 개인정보와 비용 안전

## AI 자격증명은 클라우드에 절대 가지 않는다

ChatGPT·Claude 로그인 세션은 `~/.codex/`, `~/.claude/` 등 러너가 실행되는 기기에만 존재한다. Supabase, Vercel 어디에도 이 토큰이 저장되지 않는다 — 애초에 전송하는 코드가 없다.

- OpenAI / Anthropic API 키는 이 프로젝트 어디에도 만들지 않는다.
- Supabase `service_role` 키는 러너에도, Vercel 환경변수에도 두지 않는다. `web/lib/env.ts`가 실수로라도 이런 이름의 환경변수가 설정돼 있으면 빌드·런타임에서 즉시 에러를 낸다.

## 실행 전 검사

- Codex: `codex login status`가 ChatGPT/OAuth 구독 로그인일 때만 허용
- Claude Code: `claude auth status`가 Claude 구독/OAuth일 때만 허용
- API 키 또는 알 수 없는 인증이면 `blocked_auth`로 기록하고 실행하지 않는다

## 자식 프로세스에서 제거되는 변수

`OPENAI_API_KEY`, `OPENAI_BASE_URL`, `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, Bedrock·Vertex·Foundry 전환 변수를 러너가 자식 프로세스에서 제거한다. 셸에 API 키가 있어도 비서에게 전달되지 않는다.

## 사용량 한도

구독 공급자가 적용하는 사용량 한도는 피하지 않는다. 한도·rate limit·reset 신호가 나타나면 실행 상태를 `waiting_for_reset`으로 저장한다. Claude가 유료 초과 사용을 허용하는 신호를 보내면 `blocked_paid_overage`로 즉시 중단한다. 러너 자체의 일일 실행 횟수 제한은 두지 않지만, 실패한 실행의 자동 재시도는 0회다. 단, 루미·모카가 정상 종료했지만 실제 검색 도구를 호출하지 않았거나 저장 가능한 결과가 0건인 경우에는 거짓 완료를 막기 위해 최대 1회만 품질 재시도한다. Codex 루미·모카의 정상 실행은 검색 전용 호출과 JSON 구조화 전용 호출로 분리되므로 모델 호출을 두 번 사용한다.

| 안전장치 | 값 |
|---|---|
| 동시 실행 | 1개 |
| 단일 실행 타임아웃 | 상한 15분 |
| 실패 재시도 | 0회 |
| 루미·모카 검색 품질 재시도 | 최대 1회 |
| 잡 유효기간 | 6시간(초과 시 폐기) |

이 값들은 러너 코드의 상수다. UI에서 끌 수 없다.

## 데이터는 어디에 있는가

| 항목 | 클라우드(Supabase)에 있는가 |
|---|---|
| 자소서 본문·버전·경험 카드·공고·조사 결과 | 있다 — 여러 기기에서 이어 쓰려면 필요하다 |
| 프롬프트·실행 로그 | 있다 |
| ChatGPT / Claude 로그인 토큰 | 없다 |
| API 키 | 없다 |
| Supabase `service_role` 키 | 없다 |

Row Level Security가 모든 테이블에 걸려 있다 — `owner_id = auth.uid()`가 아닌 행은 어떤 키로도 조회되지 않는다.

## 계정 접근

첫 번째로 가입한 계정만 그 인스턴스의 소유자가 된다. 그 뒤로는 신규 가입 자체가 막힌다. 웹 로그인은 이메일과 비밀번호뿐이다.

## 백업

앱은 자동으로 외부 저장소에 업로드하지 않는다. 러너를 켜 두면 2시간마다 전체 데이터를 로컬 폴더에 JSON으로 백업할 수 있다(옵션, `docs/USER-GUIDE.md` 참고). 이 백업 파일에는 자소서·경험 등 개인 데이터가 그대로 담기므로, 폴더를 공유하거나 리포에 커밋하지 않는다.
