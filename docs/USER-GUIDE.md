# 사용 가이드 (Windows·Mac·Linux)

Career Atelier는 두 부분으로 이루어져 있습니다.

- **웹 앱** — 브라우저로 접속해 캘린더·자소서·경험 아카이브를 보고 쓰는 곳.
- **러너** — 루미·모카·솔·뮤즈·렌즈·에코·소제목, 7개 AI 비서를 실제로 실행하는 프로그램. 내 컴퓨터에서 켜 둬야 합니다.

웹 앱만 봐도 되지만(캘린더 확인, 이미 쓴 글 수정 등), **AI 비서가 실제로 뭔가 조사하거나 써주게 하려면 러너가 켜져 있어야 합니다.**

이 앱은 **한 사람이 자기 계정으로 직접 설치해 쓰는 구조**입니다. 남이 만들어 둔 주소에 가입하는 방식이 아니라, Supabase와 Vercel을 각자 자기 것으로 만들어 씁니다.

---

## 1. 준비물

### 모든 OS 공통

- **Node.js 22 이상** — https://nodejs.org 에서 LTS 설치. 설치 후 `node -v`로 확인.
- **Supabase 계정** — https://supabase.com 무료 가입 후 새 프로젝트 하나 생성.
- **Supabase CLI** — `npm install -g supabase`
- **AI CLI (쓸 것만)** — 아래 중 최소 하나. 전부 설치할 필요는 없고, 로그인해 둔 CLI에 해당하는 비서만 동작합니다.

| CLI | 담당 비서 | 설치 및 로그인 |
|---|---|---|
| Codex (GPT) | 루미·모카·뮤즈 | `npm install -g @openai/codex` 후 `codex login` |
| Claude Code | 솔·렌즈·에코 | `npm install -g @anthropic-ai/claude-code` 후 `claude auth login` |
| Antigravity (Gemini) | 소제목 | https://antigravity.google 설치 안내 참고. Mac/Linux는 `curl -fsSL https://antigravity.google/cli/install.sh \| bash` |

> 이 CLI들은 **API 키가 아니라 각자의 구독 계정으로 로그인**합니다. 그래서 토큰당 추가 요금이 붙지 않습니다.

---

## 2. 설치 (최초 1회)

리포를 받은 뒤 설치 마법사를 실행합니다. **Windows·Mac·Linux 모두 같은 명령**입니다.

```bash
git clone https://github.com/tkv00/Career-Atelier-AI-Context-Pack.git
cd Career-Atelier-AI-Context-Pack
npm run setup
```

마법사가 하는 일:

1. Node·Supabase CLI·AI CLI 설치 상태 확인
2. Supabase 프로젝트 연결 (프로젝트 ref와 anon key를 물어봅니다)
3. 데이터베이스 테이블·보안 정책·기본 프롬프트 적용
4. `web/.env.local`과 `runner/.env` 자동 생성

**Supabase 프로젝트 ref와 anon key 찾는 법**: Supabase 대시보드 → 해당 프로젝트 → Settings → Data API. `service_role` 키는 **어디에도 넣지 마세요** — 이 프로젝트는 그 키를 쓰지 않습니다.

---

## 3. 실행

### 웹 앱

```bash
cd web
npm install
npm run dev
```

브라우저에서 http://localhost:3000 접속 → 본인 이메일과 비밀번호로 계정 만들기.

> **가장 먼저 가입한 계정이 이 인스턴스의 소유자**가 되고, 그 뒤로는 아무도 가입할 수 없습니다. 첫 가입을 본인 이메일로 하세요.

### 러너

새 터미널 창을 하나 더 열고:

```bash
cd runner
npm install
npm run login    # 이메일 입력 → 비밀번호 입력 (웹 로그인과 같은 계정)
npm run start
```

### 러너 승인 (최초 1회)

`npm run start`를 처음 실행하면 이 컴퓨터가 "승인 대기" 상태로 등록됩니다. 웹 앱 **관제실 화면 아래 "러너" 목록**에서 [승인]을 눌러야 실제로 작업을 받습니다. 기기마다 한 번만 하면 됩니다.

### 집·회사 밖에서도 웹으로 보고 싶다면 (선택)

여기까지만 해도 `localhost:3000`에서 웹 앱을 완전히 쓸 수 있습니다. 다만 그 주소는 이 컴퓨터 안에서만 열립니다. 다른 곳에서도 캘린더나 작성 중인 자소서를 보고 싶다면(러너가 꺼져 있어도 웹은 그대로 동작합니다):

```bash
npm run deploy
```

리포 루트에서 실행합니다. GitHub에 저장소를 올리거나 Vercel에서 Import할 필요가 없습니다 — `web/` 폴더를 Vercel CLI로 직접 프로젝트에 연결하고, `npm run setup`이 이미 써 둔 Supabase 값을 그대로 넣어 배포까지 끝냅니다. 처음 한 번만 Vercel 로그인 창이 뜹니다.

---

## 4. OS별 참고

대부분 동일하지만 몇 가지만 다릅니다.

### Windows

PowerShell을 쓰세요. 경로 구분자만 `\`로 바뀝니다.

```powershell
cd Career-Atelier-AI-Context-Pack\web
npm install
npm run dev
```

백업 폴더 경로를 지정할 때도 Windows 형식으로 적습니다: `C:\career-atelier-backups`

### Mac

기본 터미널(Terminal.app)로 충분합니다. 백업 경로는 `~/career-atelier-backups` 형식.

### Linux

Mac과 완전히 동일합니다.

---

## 5. 데이터 백업 (권장)

클라우드 DB가 정지되거나 실수로 지워지면 그동안 쓴 자소서와 경험 카드가 함께 사라집니다. Supabase 무료 플랜은 한동안 안 쓰면 프로젝트를 정지시키기도 합니다.

관제실 화면의 러너 항목에서 **"로컬 폴더 자동 백업"** 토글을 켜고 폴더 경로를 입력하세요.

- Mac/Linux: `~/career-atelier-backups`
- Windows: `C:\career-atelier-backups`

러너가 켜져 있는 동안 **2시간마다** 전체 데이터를 JSON으로 그 폴더에 저장합니다. 하루에 파일 하나라 폴더가 무한정 커지지 않습니다.

> 백업은 브라우저가 아니라 러너가 씁니다. 웹페이지는 내 디스크의 임의 폴더에 파일을 쓸 수 없기 때문입니다. 그래서 **러너가 꺼져 있으면 백업도 안 됩니다.**

---

## 6. 매일 쓰는 법

- 비서를 쓰고 싶을 때 `runner` 폴더에서 `npm run start` — 켜져 있는 동안만 작업을 처리합니다.
- Ctrl+C로 끄면 러너가 멈춥니다. 웹 앱(캘린더, 글 보기/수정)은 러너 없이도 항상 쓸 수 있습니다.
- 로그인은 한 번만 하면 되고, 이후에는 `npm run start`만 다시 실행하면 됩니다.

---

## 7. 막히면

**비서를 실행시켰는데 계속 실패로 남습니다**
→ 그 비서가 쓰는 CLI에 로그인이 안 돼 있을 가능성이 큽니다. 터미널에서 `codex login` / `claude auth login` / `agy`로 다시 로그인하세요.

**러너를 껐다 켰는데 다시 로그인하라고 합니다**
→ `npm run login`을 다시 실행하세요. 로그인 정보는 `~/.career-atelier/session.json`에 저장되며, 이 파일을 지우거나 다른 컴퓨터로 옮기면 다시 로그인해야 합니다.

**`npm install`이 실패합니다**
→ Node.js 버전이 22 미만일 가능성이 큽니다. `node -v`로 확인하세요.

**로그인하려는데 "이미 소유자가 있습니다"라고 나옵니다**
→ 그 Supabase 프로젝트에는 이미 다른 계정이 등록돼 있습니다. 본인 프로젝트를 새로 만들어 `npm run setup`을 다시 실행하세요.

**`npm run setup`이 "supabase db push 실패 — 직접 DB 연결이 막힌 네트워크일 수 있습니다"라고 나옵니다**
→ 학교·회사 네트워크가 데이터베이스 포트(5432/6543)를 막아 둔 경우입니다(웹은 되는데 DB 직결만 안 되는 흔한 방화벽 구성). 마법사가 자동으로 다른 경로(HTTPS)로 재시도합니다. 그것도 안 되면 `career-atelier-migrations-manual.sql` 파일을 만들어 주는데, 이 파일 전체를 복사해 `https://supabase.com/dashboard/project/<project-ref>/sql/new`의 SQL Editor(브라우저)에 붙여넣어 실행하세요 — 브라우저는 HTTPS만 쓰므로 같은 네트워크에서도 대개 됩니다. **터미널을 그대로 두고** 다 붙여넣고 실행했으면 터미널로 돌아와 Enter만 누르면 됩니다 — 마법사가 같은 실행 안에서 나머지 단계를 이어서 끝냅니다.
>
> `--yes`(무인 설치)로 실행 중이었다면 되돌아와 Enter를 누를 사람이 없으므로, 대신 안내된 명령에 `--skip-migrations`를 붙여 다시 실행하세요:
> ```bash
> node scripts/setup.mjs --project-ref <project-ref> --skip-migrations
> ```

**`npm run deploy`에서 원하는 주소 이름을 입력했는데 계속 "이미 다른 곳에서 쓰고 있습니다"가 나옵니다**
→ 정상적인 흐름입니다. `<이름>.vercel.app`은 Vercel 전체에서 하나뿐이라 흔한 이름은 이미 다른 사람이 쓰고 있을 수 있습니다. 다른 이름을 입력해 다시 시도하면 되고, 세 번 연달아 실패하면 스크립트가 확실히 비어 있는 무작위 이름을 제안합니다.

**백업 폴더에 파일이 안 생깁니다**
→ 러너가 켜져 있어야 하고, 승인된 상태여야 하며, 경로가 절대 경로여야 합니다. 관제실의 러너 항목에 실패 사유가 표시됩니다.

**가입/비밀번호 재설정 시 "email rate limit exceeded"가 나옵니다**
→ Resend를 설정하지 않은 상태라면 Supabase 기본 메일 서비스(시간당 2통)를 쓰고 있는 것입니다. 가입 흐름을 여러 번 반복 테스트하면 금방 막힙니다. 1시간쯤 기다리면 풀리고, 더 넉넉하게 쓰려면 `README.md`의 "Install — three commands" 안내대로 [Resend](https://resend.com)를 무료로 연결하세요.
