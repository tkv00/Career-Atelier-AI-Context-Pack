# 개인정보와 비용 안전

## 인증정보

웹 UI와 SQLite에는 ChatGPT·OpenAI·Anthropic 비밀번호, 토큰, API 키를 저장하지 않습니다. 로컬에 설치된 Codex CLI와 Claude Code가 이미 가진 로그인 세션만 사용합니다.

## 실행 전 검사

- Codex: `codex login status` 결과가 ChatGPT/OAuth 구독 로그인일 때만 허용
- Claude Code: `claude auth status --json` 결과가 Claude 구독/OAuth일 때만 허용
- API 키 또는 알 수 없는 인증이면 `blocked_auth`로 기록하고 실행하지 않음

## 자식 프로세스에서 제거되는 변수

`OPENAI_API_KEY`, `OPENAI_BASE_URL`, `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, Bedrock·Vertex·Foundry 전환 변수를 제거합니다. 따라서 사용자의 셸에 API 키가 있어도 이 앱이 실행하는 비서에게 전달되지 않습니다.

## 사용량 한도

구독 사용량 한도는 피하지 않습니다. 한도·rate limit·reset 신호가 나타나면 실행 상태를 `waiting_for_reset`으로 저장합니다. Claude가 유료 초과 사용을 허용하는 신호를 보내면 `blocked_paid_overage`로 즉시 중단합니다.

## 네트워크와 파일

동반 서버는 루프백 주소에만 열립니다. Codex는 read-only sandbox와 임시 세션, Claude Code는 plan 권한과 제한된 읽기/검색 도구만 사용합니다. 각 실행에는 별도의 로컬 작업 폴더가 만들어집니다.

## 백업과 삭제

앱은 자동으로 외부 저장소에 업로드하지 않습니다. JSON 내보내기나 SQLite 파일 복사는 사용자가 직접 결정합니다. 민감한 자소서가 있으므로 프로젝트 폴더를 공유할 때 `local-data/`는 제외하세요.
