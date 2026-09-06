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

**흩어진 취업 준비를, 나만의 작업실 하나로.**

Notion에 적어 둔 이력과 경험, 채용 사이트의 공고, 캘린더의 마감일, ChatGPT·Claude에서 쓰던 자소서를 한 흐름으로 연결합니다. Career Atelier는 내 Supabase에 자료를 모으고, 내 컴퓨터의 AI CLI로 조사·작성·검수를 실행하는 오픈소스 취업 준비 작업실입니다.

**내 경험을 근거로, 내 문체에 맞게, 이미 쓰는 AI와 함께.** 자소서 전용 AI 서비스를 하나 더 구독할 필요 없이, 이용 가능한 AI 계정의 CLI 사용량으로 7명의 비서를 운영합니다.

[설치 시작하기](#시작하기) · [먼저 궁금한 점 해결하기](#자주-묻는-질문) · [Notion 정리본 가져오기](#mcp로-정리본-일괄-가져오기)


<br>

## 목차

- [왜 만들었나](#왜-만들었나)
- [처음 사용하는 흐름](#처음-사용하는-흐름)
- [자주 묻는 질문](#자주-묻는-질문)
- [7명의 비서](#7명의-비서)
- [주요 화면](#주요-화면)
- [구조](#구조)
- [시작하기](#시작하기)
- [AI에게 설치 맡기기](#ai에게-설치-맡기기)
- [MCP로 정리본 일괄 가져오기](#mcp로-정리본-일괄-가져오기)
- [데이터 백업](#데이터-백업)
- [비용이 늘지 않는 이유](#비용이-늘지-않는-이유)
- [기여하기](#기여하기)

<br>

## 왜 만들었나

이력정보와 경험은 Notion에, 기업 공고와 전형 진행 상황은 또 다른 표에, 기업분석과 자소서는 GPT나 Claude 대화창에 쌓였습니다. 지원할 때마다 여러 창을 오가며 자료를 찾고, 같은 경험을 복사하고, AI에게 나를 다시 설명해야 했습니다.

Career Atelier는 이 과정을 한곳에 모으기 위해 만들었습니다. 한 번 정리한 경험이 기업 조사와 자소서의 근거가 되고, 저장한 공고가 캘린더와 면접 준비로 이어집니다. 자료를 옮기는 데 쓰던 시간을, 어떤 경험을 어떻게 전달할지 고민하는 데 쓸 수 있도록요.

| 필요한 것 | Career Atelier에서 달라지는 일 |
|---|---|
| 흩어진 자료 정리 | 이력·경험·공고·일정·자소서를 한 작업실에 모읍니다. 기존 정리본은 MCP로 가져옵니다. |
| 나를 아는 자소서 도우미 | 저장한 경험과 기업 조사 결과를 초안의 근거로 사용하고, 검수 비서가 과장을 확인합니다. |
| 내 문체와 AI 선택권 | 비서별 프롬프트·AI 제공자·모델·추론 사용량을 직접 설정합니다. |
| 내 자료의 소유권 | 각 사용자가 자신의 Supabase 프로젝트와 로그인 계정을 운영합니다. |
| 장소에 구애받지 않는 준비 | Vercel에 배포하면 외부에서도 자료를 열고 수정할 수 있습니다. AI 작업은 켜진 러너가 맡습니다. |

<br>

## 처음 사용하는 흐름

1. **내 작업실 설치:** [설치 마법사](#시작하기)로 Supabase를 연결하고 본인 계정을 만듭니다. AI 기능을 쓸 때는 CLI 로그인과 러너 기기 승인까지 완료합니다.
2. **나를 알려 주기:** 관제실에서 목표 직무·관심 분야를 입력하고, 나의 정보에 학력·경력 등을 저장합니다. 경험 카드에는 실제 상황·판단·행동·결과를 정리합니다. 기존 파일은 [MCP로 가져올 수 있습니다](#mcp로-정리본-일괄-가져오기).
3. **비서 배정:** 프롬프트 생성실에서 각 비서가 사용할 AI를 로그인해 둔 CLI로 지정합니다. 원하는 문체와 작성 기준도 저장합니다.
4. **공고 찾기:** 모카로 채용공고를 탐색합니다. 유효한 마감일이 있는 저장 공고는 캘린더에 연결됩니다. 지원할 공고를 고르고 자소서 문항을 준비합니다.
5. **조사부터 검수까지:** 자소서 편집기에서 기업·직무·공고 내용을 입력하고 **「기업 조사부터 소제목까지 실행 (솔)」**을 누릅니다. 솔 → 뮤즈 → 렌즈 → 콤마가 순서대로 실행됩니다.
6. **내 글로 완성:** 생성된 초안과 검수 내용을 확인해 반영하고, 전형 진행 상황을 기록하며 면접 질문을 준비합니다. 최종 제출은 직접 합니다.

모카의 공고 탐색과 자소서 연쇄 실행은 별도 단계입니다. 공고를 찾았다는 이유만으로 모든 공고의 자소서를 자동 작성하지 않습니다. 경험 카드가 없으면 뮤즈 단계가 중단되므로 먼저 근거를 채워 주세요.

<br>

## 자주 묻는 질문

### 내 자기소개서가 다른 사람에게 보이지 않나요?

**내 Supabase 프로젝트에 저장합니다.** 설치된 소유자 전용 로그인 제한과 행 수준 보안(RLS)은 로그인한 소유자에게만 해당 데이터의 읽기·쓰기를 허용합니다. 다른 오픈소스 이용자와 데이터를 공유하는 공용 서버 구조가 아닙니다. 저장소를 공개해도 DB 내용이 GitHub에 올라가지는 않습니다.

AI 기능을 실행하면 그 작업에 필요한 경험·자소서·조사 자료는 선택한 AI 제공자에게 전달됩니다. 개인 DB 보관과 AI 제공자의 데이터 처리는 구분되며, 계정·접근 권한 관리는 본인이 담당합니다.

### GPT와 Claude도 구독하는데 자소서 AI를 또 구독해야 하나요?

**Career Atelier 자체의 구독료나 토큰당 API 요금은 없습니다.** 지원되는 CLI에 본인 AI 계정으로 로그인해 사용합니다. 이미 가진 구독을 활용하면서 경험 기반 초안과 근거 검수를 한곳에서 진행할 수 있습니다. AI 요금제의 사용 한도는 그대로 적용되고, Supabase·Vercel 사용료는 선택한 플랜과 사용량에 따라 별도일 수 있습니다.

### 평소 내가 쓰던 문체로 작성하고 싶어요.

프롬프트 생성실에서 비서별 프롬프트를 수정하고 저장하세요. 예를 들어 뮤즈에게 「짧은 문장으로 쓰고, 내 판단과 행동을 먼저 설명하며, 근거 없는 수식어를 피하라」고 지시할 수 있습니다. **저장한 설정은 이후 실행에서 읽어 적용**되며 진행 중인 작업의 프롬프트를 바꾸지는 않습니다. 이전 프롬프트 버전으로 복원할 수도 있습니다.

AI 제공자·모델·추론 사용량도 비서마다 선택합니다. 현재 프롬프트는 비서별로 저장되므로 제공자를 바꿀 때 그 모델에 맞게 조정하세요. ChatGPT나 Claude 웹사이트의 개인 설정을 수정하는 기능은 아닙니다.

### 로컬 PC에서만 쓸 수 있나요?

웹 앱을 [Vercel에 배포](#배포)하면 다른 컴퓨터나 모바일 브라우저에서도 로그인해 이력·공고·일정을 관리하고 자소서를 직접 작성·수정할 수 있습니다. **AI 생성에는 인터넷에 연결된 PC의 러너와 로그인된 AI CLI가 필요합니다.** 외부에서 요청한 AI 작업도 그 러너가 처리합니다. PC가 꺼져 있거나 절전 상태이면 처리되지 않으며, 대기 작업에는 6시간 유효기간이 있습니다.

### 자소서를 어떻게 시작할지 모르겠고, 쓰는 시간도 아까워요.

모카로 지원할 공고를 찾고, 내 경험과 문항을 준비한 뒤 솔의 연쇄 실행 버튼을 누르세요. **기업 조사 → 경험 기반 초안 → 근거 검수 → 소제목 제안**을 이어서 맡길 수 있습니다. 매 단계마다 자료를 복사해 챗봇에 다시 붙여 넣을 필요가 없습니다. 다만 결과의 사실관계와 내 의도는 직접 확인해야 하며, 검수가 정확성을 보장하거나 지원서를 자동 제출하지는 않습니다.

### Codex만, 또는 Claude만 쓰는데도 가능한가요?

가능합니다. 프롬프트 생성실에서 일곱 비서를 모두 로그인해 둔 제공자로 지정하거나 역할별로 섞어 쓰세요. 모델 이름과 추론 설정은 해당 CLI가 지원하는 값을 사용합니다. 문서에 소개된 비서별 제공자는 기본 배정입니다.

### 유료 생성형 AI를 구독하지 않아도 시작할 수 있나요?

2026-09-06 확인 기준 **Codex는 ChatGPT Free에도 포함**됩니다. 무료 계정으로 Codex CLI에 로그인하고 사용 한도 안에서 시작할 수 있습니다. 사용 가능한 모델과 한도는 [OpenAI 공식 안내](https://learn.chatgpt.com/docs/pricing)를 확인하세요. **Claude 무료 계정에는 Claude Code가 포함되지 않습니다.** 이 프로젝트의 Claude 경로에는 Claude Code를 사용할 수 있는 구독 로그인이 필요합니다. [Claude 공식 안내](https://code.claude.com/docs/en/setup)

AI 없이 이력·경험·공고·일정과 자소서를 직접 관리하는 용도로도 사용할 수 있습니다. 이 경우 AI CLI와 러너를 실행하지 않아도 웹의 수동 관리 기능은 이용할 수 있습니다.

### Supabase 데이터가 사라지면 어떻게 하나요?

관제실에서 로컬 폴더 백업을 켜 두면 러너가 실행 중일 때 **2시간 주기**로 지정된 데이터 테이블을 JSON으로 저장합니다. 현재 구현은 6시간 주기가 아닙니다. 같은 날의 파일은 갱신하고 날짜가 바뀌면 새 파일을 만듭니다. 이력정보 전체와 첨부파일까지 포함한 완전한 복구 기능은 아니므로 [백업 범위](#데이터-백업)를 확인하세요.

### 공고를 자동으로 찾고 캘린더에도 넣어 주나요?

모카가 목표 직무·관심 분야와 경험을 참고해 공고를 찾고 저장합니다. 마감일이 유효한 공고는 캘린더에 자동으로 연결되며, 상시채용처럼 날짜가 없는 공고에는 임의의 마감일을 만들지 않습니다. 관제실에서 직접 탐색을 실행할 수 있고, 승인된 러너가 실행 중이면 매일 15시(KST) 자동 탐색도 지원합니다.

### 연결했는데 비서가 움직이지 않아요.

러너 연결은 작업할 준비가 됐다는 뜻입니다. 실행 버튼을 눌러 작업을 요청하면 실제 실행 중인 비서가 활성화됩니다. 계속 대기한다면 관제실의 기기 승인, 러너 터미널의 오류, 선택한 CLI의 로그인 상태, 실행 기록의 사용량 제한을 확인하세요.

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

질문은 카테고리(기업·직무·경험 등)로 분류되어 저장되고, 면접 훈련실 화면에서 답변을 적고 다듬을 수 있습니다.

</td>
</tr>

<tr>
<td width="130" align="center"><img src="docs/images/agents/agent-subtitle.png" width="100" alt="콤마"></td>
<td>

### 콤마 · 문항 소제목 제안

**실행** Antigravity (Gemini 3) · **저장** `artifacts` (kind: `subtitle`)

완성된 자소서 본문을 읽고 **15자 이내** 소제목을 제안합니다.

본문에 없는 사실을 만들지 않고 표현만 압축합니다. 새 주장을 만드는 게 아니라서 뮤즈의 3겹 근거 검증은 적용하지 않지만, **본문이 비어 있으면 실행을 거부**합니다.

다른 비서와 마찬가지로 제안일 뿐이고, [반영]을 눌러야 확정됩니다.

</td>
</tr>
</table>

<br>

> **각 비서가 어떤 LLM으로 돌지는 [프롬프트 생성실](#주요-화면)에서 바꿀 수 있습니다.** 위 표는 기본값입니다.
>
> 구독을 하나만 쓴다면 일곱 비서를 전부 그쪽으로 몰아도 됩니다. 스키마는 고른 LLM에 맞게 자동으로 변환됩니다. 다만 **로그인한 CLI가 있어야** 실제로 실행되고, 없으면 실행이 실패로 남습니다.

<br>

## 주요 화면

### 관제실

7명의 상태를 한 화면에서 봅니다. 지금 도는 비서, 마지막 실행 결과, 러너 연결 여부, 오늘 실행 횟수가 보입니다.

루미와 모카는 각자의 카드에서 바로 실행할 수 있습니다.

<!-- 자리표시자 — 이 파일을 실제 캡처로 덮어쓰세요. 규격: docs/images/screens/README.md -->
<img src="docs/images/screens/01-dashboard.png?v=0750026" alt="관제실" width="100%">

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

### 프롬프트 생성실

각 비서의 시스템 프롬프트를 직접 고칩니다.

저장할 때마다 이전 본문이 버전으로 남고, 언제든 되돌릴 수 있습니다. 되돌리기도 새 버전으로 쌓이기 때문에 기록이 사라지지 않습니다.

<!-- 자리표시자 — 이 파일을 실제 캡처로 덮어쓰세요. 규격: docs/images/screens/README.md -->
<img src="docs/images/screens/04-prompt-lab.png" alt="프롬프트 생성실" width="100%">

<br>

### 나의 정보

학력·자격증·대외활동·교육활동·프로젝트·경력사항·수상내역, 7개 섹션을 항목별로 기록합니다. 사이드바의 **"나의 정보"**에서 들어갑니다.

지원서를 쓸 때마다 학점이나 자격증 등록번호를 다시 찾지 않아도 됩니다. 성적증명서·졸업증명서 같은 파일도 함께 보관하며, 파일은 비공개 저장소에 올라가고 열람할 때만 60초짜리 링크가 만들어집니다.

<!-- 자리표시자 — 이 파일을 실제 캡처로 덮어쓰세요. 규격: docs/images/screens/README.md -->
<img src="docs/images/screens/07-records.png?v=0750026" alt="나의 정보" width="100%">

<br>

### 경험 아카이브

프로젝트 경험을 상황·문제·역할·판단·행동·결과·시행착오·회고로 나눠 기록합니다.

여기 적은 것만 뮤즈가 근거로 쓸 수 있습니다.

<!-- 자리표시자 — 이 파일을 실제 캡처로 덮어쓰세요. 규격: docs/images/screens/README.md -->
<img src="docs/images/screens/05-experiences.png?v=0750026" alt="경험 아카이브" width="100%">

<br>

### 면접 훈련실

에코가 만든 질문에 답을 적고 다듬습니다.

<!-- 자리표시자 — 이 파일을 실제 캡처로 덮어쓰세요. 규격: docs/images/screens/README.md -->
<img src="docs/images/screens/06-interviews.png?v=0750026" alt="면접 훈련실" width="100%">

<br>

## 구조

```
                    ┌──────────────────────────────┐
브라우저  ───────-> │  Vercel (web/)               │
                    │  · 데이터만 보관              │
                    │  · AI 자격증명 없음           │──┐
                    └──────────────────────────────┘  │
                                                      │  Supabase
                    ┌──────────────────────────────┐  │  Postgres + Auth + RLS
내 컴퓨터 ───────-> │  runner/ (Node)              │<─┘
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

순서대로 4단계입니다: 아래 준비물 확인 → 없는 CLI 설치 → 설치 마법사 실행 → 두 프로세스 시작. 아무것도 설치돼 있지 않다고 가정하고 씁니다.

### 준비물

| 항목 | 확인 |
|---|---|
| Node.js 22.13 이상 | `node -v` |
| Supabase 무료 프로젝트 | [supabase.com](https://supabase.com) |
| Supabase CLI | `npm install -g supabase` |
| AI 기능을 사용할 때 CLI 최소 1개 | 아래 표 |

<br>

| CLI | 담당 비서 | 설치 · 로그인 |
|---|---|---|
| Codex | 루미 · 모카 · 뮤즈 · 에코 | `npm install -g @openai/codex` → `codex login` |
| Claude Code | 솔 · 렌즈 | `npm install -g @anthropic-ai/claude-code` → `claude auth login` |
| Antigravity | 소제목 | [antigravity.google](https://antigravity.google) 설치 후 `agy` 실행 |

**셋 다 설치할 필요는 없습니다.** 이용 가능한 계정의 CLI 하나를 설치하고, 프롬프트 생성실에서 사용할 비서들을 그 제공자로 지정하세요. 로그인하지 않은 CLI로 요청한 작업은 실행할 수 없습니다.

<br>

<details>
<summary><b>이 CLI들을 한 번도 안 써봤다면 — 완전 처음부터 따라하기</b></summary>

<br>

아래 각 항목은 위 준비물 표의 Node.js 말고는 아무것도 설치돼 있지 않다고 가정합니다.

**Codex CLI (OpenAI)** — ChatGPT 계정으로 로그인합니다. 무료 계정도 지원되며 플랜별 모델·사용 한도가 다릅니다. [최신 지원 범위](https://learn.chatgpt.com/docs/pricing)

```bash
npm install -g @openai/codex
codex --version
codex login
```

`codex login`을 실행하면 브라우저가 열립니다. **ChatGPT 계정 로그인**을 선택하세요. 이 프로젝트는 API 키 방식의 과금을 코드 레벨에서 거부하므로, API 키로 로그인을 마쳐도 여기서는 동작하지 않습니다.

**Claude Code CLI (Anthropic)** — Claude Pro 또는 Max 구독이 있어야 합니다.

```bash
npm install -g @anthropic-ai/claude-code
claude --version
claude auth login
```

흐름은 동일합니다. 브라우저가 열리면 Claude 계정으로 로그인하고 구독 로그인을 선택하세요.

**Antigravity CLI (Google)** — Google 계정이 있어야 합니다.

```bash
# macOS · Linux
curl -fsSL https://antigravity.google/cli/install.sh | bash
```

Antigravity는 npm 패키지가 아니므로, Windows에서는 [antigravity.google](https://antigravity.google)에서 설치 프로그램을 내려받아 안내를 따르세요. 이후 과정은 동일합니다.

```bash
agy --version
agy
```

처음 `agy`를 실행하면 브라우저가 열리고 Google 로그인을 요구합니다.

**설치 직후 명령어가 "인식할 수 없습니다"/"command not found"로 나온다면**

터미널을 설치 전에 이미 열어 둔 상태라 새로 추가된 PATH를 못 읽은 것입니다. 터미널을 완전히 닫았다가 새로 열고 `--version` 확인을 다시 시도하세요 — OS를 가리지 않고 가장 흔한 원인입니다.

**macOS·Linux에서 `npm install -g`가 권한 오류(`EACCES`)로 실패한다면**

`sudo`로 다시 실행하지 마세요. 그 순간부터 Node 설치 폴더의 소유권이 root로 넘어가서 이후 다른 권한 오류를 계속 만들어냅니다. 대신 [nvm](https://github.com/nvm-sh/nvm)으로 Node를 설치하세요 — 사용자 홈 디렉터리 안에만 설치되므로 전역 설치에도 관리자 권한이 전혀 필요 없습니다.

로그인은 CLI마다 진행하며 러너를 껐다 켜도 보통 유지됩니다. 세션이 만료되거나 접근 권한이 해제되면 다시 로그인해야 합니다.

CLI 하나라도 로그인에 성공했다면, 아래 "설치 — 명령 3줄"로 넘어가세요. 그 단계는 Supabase를 연결하는 과정이라 CLI와는 무관합니다.

</details>

<br>

### 설치 — 명령 3줄

Windows · macOS · Linux 모두 같은 명령입니다.

```bash
git clone https://github.com/tkv00/Career-Atelier-AI-Context-Pack.git
cd Career-Atelier-AI-Context-Pack
npm run setup
```

**Supabase 대시보드를 열 일도, 키를 복사해 올 일도 없습니다.** 브라우저에서 로그인 한 번만 하면 나머지는 마법사가 합니다.

1. Node · Supabase CLI · AI CLI 설치 상태 확인
2. Supabase 로그인 (브라우저가 한 번 열립니다)
3. 프로젝트 선택 — 없으면 **새로 만들고** 준비될 때까지 대기
4. anon 키를 **직접 조회**해서 가져옴
5. 테이블 · 보안 정책 · 기본 프롬프트 적용
6. 이메일 템플릿 · 단일 사용자 가입 방어 · SMTP 설정 적용
7. `web/.env.local`과 `runner/.env` 생성
8. 계정을 만들고 비밀번호를 터미널에 출력 — 이 값으로 한 번 로그인한 뒤, 대시보드 배너에서 원하는 비밀번호로 바꾸면 됩니다

> DB 비밀번호는 무작위로 만들고 어디에도 저장하지 않습니다. `service_role` 키는 조회조차 하지 않습니다.

**비밀번호 재설정 메일은 별도 설정 없이 바로 동작합니다** — Supabase 기본 메일 서비스를 쓰기 때문입니다. 다만 시간당 2통으로 제한돼 있어서, 실사용(가끔 비밀번호를 잊었을 때만)에는 충분하지만 가입 흐름을 반복 테스트할 때는 금방 막힙니다. 더 넉넉한 한도가 필요하면 [Resend](https://resend.com)에 무료로 가입해 `supabase/.env.example`을 `supabase/.env`로 복사한 뒤 `RESEND_API_KEY`와 사이트 주소 항목을 채우고 `supabase config push`를 실행하세요.

<br>

### AI에게 설치 맡기기

터미널을 쓸 수 있는 코딩 에이전트(Codex · Claude Code · Gemini CLI · Cursor 등)에 아래 한 줄을 붙여 넣으세요.

```text
다음 설치 지침을 읽고 그대로 따라 Career Atelier를 설치해 줘: https://raw.githubusercontent.com/tkv00/Career-Atelier-AI-Context-Pack/refs/heads/main/docs/AI-INSTALL.md
```

에이전트라면 아래 명령을 순서대로 실행해 끝까지 맡길 수도 있습니다. `--yes`를 주면 아무것도 묻지 않고 끝까지 돕니다.

```bash
git clone https://github.com/tkv00/Career-Atelier-AI-Context-Pack.git
cd Career-Atelier-AI-Context-Pack
npm run setup -- --yes
```

AI는 준비물을 확인하고 공식 저장소 복제, 잠긴 버전의 의존성 설치, 기존 설치 마법사 실행, 빌드 검증까지 진행합니다. 설치 지침에는 API 키 사용, 파괴적인 Git 명령, 환경변수 파일의 무단 덮어쓰기, 자동 배포를 금지하는 안전 규칙도 들어 있습니다. 로그인과 인스턴스 소유권 확인은 직접 해야 합니다. 전체 절차는 실행 전에 [docs/AI-INSTALL.md](docs/AI-INSTALL.md)에서 확인할 수 있습니다.

> 일반 웹 채팅이 아니라 **내 컴퓨터의 터미널 권한이 있는 코딩 에이전트**에서 사용하세요. 웹 채팅만으로는 로컬 프로그램을 설치할 수 없습니다.

리포를 이미 받아 둔 뒤라면 따로 붙여 넣을 것도 없습니다. 루트의 [AGENTS.md](AGENTS.md)를 Codex·Gemini CLI·Cursor·Copilot 등이 **알아서 읽습니다**([AGENTS.md 규약](https://agents.md), 6만 개 이상 저장소가 씁니다). Claude Code는 [CLAUDE.md](CLAUDE.md)를 읽고, 그 파일은 같은 내용을 가리킵니다.

<br>

### 실행

터미널 두 개가 필요합니다.

```bash
# 1번 창 — 웹 앱
cd web
npm install
npm run dev
```

```bash
# 2번 창 — 러너
cd runner
npm install
npm run login
npm run start
```

http://localhost:3000 에 접속합니다. 마법사가 이미 계정을 만들어 줬다면(위 8번) 그 이메일과 화면에 출력된 비밀번호로 로그인하고, 아니라면 본인 이메일과 비밀번호로 새로 계정을 만듭니다.

> **가장 먼저 가입한 계정이 그 인스턴스의 소유자가 되고, 이후 가입은 전부 거부됩니다.** 첫 가입을 본인 이메일로 하세요.

마지막으로 관제실 화면 아래 "러너" 목록에서 이 기기를 **승인**하면 작업을 받기 시작합니다. 기기마다 한 번만 하면 됩니다.

<br>

### 배포

선택 사항입니다 — 러너는 내 컴퓨터가 켜져 있어야 하지만, 웹 앱 자체는 `localhost:3000`만으로도 잘 동작합니다. 집·회사 밖에서도 캘린더나 작성 중인 자소서를 보고 싶을 때만 배포하면 됩니다 — 그때도 러너가 켜져 있을 필요는 없습니다.

```bash
npm run deploy
```

`web/`을 Vercel CLI로 직접 프로젝트에 연결합니다 — GitHub Import를 거치지 않습니다. Vercel의 GitHub App이 그 저장소(특히 포크)에 접근 권한이 없으면 Import 목록에 아예 안 뜨는 경우가 흔한데, 이 방식은 그 문제 자체를 피해 갑니다. `npm run setup`이 이미 `web/.env.local`에 써 둔 `NEXT_PUBLIC_SUPABASE_URL`·`NEXT_PUBLIC_SUPABASE_ANON_KEY`를 그대로 읽어 Vercel 프로젝트에 설정하고 배포까지 끝냅니다. 처음 한 번만 Vercel 로그인 창이 뜨고, 이후 다시 올리고 싶을 때도 같은 명령을 그대로 실행하면 됩니다.

배포가 끝나면 원하는 주소 이름을 물어봅니다 — 먼저 원하는 이름을 입력해 보세요. `<그 이름>.vercel.app`을 이미 다른 누군가 쓰고 있으면 그렇다고 알려 주고 다시 물어보며, 세 번 연달아 실패하면 매번 새 이름을 고민하게 하는 대신 무작위 접미사가 붙은(확실히 비어 있는) 이름을 제안합니다. (`--yes`로 실행하면 다시 물어볼 사람이 없으므로 첫 실패에서 바로 무작위 이름으로 넘어갑니다.) 이름을 미리 정해서 넘길 수도 있습니다:

```bash
npm run deploy -- --project-name 원하는-이름
```

service_role 키나 AI 제공자 키는 넣지 마세요. **일부러 빌드가 거부합니다** (`web/lib/env.ts`).

직접 손으로 하고 싶다면 Vercel 프로젝트의 Root Directory를 `web/`로 잡고 같은 환경변수 두 개를 직접 넣으면 됩니다 — 자세한 내용은 [docs/V2-SETUP.md](docs/V2-SETUP.md)에 있습니다.

<br>

## MCP로 정리본 일괄 가져오기

**Notion에 쌓아 둔 내 경험을 다시 입력하지 마세요.** MCP(Model Context Protocol)는 AI 클라이언트가 외부 도구를 호출하는 공통 연결 규약입니다. 이 저장소의 `career-atelier` 서버는 Notion 페이지·DB 또는 로컬 Markdown·JSON을 읽어 Career Atelier의 이력정보와 경험 카드로 가져옵니다. 웹 화면의 버튼이 아니라 내 PC의 MCP 클라이언트나 터미널에서 실행합니다.

### 어떤 일을 맡길 수 있나요?

| 도구 | 역할 | 주요 인자 |
|---|---|---|
| `preview_import` | 인식된 항목·저장 예정 테이블·경고 확인. DB에 쓰지 않음 | `source`, DB 소스일 때 `section` |
| `import_records` | 항목 추가 또는 기존 항목 갱신 | `source`, `section`, `dry_run`, 선택적 `only` |
| `db_snapshot` | 지원되는 테이블별 행 수 확인 | 없음 |

기본정보·학력·자격증·대외활동·교육활동·프로젝트·경력·수상·경험 카드를 지원합니다. 공고나 자소서의 범용 임포터, Notion 양방향 동기화, 스캔 이미지 OCR 기능은 아닙니다.

서버는 소스를 로컬에서 파싱해 DB에 기록합니다. 원문 전체를 모델에게 전달해 INSERT 인자로 다시 작성시키지 않고, 클라이언트에는 경로와 건수·제목·결과 요약을 주고받습니다. 구조화 작업 자체에는 LLM 호출이 없습니다. 토큰 절감률은 입력과 도구 정의 비용에 따라 달라지며, 기존 표본의 약 96%는 보장값이 아닌 추정치입니다. `cd runner` 후 `npm run mcp:bench`로 문자 수와 토큰 추정치를 확인할 수 있습니다.

### 1. 설치와 로그인 준비

[설치 마법사](#시작하기)와 `runner` 의존성 설치를 먼저 마치고, `cd runner` → `npm run login`으로 본인 계정의 이메일 인증을 완료하세요. DB 쓰기와 행 수 조회는 러너의 사용자 세션을 사용하며 RLS가 적용됩니다. 파일 미리보기는 DB 로그인 없이도 가능합니다.

MCP 서버는 일반 작업 큐 러너와 별도 프로세스입니다. 임포트만 할 때 `npm run start`를 계속 켜 둘 필요는 없습니다. Notion을 쓰지 않으면 Notion 토큰도 필요 없습니다.

### 2. MCP 클라이언트에 등록

Claude Code는 저장소 루트의 [.mcp.json](.mcp.json)에 등록돼 있습니다. 프로젝트 폴더에서 실행하고 클라이언트의 MCP 승인 절차를 완료하세요. Codex와 Antigravity는 아래처럼 등록합니다. `<repo>`를 **본인의 저장소 절대 경로**로 바꾸세요.

```bash
codex mcp add career-atelier -- node <repo>/runner/mcp/server.mjs
agy mcp add career-atelier -- node <repo>/runner/mcp/server.mjs
```

등록 후 클라이언트를 다시 열고 `career-atelier`의 세 도구가 보이는지 확인합니다. 다른 MCP 클라이언트에서도 명령을 `node`, 인자를 서버 파일의 절대 경로로 지정하면 됩니다.

### 3. 가져올 정리본 작성

제목 1(`#`)은 데이터 종류, 제목 2(`##`)는 항목 이름, 목록의 `키: 값`은 상세 필드입니다. Notion 페이지에서도 본문에 같은 제목·목록 구조를 만드세요. 페이지 제목만으로 데이터 종류를 판단하지 않습니다.

```markdown
# 경험
## 교내 스터디 운영
- 상황: 참여자의 출석률이 낮아지고 있었다
- 문제: 난이도가 맞지 않아 참여를 포기했다
- 역할: 커리큘럼 담당
- 판단: 난이도를 나눠 선택할 수 있게 하기로 했다
- 행동: 문제를 세 단계로 나누고 막힌 지점을 공유했다
- 결과: 다음 학기에도 스터디 운영이 이어졌다
- 태그: 협업, 문제해결

# 학력
## 예시대학교
- 전공: 컴퓨터공학
- 기간: 2020-03 ~ 2024-02
- 학점: 3.82 / 4.5
- 상태: 졸업
```

[전체 예제](runner/mcp/fixtures/sample-notes.md)를 복사해 실제 내용으로 바꿔 사용하세요. 자유 형식 문서의 의미를 AI가 추측해 채우지는 않습니다. 알 수 없는 섹션은 `skipped`, 유효하지 않은 행은 `rejected`, 보정 사항은 `warnings`에 표시됩니다. 일부 알 수 없는 필드는 메모나 상세 내용으로 보존됩니다.

### 4. 미리보기 → 저장 → 확인

클라이언트에 아래처럼 요청할 수 있습니다.

> career-atelier의 preview_import로 /절대경로/내-정리본.md를 확인해 줘. 항목 수와 경고를 알려 줘.

미리보기 결과를 확인한 뒤 저장을 요청합니다.

> 같은 파일을 import_records로 가져와 줘. dry_run은 false로 하고, only는 ["experience"]로 해서 경험 카드만 저장해 줘. 끝나면 db_snapshot으로 건수를 확인해 줘.

`only`를 생략하면 인식된 모든 종류가 대상입니다. 값은 `profile / education / certification / activity / training / project / work / award / experience`를 사용합니다. `dry_run` 기본값은 `true`이며 실제 저장에는 `false`가 필요합니다.

터미널에서도 실행할 수 있습니다.

```bash
cd runner
node mcp/server.mjs preview --source /절대경로/내-정리본.md
node mcp/server.mjs import --source /절대경로/내-정리본.md
node mcp/server.mjs import --source /절대경로/내-정리본.md --write
node mcp/server.mjs snapshot
```

**같은 항목은 갱신됩니다.** 종류별 비교 키로 기존 행을 찾습니다. 예를 들어 경험은 제목, 학력은 학교명과 구분을 비교합니다. 같은 제목의 경험을 가져오면 기존 내용이 바뀔 수 있고, 기본정보를 포함하면 현재 프로필을 갱신합니다. 가져오기에는 일괄 취소 기능이 없습니다. `written.created / updated / failed`와 `failures`를 확인하세요. 일부 행만 실패할 수도 있습니다.

### 5. Notion 연결

1. [Notion 내부 통합](https://www.notion.so/my-integrations)을 생성하고 읽을 페이지·DB에 접근 권한을 부여합니다.
2. `runner/.env`에 `NOTION_TOKEN=<발급받은 토큰>`을 저장합니다. 토큰은 로컬에만 두고 Git에 커밋하거나 채팅에 붙여 넣지 마세요.
3. **현재 Notion 어댑터는 프로세스 환경변수를 읽습니다.** `.env`에 적는 것만으로는 로드되지 않으므로 Node의 `--env-file`을 지정해 MCP 프로세스를 실행합니다.

```bash
codex mcp add career-atelier -- node --env-file=<repo>/runner/.env <repo>/runner/mcp/server.mjs
```

위 명령은 파일 전용 등록 대신 사용할 Notion용 설정입니다. 이미 등록했다면 클라이언트의 해당 서버 설정을 이 실행 명령으로 갱신하고 재연결하세요. Claude Code는 `.mcp.json`의 `args`를 `["--env-file=<repo>/runner/.env", "<repo>/runner/mcp/server.mjs"]`로 설정합니다. Antigravity도 같은 Node 인자를 사용합니다. 로컬 절대 경로 설정은 공유용 설정에 커밋하지 마세요.

| 소스 | 전달할 값 | 문서 구조 |
|---|---|---|
| 페이지 | `source: "notion://page/<페이지-ID>"` | 본문의 제목 1로 종류 지정 |
| 데이터베이스 | `source: "notion://database/<DB-ID>", section: "경험"` | 행 제목이 항목명, 속성명이 필드명 |

공유 링크에서 페이지·DB의 ID를 확인하고 URL 전체나 `?v=` 뒤의 보기 ID 대신 전달합니다. DB는 한 번에 한 종류로 가져오며, 속성 이름을 위 필드 형식에 맞춥니다. DB 행의 본문과 첨부파일은 가져오지 않습니다.

DB 미리보기 도구 인자 예시:

```json
{
  "source": "notion://database/<DB-ID>",
  "section": "경험"
}
```

같은 인자로 `import_records`를 호출하면서 `dry_run: false`를 추가하면 저장합니다. **현재 터미널 CLI는 `--section`을 전달하지 않으므로 DB 소스는 MCP 도구로 사용하세요.** 페이지는 터미널에서 확인할 수 있습니다.

```bash
cd runner
node --env-file=.env mcp/server.mjs preview --source "notion://page/<페이지-ID>"
```

### 막힐 때 확인할 것

| 증상 | 확인할 사항 |
|---|---|
| MCP 도구가 안 보임 | 서버 경로, Node 설치, 클라이언트 승인·재연결 |
| 러너 로그인 없음 / 세션 만료 | `cd runner` 후 `npm run login` |
| `NOTION_TOKEN` 없음 | 토큰 설정과 MCP 명령의 `--env-file` 확인 |
| Notion 401 / 403 / 404 | 토큰 유효성, 통합의 페이지 접근 권한, 페이지·DB ID |
| 저장 예정 0건 / `skipped` | 페이지의 제목 구조, DB의 `section`, 필드 이름 |
| 저장이 안 됨 | `dry_run: false` 또는 터미널의 `--write`, 결과의 `failures` |

**검증 범위:** 파일 파싱과 Supabase 저장·갱신은 실행 검증됐습니다. Notion 어댑터는 구현돼 있지만 실제 Notion 호출은 검증되지 않았습니다. 현재 API 버전은 `2022-06-28`이므로 여러 데이터 소스를 가진 최신 Notion DB는 호환 문제가 있을 수 있습니다. [Notion 버전 변경 안내](https://developers.notion.com/guides/get-started/upgrade-guide-2025-09-03) · [MCP 구현과 상세 검증 기록](runner/mcp/README.md)

<br>

## 데이터 백업

Supabase 무료 플랜은 장기간 미사용 시 프로젝트가 일시 정지될 수 있습니다. 중요한 자소서와 이력 데이터의 안전을 위해 로컬 백업 기능을 제공합니다.

관제실 화면의 러너 항목에서 로컬 폴더 자동 백업을 활성화하고 절대 경로를 지정하세요.

- macOS · Linux: `~/career-atelier-backups`
- Windows: `C:\career-atelier-backups`

러너가 켜져 있는 동안 2시간 주기로 [백업 코드에 지정된 테이블](runner/backup.mjs)을 JSON 파일로 저장합니다. 같은 날에는 파일을 덮어쓰고 날짜가 바뀌면 새 파일을 만듭니다. 오래된 파일은 자동 삭제하지 않으므로 보관 기간은 직접 관리하세요.

| 범위 | 현재 동작 |
|---|---|
| 대상 | 프로필, 경험 카드, 공고·일정, 조사 자료, 프롬프트·설정, 자소서·문항·버전·자동저장, 면접 질문, 생성 결과, 에이전트 실행 정보 |
| 제외 | 학력·자격증·대외활동·교육·프로젝트·경력·수상 테이블, Storage 첨부파일, 일부 큐·상세 로그 등 |
| 대용량 | 테이블별 단일 조회라 서버의 응답 행 수 제한을 넘는 데이터를 모두 내보내는 페이지네이션은 없음 |
| 복원 | JSON 내보내기이며 원클릭 복원 기능은 없음. MCP 정리본 JSON과도 형식이 달라 그대로 임포트할 수 없음 |

이 기능은 전체 Supabase 프로젝트의 백업을 대체하지 않습니다. 전체 복구가 필요하면 DB와 첨부파일에 대한 별도 백업도 준비하세요.

백업 작업은 브라우저가 아닌 로컬 머신의 러너 프로세스가 수행하므로, 러너가 켜져 있을 때 동작합니다.

<br>

## 비용이 늘지 않는 이유

추가 비용이 없다는 것은 토큰 단위의 유료 API 과금이 없다는 의미입니다. 기존에 구독 중인 플랜의 범위 안에서 동작합니다.

러너가 강제하는 안전 원칙:

- 자식 프로세스에서 `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` 등 유료 API 환경변수를 제거합니다.
- 실행 직전 각 CLI가 개인 구독 로그인 상태인지 검증합니다.
- Claude의 유료 초과 과금 신호가 감지되면 즉시 실행을 중단합니다.
- 사용량 한도에 도달하면 API로 우회하지 않고 `waiting_for_reset` 상태로 안전하게 대기합니다.

| 안전 상한 | 고정값 |
|---|---|
| 동시 실행 | 1개 |
| 단일 실행 타임아웃 | 15분 |
| 실패한 실행 재시도 | 0회 |
| 루미·모카 검색 품질 재시도 | 최대 1회 |
| 작업 유효기간 | 6시간 |

<br>

## 기여하기

버그 제보, 문서 개선, 기능 제안, 코드 기여를 모두 환영합니다. 개발 환경 설정과 Pull Request 제출 기준은 [CONTRIBUTING.ko.md](CONTRIBUTING.ko.md) 및 [CONTRIBUTING.md](CONTRIBUTING.md)에서 확인하실 수 있습니다.

각자 독립된 Supabase 프로젝트를 생성해 개발하므로 공용 개발 데이터베이스 충돌 없이 안전하게 작업할 수 있습니다.

<br>

## 문서

| 문서 | 내용 |
|---|---|
| [docs/USER-GUIDE.md](docs/USER-GUIDE.md) | OS별 설치 및 사용 가이드 |
| [docs/AI-INSTALL.md](docs/AI-INSTALL.md) | 코딩 에이전트를 위한 자동 설치 가이드 |
| [docs/V2-SETUP.md](docs/V2-SETUP.md) | Supabase 및 Vercel 수동 설정 및 배포 |
| [docs/PRIVACY-AND-COST.md](docs/PRIVACY-AND-COST.md) | 개인정보 보호 및 비용 무과금 보장 모델 |
| [docs/HARNESS-ENGINEERING.md](docs/HARNESS-ENGINEERING.md) | 하네스 엔지니어링 및 에이전트 개발자 가이드 |
| [runner/README.md](runner/README.md) | 러너 프로세스 내부 구조 및 실행 안내 |
| [runner/mcp/README.md](runner/mcp/README.md) | 로컬 MCP 서버 도구 및 포맷 규약 |
| [CONTRIBUTING.ko.md](CONTRIBUTING.ko.md) | 오픈소스 기여 가이드 (한국어) |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contribution Guidelines (English) |

<br>

## 라이선스

MIT License - [LICENSE](LICENSE)
