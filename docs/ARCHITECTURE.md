# 구조와 데이터 흐름

```text
브라우저 UI · localhost:3000
  ├─ 사무실 / 파이프라인 / 채용 보드
  ├─ Prompt Lab / 문서 보관함 / 설정
  └─ JSON 요청
        ↓
로컬 동반 서버 · 127.0.0.1:48620
  ├─ 구독 인증 검사 및 API 환경변수 제거
  ├─ 순차 오케스트레이션과 승인 게이트
  ├─ Codex CLI ── ChatGPT 구독
  ├─ Claude Code ── Claude 구독
  └─ SQLite · local-data/career-atelier.sqlite
        ├─ 사용자 프로필 / 경험 카드 / 채용공고
        ├─ 조사 문서 / 인계 산출물
        ├─ 프롬프트 / 하네스
        ├─ 자소서 / 버전
        └─ 실행 / 이벤트
```

## 다섯 비서

| 비서 | 역할 | 기본 실행기 | 다음 단계에 전달하는 것 |
|---|---|---|---|
| 루미 | 산업 뉴스 | Codex | 날짜·출처·채용 준비 시사점 |
| 모카 | 맞춤 채용 탐색 | Codex | 경험 매칭·부족 역량·지원 우선순위 |
| 솔 | 기업·직무 조사 | Claude Code | 공식 근거·직무 과제·문장 재료 |
| 뮤즈 | 자소서 작성 | Codex | 근거 기반 초안과 인계 요약 |
| 렌즈 | 교차 검수 | Claude Code | 오류·과장 위험·문장별 수정 제안 |

각 단계 출력은 `artifacts`에 먼저 저장되고 다음 단계의 컨텍스트에 포함됩니다. 작성 단계 출력은 선택된 자소서에 새 버전으로도 저장됩니다.

채용 탐색 단계는 사람이 읽는 보고서와 함께 `<jobs_json>` 구조화 블록을 출력합니다. 서버는 URL이 확인된 항목만 파싱해 `job_posts`에 저장하고, 같은 URL이 이미 있으면 업데이트합니다. 뉴스와 기업 조사 원문은 `research_notes`에도 보존됩니다.

## 승인과 재개

하네스의 `approvalBeforeDraft`가 켜져 있으면 기업 조사 뒤 `approval_required` 산출물을 저장하고 실행을 중지합니다. 사용자가 승인하면 같은 파이프라인 ID와 저장된 컨텍스트로 작성 단계부터 재개합니다. 중복 승인은 서버에서 차단합니다.

## 데이터 모델

핵심 테이블은 `profiles`, `experience_cards`, `job_posts`, `research_notes`, `prompt_templates`, `prompt_versions`, `harness_configs`, `essay_projects`, `essay_versions`, `agent_runs`, `run_events`, `artifacts`입니다. 외래 키와 인덱스를 사용하며 WAL 모드로 동작합니다.

기기 이전은 `/api/export/download`로 만든 JSON을 `/api/import/merge`에 전달합니다. 병합은 하나의 SQLite 트랜잭션에서 실행되고 삭제 연산을 사용하지 않습니다. 충돌하는 자소서 버전의 내용이 다르면 다음 버전으로 추가하며, 구독 전용·API 키 차단·유료 초과 차단 설정은 가져오기 내용과 관계없이 다시 고정됩니다. AI 로그인 정보는 데이터 모델과 백업 형식에 포함되지 않습니다.

## 왜 로컬 전용인가

웹 SaaS가 개인 Codex/Claude 구독 세션을 대신 사용하는 방식은 인증 전달과 서비스 정책 측면에서 적합하지 않습니다. 그래서 UI만 웹 기술로 만들고, 모델 호출·데이터·인증은 모두 사용자의 Mac 안에 유지합니다.
