<img src="docs/images/banner.png" alt="Career Atelier" width="100%">

<p>
  <a href="https://github.com/tkv00/Career-Atelier-AI-Context-Pack/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/tkv00/Career-Atelier-AI-Context-Pack/actions/workflows/ci.yml/badge.svg?branch=main"></a>
  <a href="https://github.com/tkv00/Career-Atelier-AI-Context-Pack/releases"><img alt="Package version" src="https://img.shields.io/github/package-json/v/tkv00/Career-Atelier-AI-Context-Pack?label=version&amp;style=flat-square"></a>
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-f5a962?style=flat-square"></a>
  <img alt="Node.js 22.13 or newer" src="https://img.shields.io/badge/node-%E2%89%A522.13-5cc98f?style=flat-square&amp;logo=node.js&amp;logoColor=white">
  <img alt="Next.js" src="https://img.shields.io/github/package-json/dependency-version/tkv00/Career-Atelier-AI-Context-Pack/next?filename=web%2Fpackage.json&amp;style=flat-square&amp;logo=nextdotjs">
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-Postgres%20%2B%20RLS-3ecf8e?style=flat-square&amp;logo=supabase&amp;logoColor=white">
  <img alt="Windows macOS Linux" src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-58cfe4?style=flat-square">
  <img alt="No per-token API billing" src="https://img.shields.io/badge/API%20billing-none-5cc98f?style=flat-square">
</p>

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

**저장소 폴더에서 `npm start`만 실행하세요.** Windows·macOS·Linux 모두 같은 명령으로, 터미널 하나에서 웹과 러너를 함께 켭니다.

### 1. 최초 한 번 준비

Git, [Node.js 22.13 이상](https://nodejs.org/en/download), PATH에서 실행 가능한 [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)를 설치하고 본인의 [Supabase 계정](https://supabase.com)을 준비하세요. CLI는 운영체제에 맞는 공식 설치 방법을 따르세요.

Windows는 PowerShell 또는 명령 프롬프트, macOS·Linux는 터미널에서 실행합니다.

```bash
git clone https://github.com/tkv00/Career-Atelier-AI-Context-Pack.git
cd Career-Atelier-AI-Context-Pack
npm start
```

이미 내려받았다면 해당 폴더에서 `npm start`만 실행하세요. 설정이 없으면 설치 마법사를 안내하고, 필요한 웹·러너 패키지를 잠금 파일 기준으로 설치한 뒤 둘을 함께 시작합니다. 기존 설정은 재사용합니다. 첫 실행에는 인터넷 연결이 필요하며 몇 분 걸릴 수 있습니다.

### 2. 본인 계정으로 마무리

1. 처음 설정할 때 Supabase 로그인과 프로젝트 선택 안내를 따르세요. 마법사가 프로젝트 정보를 찾고 데이터베이스 마이그레이션을 적용합니다.
2. 출력된 웹 주소(기본 `http://localhost:3000`)를 열고 **처음이에요 · 계정 만들기**에서 본인 이메일과 직접 정한 비밀번호로 가입하세요. 첫 계정만 소유자로 가입할 수 있고, 기존 사용자는 로그인하면 됩니다.
3. 같은 터미널에서 러너 로그인을 요청하면 **웹에서 정한 이메일·비밀번호**를 입력하세요. 비밀번호는 화면에 표시되지 않습니다. Supabase 대시보드 계정이나 DB 비밀번호와는 다릅니다.
4. 웹 **관제실**의 러너 목록에서 이 기기를 승인하세요.

Supabase 로그인·최초 가입·기기 승인은 본인이 직접 해야 합니다. 유효한 러너 세션이 있으면 재사용하고, 본인 터미널에서 로그인이 필요한 경우에만 입력을 요청합니다.

### 3. 사용하는 AI 연결

지원하는 [AI CLI](docs/REFERENCE.md#requirements)를 하나 이상 설치하고 본인 구독 계정으로 로그인하세요. 웹 **프롬프트**에서 사용할 비서의 제공자를 해당 CLI로 지정하세요. AI CLI 로그인은 웹·러너 계정과 별개입니다.

**경험 카드**에 경험을 저장한 뒤 비서 작업을 요청하고 **실행 기록**에서 결과를 확인하세요. AI 작업 중에는 이 터미널과 컴퓨터를 켜 두세요.

### 매일 실행

```bash
npm start
```

터미널에 출력된 웹 주소를 열면 됩니다. **Ctrl+C 한 번**으로 로컬 웹과 러너를 함께 종료합니다. 설치나 가입을 반복할 필요는 없습니다.

<details>
<summary>필요할 때만 쓰는 명령 — 모두 같은 저장소 폴더에서 실행</summary>

| 필요 | 명령 |
|---|---|
| 이미 배포한 웹을 쓰며 로컬 러너만 켜기 | `npm run runner` |
| 로컬 웹만 켜서 자료 관리하기 | `npm run web` |
| 러너 재로그인 또는 서비스 계정 변경 | `npm run login` |
| 러너 연결 진단 | `npm run doctor` |
| Supabase 재설정 또는 업데이트 후 마이그레이션 적용 | `npm run setup` |

일반 실행은 기존 환경 파일을 재사용하며 새 마이그레이션을 적용하지 않습니다. 업데이트 시 [업그레이드 가이드](docs/UPGRADING.md)를 따르세요. 개발용 `web/`·`runner/` 내부 명령은 계속 사용할 수 있습니다.

</details>

<details>
<summary>AI 코딩 에이전트에게 설치를 맡기려면</summary>

컴퓨터의 터미널을 사용할 수 있는 코딩 에이전트에게 아래 내용을 전달하세요. Supabase 로그인·최초 웹 가입·기기 승인은 본인이 직접 합니다.

```text
다음 안내를 읽고 Career Atelier를 설치해줘: https://raw.githubusercontent.com/tkv00/Career-Atelier-AI-Context-Pack/refs/heads/main/docs/AI-INSTALL.md
```

[에이전트용 설치 절차](docs/AI-INSTALL.md)

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

[연결·매핑·저장 예제](runner/mcp/README.md)

## 막혔을 때

| 증상 | 먼저 확인할 것 |
|---|---|
| 비밀번호가 틀리다고 나옴 | 웹 가입 여부, 서비스 비밀번호, 이메일 확인 상태. [로그인 가이드](docs/AUTH-TROUBLESHOOTING.md) |
| 웹은 되는데 Runner 로그인 실패 | 웹과 Runner의 Supabase 프로젝트가 같은지 확인 |
| 비서가 계속 대기함 | Runner 실행 → 기기 승인 → 해당 AI CLI 로그인 → 프롬프트의 제공자 설정 순서로 확인 |
| 실행 실패 또는 포트 사용 중 | 저장소 폴더에서 `npm start` 실행. 3000번 포트를 쓰는 기존 로컬 웹이 있으면 종료 |
| 패키지 설치 실패 | Node.js 22.13 이상·인터넷 연결·출력된 npm 오류를 확인하고 `npm start` 재실행 |

## 기존 기록 가져오기

**자료 가져오기**(`/imports`)에서 Markdown·XLSX 업로드, 텍스트·엑셀 셀 붙여넣기, Notion 페이지·DB 주소 입력을 지원합니다. 원문과 추출 필드를 대조하고 저장하세요. 정형 자료는 규칙으로 처리하고, 자유 문서는 선택적으로 로컬 CLI가 정리합니다. Notion 인증은 러너에 유지합니다. 업데이트 후 `0032_source_imports.sql`을 적용하고 러너를 재시작해야 합니다.

작성 시 관련 경험을 컨텍스트 예산 내에서 선별하고 고정·인용 근거를 유지합니다.

## 버전과 업데이트

현재 버전은 상단의 버전 배지와 `npm run check:version`으로 확인합니다. 웹·Runner·설치 도구는 같은 제품 버전으로 관리합니다. 실제 발행 여부와 배포 파일은 [GitHub Releases](https://github.com/tkv00/Career-Atelier-AI-Context-Pack/releases)에서 확인하세요.

저장소 최상위에서 `npm run check:version`으로 버전을 확인합니다. 기존 설치를 바꾸기 전 [변경 이력](CHANGELOG.md)과 [업그레이드 안내](docs/UPGRADING.md)를 읽으세요. 개발자는 `npm run verify`로 버전·테스트·타입·린트·빌드를 한 번에 검사합니다.

[패키지·릴리스 정책](docs/RELEASING.md) · [보안 제보](SECURITY.md)

## 필요할 때 더 보기

| 목적 | 안내 |
|---|---|
| 외부에서도 웹 사용 | 저장소 최상위에서 `npm run deploy`. [배포 상세](docs/REFERENCE.ko.md#배포). 외부 AI 요청도 켜진 로컬 Runner 필요 |
| 백업·개인정보·비용 확인 | [백업 범위](docs/REFERENCE.ko.md#데이터-백업) · [개인정보와 비용](docs/PRIVACY-AND-COST.md) |
| 자주 묻는 질문 | [FAQ: 계정·비용·AI·백업·자료 가져오기](docs/FAQ.ko.md) |
| 세부 기능·아키텍처 | [상세 가이드](docs/REFERENCE.ko.md) |
| 개발·기여 | [기여 규칙](CONTRIBUTING.ko.md) · [AGENTS.md](AGENTS.md) |

[MIT License](LICENSE)
