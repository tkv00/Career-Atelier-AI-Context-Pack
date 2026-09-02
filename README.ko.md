<img src="docs/images/banner.png" alt="Career Atelier" width="100%">

<p>
  <img alt="license" src="https://img.shields.io/badge/license-MIT-f5a962?style=flat-square">
  <img alt="node" src="https://img.shields.io/badge/node-%E2%89%A522-5cc98f?style=flat-square&logo=node.js&logoColor=white">
  <img alt="next.js" src="https://img.shields.io/badge/Next.js-16-e6eef7?style=flat-square&logo=next.js&logoColor=white">
  <img alt="supabase" src="https://img.shields.io/badge/Supabase-Postgres%20%2B%20RLS-3ecf8e?style=flat-square&logo=supabase&logoColor=white">
  <img alt="platform" src="https://img.shields.io/badge/Windows%20%7C%20macOS%20%7C%20Linux-58cfe4?style=flat-square">
  <img alt="api billing" src="https://img.shields.io/badge/API%20billing-none-5cc98f?style=flat-square">
</p>

**[English](README.md)** · 한국어

---

구독 중인 ChatGPT·Claude·Gemini를 그대로 써서 채용 준비를 도와주는 자체 호스팅 작업실입니다.

토큰당 과금되는 API 키는 쓰지 않습니다. 이미 내고 있는 구독료 안에서 7명의 AI 비서가 뉴스 조사부터 자소서 검수, 면접 준비까지 이어서 처리합니다.

<img src="docs/images/screens/00-login.png" alt="로그인 화면" width="100%">

<br>

## 목차

- [왜 만들었나](#왜-만들었나)
- [7명의 비서](#7명의-비서)
- [주요 화면](#주요-화면)
- [구조](#구조)
- [시작하기](#시작하기)
- [데이터 백업](#데이터-백업)
- [비용이 늘지 않는 이유](#비용이-늘지-않는-이유)
- [기여하기](#기여하기)

<br>

## 왜 만들었나

지원할 때마다 같은 일을 반복합니다.

이 회사가 정확히 뭘 하는지 찾아보고, 최근에 뭘 냈는지 확인하고, 내 경험 중 어떤 게 이 자리와 맞는지 고르고, 비슷한 문항에 예전에 뭐라고 썼는지 다시 뒤집니다.

이 과정을 AI에게 시키려면 보통 두 가지 중 하나를 골라야 합니다. API 키를 발급해 토큰 단위로 돈을 내거나, 매번 챗봇 창에 내 경험을 처음부터 다시 붙여넣거나.

Career Atelier는 세 번째 방법입니다. **이미 구독 중인 CLI 도구**(Codex, Claude Code, Antigravity)를 로컬에서 호출하고, 맥락은 내 데이터베이스에 쌓아 둡니다.

<br>

## 7명의 비서

각 비서는 자기 담당 화면에서 실행되고, 결과는 구조화된 JSON으로 검증된 뒤 저장됩니다.

<br>

<table>
<tr>
<td width="130" align="center"><img src="docs/images/agents/agent-news.png" width="100" alt="루미"></td>
<td>

### 루미 · 관심 분야 뉴스 조사

**실행** Codex · **저장** `research_notes` (kind: `news`)

`context/01-interests.md`에 적어 둔 관심 분야를 **웹에서 실제로 검색**합니다. 모델이 아는 내용만으로 답하지 않도록 프롬프트에 명시돼 있고, Codex의 자동 `web_search` 도구가 붙습니다.

최근 1~2주 내 뉴스 3~5건을 고르고, 각각 제목·출처·실제 URL·날짜를 함께 반환합니다.

관제실의 루미 카드에서 바로 실행합니다.

</td>
</tr>

<tr>
<td width="130" align="center"><img src="docs/images/agents/agent-jobs.png" width="100" alt="모카"></td>
<td>

### 모카 · 채용공고 탐색

**실행** Codex · **저장** `job_posts` → `calendar_events` 자동 연쇄

프로필과 경험 카드를 읽고 맞는 공고를 찾아 적합도(`fit_score`)를 매깁니다. 경험 카드가 없으면 점수를 억지로 올리지 않고 낮게 주거나 빈 결과를 반환합니다.

공고를 저장하면 곧바로 **노바**가 마감일을 정규식으로 파싱해 캘린더에 넣습니다. "상시채용"처럼 마감일이 없는 표기는 일정을 만들지 않습니다.

같은 URL은 새로 만들지 않고 기존 공고를 갱신합니다.

**매일 15시(KST)에 자동 실행됩니다.** 노트북이 꺼져 있었다면 그날 안에 켜질 때 실행되고, 날짜가 넘어가면 건너뜁니다.

</td>
</tr>

<tr>
<td width="130" align="center"><img src="docs/images/agents/agent-company.png" width="100" alt="솔"></td>
<td>

### 솔 · 기업·직무 조사

**실행** Claude Code · **저장** `research_notes` (kind: `company`)

회사명과 직무를 주면 공시·재무제표·기술 블로그 같은 **1차 자료 중심**으로 조사합니다. 결과에는 출처 URL이 함께 붙습니다.

단순 요약에서 그치지 않고 "이 회사에 지원한다면 어떤 각도로 쓸 수 있는지"까지 제안합니다.

자소서 편집 화면에서 실행하며, 결과는 뮤즈가 초안을 쓸 때 근거로 넘어갑니다.

</td>
</tr>

<tr>
<td width="130" align="center"><img src="docs/images/agents/agent-writer.png" width="100" alt="뮤즈"></td>
<td>

### 뮤즈 · 자소서 초안 작성

**실행** Codex · **저장** `artifacts` (kind: `draft`)

문항과 목표 글자 수를 받아 초안을 씁니다. **근거는 내가 기록한 경험 카드와 솔의 조사 결과 안에서만** 쓸 수 있습니다.

지어내기를 막는 장치가 3겹입니다.

1. 프롬프트에서 근거 밖 사실을 금지
2. 출력 스키마가 문단마다 `evidence` 배열을 요구 — 어떤 경험을 근거로 썼는지 명시
3. **코드가 `experience_id`를 실제 카드와 대조**해, 존재하지 않는 id는 위반으로 기록

초안은 바로 반영되지 않습니다. 저장된 산출물을 확인하고 [반영]을 눌러야 본문이 됩니다.

</td>
</tr>

<tr>
<td width="130" align="center"><img src="docs/images/agents/agent-review.png" width="100" alt="렌즈"></td>
<td>

### 렌즈 · 근거 검수

**실행** Claude Code · **저장** `artifacts` (kind: `review`)

완성된 본문을 읽고 과장·근거 없는 주장·직무 부적합을 찾습니다.

지적은 유형이 붙습니다. `fact_error`(사실 오류), `overclaim`(과장), 근거 누락 등으로 나뉘고, 각각 구체적인 수정 제안이 따라옵니다.

경험 카드에 없는 수치를 본문에 쓰면 잡아냅니다.

</td>
</tr>

<tr>
<td width="130" align="center"><img src="docs/images/agents/agent-interview.png" width="100" alt="에코"></td>
<td>

### 에코 · 면접 질문 생성

**실행** Codex · **저장** `interview_questions`

공고·기업 조사·내 경험 카드를 함께 읽고 예상 질문을 만듭니다.

질문은 카테고리(기업·직무·경험 등)로 분류되어 저장되고, 훈련실 화면에서 답변을 적고 다듬을 수 있습니다.

</td>
</tr>

<tr>
<td width="130" align="center">

**소제목**

<sub>(전용 이미지 없음)</sub>

</td>
<td>

### 소제목 · 문항 소제목 제안

**실행** Antigravity (Gemini 3) · **저장** `artifacts` (kind: `subtitle`)

완성된 자소서 본문을 읽고 **15자 이내** 소제목을 제안합니다.

본문에 없는 사실을 만들지 않고 표현만 압축합니다. 새 주장을 만드는 게 아니라서 뮤즈의 3겹 근거 검증은 적용하지 않지만, **본문이 비어 있으면 실행을 거부**합니다.

다른 비서와 마찬가지로 제안일 뿐이고, [반영]을 눌러야 확정됩니다.

</td>
</tr>
</table>

<br>

> **비서를 쓰려면 해당 CLI에 로그인돼 있어야 합니다.** 셋 다 설치할 필요는 없습니다. Codex만 로그인해 두면 루미·모카·뮤즈·에코가 동작하고, 나머지는 실행해도 실패로 남습니다.

<br>

## 주요 화면

### 관제실

7명의 상태를 한 화면에서 봅니다. 지금 도는 비서, 마지막 실행 결과, 러너 연결 여부, 오늘 실행 횟수가 보입니다.

루미와 모카는 각자의 카드에서 바로 실행할 수 있습니다.

<!-- 자리표시자 — 이 파일을 실제 캡처로 덮어쓰세요. 규격: docs/images/screens/README.md -->
<img src="docs/images/screens/01-dashboard.png" alt="관제실" width="100%">

<br>

### 채용 캘린더

마감일을 달력으로 봅니다. **날짜에 마우스를 올리면** 그날 마감인 공고가 회사명·직무·현재 전형 상태와 함께 목록으로 펼쳐집니다.

<!-- 자리표시자 — 이 파일을 실제 캡처로 덮어쓰세요. 규격: docs/images/screens/README.md -->
<img src="docs/images/screens/02-calendar.png" alt="채용 캘린더" width="100%">

<br>

### 전형별 합불 기록

합불을 서류 하나로 뭉뚱그리지 않습니다. **서류 · 필기시험 · 코딩테스트 · 기술면접 · 최종면접**을 따로 기록합니다.

칩을 누를 때마다 `대기 → 합격 → 불합격 → 대기`로 순환합니다.

<!-- 자리표시자 — 이 파일을 실제 캡처로 덮어쓰세요. 규격: docs/images/screens/README.md -->
<img src="docs/images/screens/03-stage-board.png" alt="전형별 합불" width="100%">

<br>

### 명령 실험실

각 비서의 시스템 프롬프트를 직접 고칩니다.

저장할 때마다 이전 본문이 버전으로 남고, 언제든 되돌릴 수 있습니다. 되돌리기도 새 버전으로 쌓이기 때문에 기록이 사라지지 않습니다.

<!-- 자리표시자 — 이 파일을 실제 캡처로 덮어쓰세요. 규격: docs/images/screens/README.md -->
<img src="docs/images/screens/04-prompt-lab.png" alt="명령 실험실" width="100%">

<br>

### 경험 아카이브

프로젝트 경험을 상황·문제·역할·판단·행동·결과·시행착오·회고로 나눠 기록합니다.

여기 적은 것만 뮤즈가 근거로 쓸 수 있습니다.

<!-- 자리표시자 — 이 파일을 실제 캡처로 덮어쓰세요. 규격: docs/images/screens/README.md -->
<img src="docs/images/screens/05-experiences.png" alt="경험 아카이브" width="100%">

<br>

### 면접 훈련실

에코가 만든 질문에 답을 적고 다듬습니다.

<!-- 자리표시자 — 이 파일을 실제 캡처로 덮어쓰세요. 규격: docs/images/screens/README.md -->
<img src="docs/images/screens/06-interviews.png" alt="면접 훈련실" width="100%">

<br>

## 구조

```
                    ┌──────────────────────────────┐
브라우저  ────────▶ │  Vercel (web/)               │
                    │  · 데이터만 보관              │
                    │  · AI 자격증명 없음           │──┐
                    └──────────────────────────────┘  │
                                                      │  Supabase
                    ┌──────────────────────────────┐  │  Postgres + Auth + RLS
내 컴퓨터 ────────▶ │  runner/ (Node)              │◀─┘
                    │  · 작업 큐 폴링               │
                    │  · CLI 실행 · 결과 저장        │
                    └───────────┬──────────────────┘
                                │
                    codex · claude · agy
                    (구독 OAuth, 이 기기 밖으로 안 나감)
```

웹 앱은 비서를 직접 실행하지 않습니다. 작업 큐에 한 줄 넣을 뿐입니다.

내 컴퓨터에서 내 계정으로 로그인해 도는 러너가 그 작업을 집어 컨텍스트를 만들고, 알맞은 CLI를 실행하고, 결과를 되돌려 저장합니다.

**러너를 꺼도 사이트는 그대로 동작합니다.** 새 비서 실행만 못 하게 됩니다.

<br>

## 시작하기

### 준비물

| 항목 | 확인 |
|---|---|
| Node.js 22 이상 | `node -v` |
| Supabase 무료 프로젝트 | [supabase.com](https://supabase.com) |
| Supabase CLI | `npm install -g supabase` |
| AI CLI 최소 1개 | 아래 표 |

<br>

| CLI | 담당 비서 | 설치 · 로그인 |
|---|---|---|
| Codex | 루미 · 모카 · 뮤즈 · 에코 | `npm install -g @openai/codex` → `codex login` |
| Claude Code | 솔 · 렌즈 | `npm install -g @anthropic-ai/claude-code` → `claude auth login` |
| Antigravity | 소제목 | [antigravity.google](https://antigravity.google) 설치 후 `agy` 실행 |

<br>

### 설치

Windows · macOS · Linux 모두 같은 명령입니다.

```bash
git clone https://github.com/tkv00/Career-Atelier-AI-Context-Pack.git
cd Career-Atelier-AI-Context-Pack
npm run setup
```

`npm run setup`이 하는 일:

1. Node · Supabase CLI · AI CLI 설치 상태 확인
2. Supabase 프로젝트 연결
3. 테이블 · 보안 정책 · 기본 프롬프트 적용
4. `web/.env.local`과 `runner/.env` 생성

<br>

### 실행

터미널 두 개가 필요합니다.

```bash
# 1번 창 — 웹 앱
cd web && npm install && npm run dev
```

```bash
# 2번 창 — 러너
cd runner && npm install && npm run login && npm run start
```

http://localhost:3000 에 접속해 본인 이메일로 로그인합니다.

> **가장 먼저 가입한 계정이 그 인스턴스의 소유자가 되고, 이후 가입은 전부 거부됩니다.** 첫 로그인을 본인 이메일로 하세요.

마지막으로 관제실 화면 아래 "러너" 목록에서 이 기기를 **승인**하면 작업을 받기 시작합니다. 기기마다 한 번만 하면 됩니다.

<br>

### 배포

Vercel 프로젝트의 Root Directory를 `web/`로 잡고 환경변수 두 개만 넣습니다.

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

service_role 키나 AI 제공자 키는 넣지 마세요. **일부러 빌드가 거부합니다** (`web/lib/env.ts`).

자세한 내용은 [docs/V2-SETUP.md](docs/V2-SETUP.md)에 있습니다.

<br>

## 데이터 백업

Supabase 무료 플랜은 한동안 안 쓰면 프로젝트를 정지시킵니다. 클라우드 하나만 믿으면 다시 쓰기 어려운 글이 통째로 사라질 수 있습니다.

관제실의 러너 항목에서 **로컬 폴더 자동 백업**을 켜고 절대 경로를 하나 지정하세요.

- macOS · Linux — `~/career-atelier-backups`
- Windows — `C:\career-atelier-backups`

러너가 켜져 있는 동안 6시간마다 전체 데이터를 JSON으로 저장합니다. 하루에 파일 하나라 폴더가 무한정 커지지 않습니다.

> 백업은 브라우저가 아니라 러너가 씁니다. 웹페이지는 내 디스크의 임의 폴더에 파일을 쓸 수 없기 때문입니다. **러너가 꺼져 있으면 백업도 안 됩니다.**

<br>

## 비용이 늘지 않는 이유

"추가 비용 없음"은 **토큰 단위 API 과금이 없다**는 뜻입니다. 구독료 자체는 그대로 나가고, 구독 플랜의 사용량 한도도 그대로 적용됩니다.

러너가 강제하는 것:

- 자식 프로세스에서 `OPENAI_API_KEY` · `ANTHROPIC_API_KEY` 등 **API 키 환경변수를 제거**합니다.
- 실행 직전 각 CLI가 **구독 로그인 상태인지 확인**합니다. 아니면 실행하지 않습니다.
- Claude의 **유료 초과 사용 신호를 감지하면 즉시 중단**합니다.
- 사용량 한도에 닿으면 API로 우회하지 않고 `waiting_for_reset` 상태로 멈춥니다.

이 값들은 코드에 고정돼 있고 화면에서 끌 수 없습니다.

| 안전 상한 | 값 |
|---|---|
| 일일 실행 | 40회 |
| 동시 실행 | 1개 |
| 단일 실행 타임아웃 | 15분 |
| 재시도 | 0회 |
| 작업 유효기간 | 6시간 |

<br>

## 기여하기

기여를 환영합니다. 개발 환경 설정과 PR 기준은 [CONTRIBUTING.md](CONTRIBUTING.md)에 있습니다.

각자 자기 Supabase 프로젝트로 개발하므로 **망가뜨릴 공용 개발 DB가 없습니다.**

시작하기 좋은 곳:

- 러너에 아직 macOS 기준으로 짜인 부분이 남아 있습니다. Windows · Linux 실제 테스트가 특히 도움이 됩니다.
- 비서는 `runner/context-pack.mjs`와 `runner/providers/`에 정의돼 있습니다. 새 제공자를 붙이는 건 파일 하나를 추가하는 일입니다.
- 소제목 비서의 캐릭터 이미지가 없습니다.
- 훈련실과 명령 실험실 화면의 검증이 가장 얇습니다.

<br>

## 문서

| 문서 | 내용 |
|---|---|
| [docs/USER-GUIDE.md](docs/USER-GUIDE.md) | OS별 설치·사용 안내 |
| [docs/V2-SETUP.md](docs/V2-SETUP.md) | Supabase · Vercel 설정 |
| [docs/DESIGN-V2-CLOUD.md](docs/DESIGN-V2-CLOUD.md) | 설계 결정과 근거 |
| [docs/PRIVACY-AND-COST.md](docs/PRIVACY-AND-COST.md) | 개인정보·비용 보장 |
| [runner/README.md](runner/README.md) | 러너 내부 구조와 검증 기록 |

<br>

## 라이선스

MIT — [LICENSE](LICENSE)
