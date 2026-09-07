<img src="docs/images/banner.png" alt="Career Atelier" width="100%">

**[English](README.md)** · 한국어 · MIT · Node.js 22.13+

# 흩어진 취업 준비를, 나만의 작업실 하나로

Notion의 경험, 엑셀의 이력, 채용공고, 자소서를 한곳에서 관리합니다. 내 경험을 근거로 기업 조사부터 초안·검수까지 맡기고, 비서별 AI와 문체를 직접 고릅니다.

**내 Supabase에 자료를 저장하고, 내 PC에서 로그인한 AI CLI로 실행하는 개인 설치형 서비스입니다.** 웹에서 자료만 관리할 때는 AI 연결이 필요 없습니다. AI 계정의 사용 한도와 Supabase·Vercel 플랜 조건은 적용됩니다.

[처음 설치하기](#시작하기) · [설치 후 첫 사용](#첫-자소서까지-따라하기) · [기능 찾기](#기능은-어디서-쓰나요) · [로그인 문제 해결](docs/AUTH-TROUBLESHOOTING.md) · [FAQ](docs/FAQ.ko.md)

<img src="docs/images/screens/01-dashboard.png?v=0750026" alt="Career Atelier 관제실" width="100%">

## 왜 만들었나요?

취업을 준비하면서 이력과 경험은 Notion·Excel에, 공고와 마감일은 별도 표에, 기업분석과 자소서는 GPT·Claude 대화창에 쌓였습니다. 지원할 때마다 창을 오가고 같은 경험을 다시 복사하며 AI에게 나를 처음부터 설명해야 했습니다.

**한 번 정리한 내 경험이 다음 지원에도 이어지면 좋겠다고 생각했습니다.** 그래서 자료 정리부터 기업 조사, 초안, 검수, 면접 준비를 한 작업실에 모았습니다. 내 Supabase에 자료를 보관하고 이미 쓰는 AI를 선택해, 내 근거와 내 문체로 준비할 수 있도록 만들었습니다.

## 함께 일하는 7명의 파일럿

우주 작업실에서 각 파일럿은 서로 다른 일을 맡습니다. 캐릭터 아래의 역할을 보고 필요한 비서를 찾아보세요.

<table>
<tr>
<td align="center" width="25%"><img src="docs/images/agents/agent-news.png" width="96" alt="루미"><br><b>루미</b><br>관심 분야 뉴스</td>
<td align="center" width="25%"><img src="docs/images/agents/agent-jobs.png" width="96" alt="모카"><br><b>모카</b><br>채용공고 탐색</td>
<td align="center" width="25%"><img src="docs/images/agents/agent-company.png" width="96" alt="솔"><br><b>솔</b><br>기업·직무 조사</td>
<td align="center" width="25%"><img src="docs/images/agents/agent-writer.png" width="96" alt="뮤즈"><br><b>뮤즈</b><br>경험 기반 초안</td>
</tr>
</table>

<table>
<tr>
<td align="center" width="33%"><img src="docs/images/agents/agent-review.png" width="96" alt="렌즈"><br><b>렌즈</b><br>근거·과장 검수</td>
<td align="center" width="33%"><img src="docs/images/agents/agent-subtitle.png" width="96" alt="콤마"><br><b>콤마</b><br>문항 소제목</td>
<td align="center" width="33%"><img src="docs/images/agents/agent-interview.png" width="96" alt="에코"><br><b>에코</b><br>면접 질문 준비</td>
</tr>
</table>


모카로 공고를 찾고, 자소서 편집기에서 **솔 → 뮤즈 → 렌즈 → 콤마**를 이어서 실행합니다. 루미는 뉴스 조사, 에코는 면접 준비를 맡습니다. 파일럿별 AI 제공자는 **프롬프트**에서 바꿀 수 있습니다.

[설치부터 시작하기](#시작하기) · [비서별 자세한 역할](docs/REFERENCE.ko.md#7명의-비서) · [자주 묻는 질문](docs/FAQ.ko.md)

## 시작하기

**처음에는 아래 1 → 2 → 3까지만 진행하세요.** 자료를 저장할 수 있으면 설치 성공입니다. AI 연결은 4번, 외부 접속과 MCP는 이후 선택 사항입니다.

### 1. 준비물 확인

| 준비물 | 확인 방법 |
|---|---|
| Git | 터미널에서 `git --version` |
| Node.js 22.13 이상 | `node -v`와 `npm -v`. 없으면 [Node.js](https://nodejs.org/en/download) 설치 |
| 본인 Supabase 계정 | [Supabase](https://supabase.com)에서 가입 |
| Supabase CLI | [공식 설치 안내](https://supabase.com/docs/guides/local-development/cli/getting-started)의 운영체제별 설치 후 `supabase --version` |

설치 마법사는 `supabase` 명령을 직접 실행하므로 PATH에서 사용할 수 있어야 합니다. 전역 설치는 macOS의 Homebrew, Windows의 Scoop 또는 공식 바이너리를 사용하세요. npm 프로젝트 의존성 설치와 전역 설치는 다릅니다. 기존의 `npm install -g supabase` 안내 대신 [공식 설치 방식](https://supabase.com/docs/guides/local-development/cli/getting-started)을 사용하세요.

### 2. 프로젝트 연결 — 터미널 A

Windows는 PowerShell, macOS·Linux는 터미널에서 **한 줄씩** 실행하세요.

```bash
git clone https://github.com/tkv00/Career-Atelier-AI-Context-Pack.git
cd Career-Atelier-AI-Context-Pack
npm run setup
```

이미 저장소를 받았다면 해당 폴더에서 마지막 명령만 실행합니다. 마법사에서 본인 Supabase 계정으로 로그인하고 사용할 프로젝트를 선택하세요. 기존 프로젝트를 선택하면 **DB 비밀번호**를 물을 수 있습니다. 새 프로젝트를 만들려면 선택 안내에 따르세요.

**완료 확인:** 설정 적용이 끝나고 웹 실행·가입 링크 안내가 나옵니다. 오류로 끝났다면 다음 단계로 넘어가지 마세요. [설치 상세](docs/USER-GUIDE.md) · [다른 계정으로 전환](docs/AUTH-TROUBLESHOOTING.md#다른-supabase-계정으로-전환하기)

### 3. 웹 실행 후 내 계정 만들기 — 터미널 A와 브라우저

방금 사용한 터미널 A에서 실행합니다.

```bash
cd web
npm install
npm run dev
```

터미널을 켜 둔 채 **브라우저**에서 출력된 Local 주소를 여세요. 보통 `http://localhost:3000`이며 포트가 다르면 출력된 주소를 사용합니다.

1. **처음이에요 · 계정 만들기**를 선택합니다.
2. 본인의 이메일과 직접 정한 비밀번호로 가입합니다. 이메일 확인 안내가 나오면 확인을 마칩니다.
3. 관제실이 열리면 **경험 카드** 메뉴에서 경험 하나를 저장해 보세요.

**완료 확인:** 새로고침 후에도 경험이 남아 있습니다. 여기까지면 AI 없이 자료를 관리할 수 있습니다.

> 웹·Runner에서는 **여기서 정한 같은 이메일·비밀번호**를 사용합니다. Supabase 관리 계정이나 DB 비밀번호를 입력하는 곳이 아닙니다. 프로젝트마다 첫 소유자 계정 하나만 가입할 수 있습니다. 이미 가입했다면 로그인 또는 비밀번호 재설정을 이용하세요.

### 4. AI 비서 연결 — 사용할 때만

**AI CLI**는 AI 계정을 터미널에서 사용하는 프로그램이고, **Runner**는 웹의 작업 요청을 받아 그 프로그램을 실행하는 로컬 프로세스입니다. 두 프로그램의 로그인은 서로 다릅니다.

1. 사용할 AI CLI **하나**를 설치하고 본인 계정으로 로그인합니다. [제공자별 설치 안내](docs/REFERENCE.ko.md#준비물)를 참고하세요.
2. 웹의 **프롬프트** 메뉴에서 실행할 비서들의 AI 제공자를 로그인한 CLI로 지정하고 저장합니다. 모든 비서를 같은 제공자로 지정해도 됩니다.
3. **새 터미널 B**를 열고, 저장소 최상위 폴더로 이동한 뒤 실행합니다.

```bash
cd runner
npm install
npm run login
npm run start
```

`npm run login`에는 **3번에서 웹 가입 시 정한 이메일·비밀번호**를 입력합니다. 비밀번호는 화면에 표시되지 않습니다.

4. 브라우저의 **관제실 → 러너 목록**에서 이 기기를 **승인**합니다.

**완료 확인:** 관제실에서 연결·승인 상태를 확인하고, 비서 작업 하나를 요청해 **실행 기록**에서 결과를 확인합니다. 연결만으로 비서가 계속 실행되는 것은 아닙니다. AI 작업 중에는 터미널 B와 PC를 켜 두세요.

<details>
<summary>다음 날 다시 실행할 때</summary>

설치·가입은 반복하지 않습니다. 저장소 폴더에서 터미널 A는 `cd web` → `npm run dev`, 새 터미널 B는 `cd runner` → `npm run start`를 실행하세요. Runner 세션이 만료됐을 때만 `npm run login`을 다시 실행합니다.

</details>

<details>
<summary>터미널 사용이 어려워 AI에게 설치를 맡기고 싶다면</summary>

내 PC의 터미널에 접근할 수 있는 코딩 에이전트에 아래 문장을 입력하세요. Supabase 로그인·웹 첫 가입·기기 승인은 본인이 진행합니다.

```text
다음 설치 지침을 읽고 Career Atelier를 설치해 줘: https://raw.githubusercontent.com/tkv00/Career-Atelier-AI-Context-Pack/refs/heads/main/docs/AI-INSTALL.md
```

[에이전트 설치 상세](docs/AI-INSTALL.md)

</details>

## 첫 자소서까지 따라하기

| 순서 | 어디서 무엇을 하나요? | 다음 단계로 넘어가는 기준 |
|---|---|---|
| 1 | **관제실**에서 목표 직무·관심 분야 저장 | 조사 기준이 입력됨 |
| 2 | **이력 정보**에 학력·경력 입력, **경험 카드**에 상황·판단·행동·결과 저장 | 실제 경험 카드가 하나 이상 있음 |
| 3 | **지원 일정 → + 직접 일정 입력**으로 회사·직무·마감일 입력 후 **캘린더에 저장** | 공고가 목록에 표시됨. 모카가 찾은 공고를 선택해도 됨 |
| 4 | 공고의 **자소서 쓰기** 또는 **자소서 작성 연결** 선택 | 해당 공고의 자소서 편집기가 열림 |
| 5 | 문항과 글자 수, 기업·직무·공고 내용을 입력하고 **기업 조사부터 소제목까지 실행 (솔)** 선택 | 솔 → 뮤즈 → 렌즈 → 콤마 작업 결과 확인 |
| 6 | 초안과 검수 결과를 읽고 사실관계·문체 수정 | 직접 검토한 자소서 완성. 지원서 제출은 본인이 진행 |

경험 카드가 없으면 뮤즈 단계에서 멈춥니다. 모카의 공고 탐색과 자소서 작성은 별도 요청입니다. [버튼과 작업 결과 상세](docs/FEATURE-WALKTHROUGH.ko.md)

## 기능은 어디서 쓰나요?

아래 이름은 웹의 왼쪽 메뉴와 같습니다.

| 메뉴 | 할 수 있는 일 | AI 필요 여부 |
|---|---|---|
| 관제실 | 목표 설정, 루미 뉴스 조사·모카 공고 탐색, Runner 승인 | 조사·탐색에 필요 |
| 지원 일정 | 공고·마감일 저장, 제출·전형 결과 관리, 자소서 편집기 열기 | 수동 관리에는 불필요 |
| 경험 카드 | 경험과 해시태그 관리, 3D 행성 탐색 | 수동 관리에는 불필요 |
| 이력 정보 | 학력·경력·자격증 등 저장 | 불필요 |
| 면접 준비 | 에코로 예상 질문 생성, 답변 정리 | 질문 생성에 필요 |
| 프롬프트 | 비서별 AI 제공자·모델·작성 지침 설정 | 설정 저장에는 불필요 |
| 실행 기록 | 대기·실행·완료·실패와 오류 확인 | 조회에는 불필요 |

[기능별 사용 순서](docs/FEATURE-WALKTHROUGH.ko.md) · [7명의 비서와 전체 화면](docs/REFERENCE.ko.md#7명의-비서)

## 기존 Notion·Excel 자료 가져오기

**선택 기능입니다. 첫 설치에 MCP를 연결할 필요는 없습니다.** 현재 가져오기는 내 PC의 MCP 클라이언트 또는 터미널에서 실행합니다. 웹의 업로드 마법사는 아직 없습니다.

| 내 자료 상태 | 현재 사용할 방법 |
|---|---|
| 표 구조는 같고 열 이름만 다름 | `column_map`으로 내 열 이름을 서비스 필드에 연결 |
| 시트가 여러 개임 | 가져올 `sheet`와 기록 종류 `section` 선택 |
| Notion DB의 속성 이름이 다름 | 속성 이름을 매핑하고 미리보기 확인 |
| 한 셀에 여러 경험, 병합 셀, 자유 서술 페이지 | 현재 자동 분해·의미 추출 미지원. 표의 값이나 지원되는 Markdown·JSON 구조로 정리 필요 |

**원본 형식을 모두 같게 만들 필요는 없지만, 현재 매핑으로 해결할 수 있는 범위에는 한계가 있습니다.** 미리보기의 제외·거부·경고를 확인한 뒤 저장하세요. 인식하지 못한 표의 열 값은 현재 저장되지 않습니다.

[연결·매핑·저장 예제](runner/mcp/README.md) · [서로 다른 형식을 처리하기 위한 확장 설계 — 미구현](docs/IMPORT-FORMAT-DESIGN.ko.md)

## 막혔을 때

| 증상 | 먼저 확인할 것 |
|---|---|
| 비밀번호가 틀리다고 나옴 | 웹 가입 여부, 서비스 비밀번호, 이메일 확인 상태. [로그인 가이드](docs/AUTH-TROUBLESHOOTING.md) |
| 웹은 되는데 Runner 로그인 실패 | 웹과 Runner의 Supabase 프로젝트가 같은지 확인 |
| 비서가 계속 대기함 | Runner 실행 → 기기 승인 → 해당 AI CLI 로그인 → 프롬프트의 제공자 설정 순서로 확인 |
| `cd web` 또는 `cd runner` 실패 | 현재 위치가 저장소 최상위 폴더인지 확인. 터미널 A와 B는 별도 창 |
| 설치 중 DB 비밀번호를 물음 | 기존 프로젝트에 접속하는 DB 비밀번호. 웹 계정 비밀번호와 다름 |

## 버전과 업데이트

현재 개발 기준 버전은 **0.1.0**입니다. 웹·Runner·설치 도구는 같은 제품 버전으로 관리합니다. 실제 발행 여부와 배포 파일은 [GitHub Releases](https://github.com/tkv00/Career-Atelier-AI-Context-Pack/releases)에서 확인하세요.

저장소 최상위에서 `npm run check:version`으로 버전을 확인합니다. 기존 설치를 바꾸기 전 [변경 이력](CHANGELOG.md)과 [업그레이드 안내](docs/UPGRADING.md)를 읽으세요. 개발자는 `npm run verify`로 버전·테스트·타입·린트·빌드를 한 번에 검사합니다.

[패키지·릴리스 정책](docs/RELEASING.md) · [유명 오픈소스 비교와 도입 판단](docs/OPEN-SOURCE-READINESS.ko.md) · [보안 제보](SECURITY.md)

## 필요할 때 더 보기

| 목적 | 안내 |
|---|---|
| 외부에서도 웹 사용 | 저장소 최상위에서 `npm run deploy`. [배포 상세](docs/REFERENCE.ko.md#배포). 외부 AI 요청도 켜진 로컬 Runner 필요 |
| 백업·개인정보·비용 확인 | [백업 범위](docs/REFERENCE.ko.md#데이터-백업) · [개인정보와 비용](docs/PRIVACY-AND-COST.md) |
| 자주 묻는 질문 | [FAQ: 계정·비용·AI·백업·자료 가져오기](docs/FAQ.ko.md) |
| 세부 기능·아키텍처 | [상세 가이드](docs/REFERENCE.ko.md) |
| 기술 연구·MCP 실험 | [한국어 연구 보고서](docs/research/mcp-import/REPORT.ko.md) |
| 개발·기여 | [기여 규칙](CONTRIBUTING.ko.md) · [AGENTS.md](AGENTS.md) |

[MIT License](LICENSE)
