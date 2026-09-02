# 사용 가이드 (Windows·Mac·Linux)

Career Atelier는 두 부분으로 이루어져 있다.

- **웹 앱** — 브라우저로 접속해 캘린더·자소서·경험 아카이브를 보고 쓰는 곳. 설치가 필요 없다.
- **러너** — 루미·모카·솔·뮤즈·렌즈·에코·소제목, 7개 AI 비서를 실제로 실행하는 프로그램. 내 컴퓨터에서 켜 둬야 하고, 최초 1회만 설치하면 된다.

웹 앱만 봐도 되지만(캘린더 확인, 이미 쓴 글 수정 등), **AI 비서가 실제로 뭔가 조사하거나 써주게 하려면 러너가 켜져 있어야 한다.**

## 1. 웹 앱 로그인 (모든 기기 공통)

1. 브라우저에서 `https://career-atelier-web.vercel.app` 접속
2. 이메일 입력 → 받은 메일의 매직링크 클릭
3. 끝. Windows든 Mac이든 휴대폰이든 브라우저만 있으면 된다.

## 2. 러너 설치 (최초 1회, 컴퓨터마다 한 번씩)

### 공통 준비물

- **Node.js 22 이상** — https://nodejs.org 에서 설치 (LTS 아무거나 22 이상이면 됨)
- 아래 AI 비서 중 실제로 쓸 CLI 도구 로그인 (구독 계정으로 로그인하는 것 — API 키 아님)
  - Codex(GPT) CLI: `npm install -g @openai/codex` 후 `codex login`
  - Claude Code CLI: `npm install -g @anthropic-ai/claude-code` 후 `claude auth login`
  - Antigravity(Gemini) CLI — 소제목 비서용: 공식 사이트(https://antigravity.google) 설치 안내를 따른다. Mac/Linux는 `curl -fsSL https://antigravity.google/cli/install.sh | bash`, Windows는 사이트의 Windows 설치 방법을 확인한다. 설치 후 `agy`를 한 번 실행하면 로그인 안내(구글 계정)가 뜬다.

전부 다 설치할 필요는 없다 — 로그인해 둔 CLI에 해당하는 비서만 작동하고, 나머지는 실행을 시켜도 실패로 남을 뿐이다.

### Mac

터미널(Terminal.app)을 열고:

```bash
cd Career-Atelier-AI-Context-Pack/runner
npm install
cp .env.example .env
```

`.env` 파일을 열어 아래 두 줄을 채운다 (이 값은 공개돼도 안전한 값이다):

```
SUPABASE_URL=https://ljsekqxcbobnvgjhgjjc.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxqc2VrcXhjYm9ibnZnamhnampjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxODE2NzcsImV4cCI6MjEwMzc1NzY3N30.urxTEowofWWoa_6pZwIp-BQdUu84mf3dKIgMCo5pDas
```

그다음:

```bash
npm run login   # 이메일 입력 → 받은 메일의 6자리 코드 입력
npm run start    # 러너 시작
```

### Windows

PowerShell을 열고:

```powershell
cd Career-Atelier-AI-Context-Pack\runner
npm install
copy .env.example .env
```

`.env` 파일을 메모장으로 열어 Mac 항목과 같은 두 줄(`SUPABASE_URL`, `SUPABASE_ANON_KEY`)을 채운다.

```powershell
npm run login
npm run start
```

### Linux

터미널을 열고 Mac과 동일하게 진행한다:

```bash
cd Career-Atelier-AI-Context-Pack/runner
npm install
cp .env.example .env
# .env 편집은 원하는 편집기로 (nano .env 등)
npm run login
npm run start
```

### 처음 켰을 때 한 가지 더

`npm run start`를 처음 실행하면 이 컴퓨터가 러너 목록에 "승인 대기" 상태로 등록된다. 웹 앱 **관제실(대시보드) 화면 하단의 "러너" 목록**에서 이 기기 옆의 [승인] 버튼을 눌러야 실제로 작업을 받는다(기기마다 한 번만 하면 됨).

## 3. 매일 쓰는 법

- 러너를 켜 두고 싶을 때만 `runner` 폴더에서 `npm run start` — 켜져 있는 동안만 AI 비서가 작업을 처리한다.
- 창을 닫거나 Ctrl+C로 끄면 러너는 멈춘다. 웹 앱(캘린더, 글 보기/수정)은 러너 없이도 항상 그대로 쓸 수 있다.
- 로그인은 한 번만 하면 되고, 이후에는 `npm run start`만 다시 실행하면 된다.

## 막히면

- **비서를 실행시켰는데 계속 실패로 남음** → 그 비서가 쓰는 CLI(`codex login` / `claude auth login` / `agy`)에 로그인이 안 돼 있을 가능성이 크다. 터미널에서 해당 CLI로 다시 로그인.
- **러너를 껐다 켰는데 다시 로그인하라고 함** → `npm run login`을 다시 실행하면 된다. 로그인 정보는 `~/.career-atelier/session.json`에 저장되는데, 이 파일을 지웠거나 다른 컴퓨터로 옮기면 다시 로그인해야 한다.
- **`npm install`이 실패함** → Node.js 버전이 22 미만일 가능성이 크다. `node -v`로 확인.
