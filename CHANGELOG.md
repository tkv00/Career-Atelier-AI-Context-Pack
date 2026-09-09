# Changelog

User-facing changes are recorded here before release. See [the release policy](docs/RELEASING.md).

## [Unreleased]

## [0.2.0-beta.2] - 2026-09-10

### Changed

- Make Korean the default README, retain an English edition, and introduce features through example screens and common application-writing frustrations. Add copy-ready agent installation requests for both new and existing clones.
- 기본 README를 한국어로 전환하고 영문판을 유지합니다. 취업 준비의 불편과 예시 화면으로 기능을 소개하고, clone 전후에 복사해 사용할 에이전트 설치 요청문을 제공합니다.

### Added

- Choose provider-specific models from dropdowns in Prompt Lab and source imports, while retaining CLI defaults and custom model IDs.
- 프롬프트 관리와 자료 가져오기에서 AI 종류별 모델을 드롭다운으로 선택하고, CLI 기본값과 직접 입력 모델도 사용할 수 있습니다.

- Offer GPT-6 Astra as a Codex model choice and pass the selection to the local Codex CLI.
- GPT-6 Astra를 Codex 모델로 선택하고 로컬 Codex CLI에서 실행할 수 있습니다.

- Start the local web app and runner with `npm start` on Windows, macOS, and Linux, including dependency setup, interactive login when needed, and shared shutdown.
- Windows·macOS·Linux에서 `npm start` 하나로 패키지 준비, 웹·러너 실행, 필요한 로그인 안내와 동시 종료를 제공합니다.

- Show each available Codex subscription-limit window, its remaining percentage, and reset time from the signed-in local runner.

### Fixed

- Apply new database migrations automatically before `npm start`, and restore missing `authenticated` privileges on existing installations so runner login no longer fails at the `runners` table.
- `npm start` 전에 새 DB 마이그레이션을 자동 적용하고 기존 설치의 `authenticated` 권한을 복구해 러너 로그인이 `runners` 테이블에서 실패하지 않도록 했습니다.

- Use the Supabase CLI login session for migration queries instead of reading its management token from the operating-system keychain.
- 운영체제 키링에서 관리 토큰을 직접 읽는 대신 Supabase CLI 로그인 세션으로 마이그레이션을 실행합니다.

- Declare the Turbopack workspace root so development startup does not warn about the repository and web lockfiles.
- 저장소와 웹 잠금 파일이 함께 있을 때 개발 서버가 경고하지 않도록 Turbopack 작업공간 루트를 명시했습니다.

- Accept the historical `0031_source_imports` migration name when upgrading an instance that recorded the earlier migration order.
- 이전 마이그레이션 순서를 기록한 인스턴스를 업데이트할 때 과거의 `0031_source_imports` 이름도 호환합니다.

### Upgrade notes

- No database migration is required for this release. Keep the web and local Runner on the same version.
- 데이터베이스 마이그레이션은 필요하지 않습니다. 웹과 로컬 Runner를 같은 버전으로 유지하세요.

### Known limitations and verification

- This is a prerelease for beta testing. AI tasks still require an approved local runner and a signed-in provider CLI.
- 이번 릴리스는 베타 테스트용 프리릴리스입니다. AI 작업에는 승인된 로컬 Runner와 로그인된 CLI가 필요합니다.
- `npm run verify` passed with CI-style placeholder Supabase settings; live provider authentication and browser smoke checks were not run.
- CI용 Supabase placeholder 설정으로 `npm run verify`를 통과했으며, 실제 provider 인증과 브라우저 smoke test는 실행하지 않았습니다.

## [0.2.0-beta.1] - 2026-09-07

First public beta. Web, runner, installer, and MCP share this version.

### Added

- Local Excel and Notion imports with column mapping, previews, and source-change checks.
- README status/version badges and manual retry of draft releases for existing tags.
- Synchronized package-version checks and a dry-run-first release preparation command.
- CI for runner/tooling tests on Windows and Linux, and web type checking, lint, and build.
- Tag-triggered draft releases, dependency-update configuration, and upgrade documentation.
- Character introductions, dedicated FAQs, and task-oriented installation and feature guides.

### Fixed

- Read the MCP server version from its package so release preparation cannot leave stale server metadata.
- Explain web signup, confirmation, and runner credential/project mismatches instead of treating every authentication failure as an incorrect password.

### Upgrade notes

- Internal comparison, design, and presentation documents are no longer included in the public source tree; user guides and the example workbook remain available.

- The setup wizard no longer creates temporary service passwords. Create the owner account in the web app and use the same credentials for the runner.
- Review changes to setup and database migrations before updating an existing installation.

### Known limitations and verification

- This is a prerelease for beta testing. AI tasks require an approved local runner and a signed-in provider CLI; publishing this release does not deploy the web app.
- Notion and database import failures are tested with fixtures/test doubles. Live provider authentication and full database restore are not covered by CI.
- Web checks include types, lint, and production build. Runner tests exercise MCP stdio and real XLSX parsing; optional PostgreSQL and OS-specific tests may skip when their environment is unavailable.
- Existing users should follow [the upgrade guide](https://github.com/tkv00/Career-Atelier-AI-Context-Pack/blob/v0.2.0-beta.1/docs/UPGRADING.md). Database migrations are append-only; changing a code tag does not roll back the database.

### 한국어 안내

- 첫 공개 베타입니다. 웹·Runner·MCP를 같은 버전으로 사용하세요.
- 가입 안내·FAQ·캐릭터·배지를 정리하고 Excel·Notion 가져오기, 버전 검사, CI와 릴리스 관리를 포함했습니다.
- 내부 비교·설계·발표 자료는 공개 배포본에서 제외했습니다. 과거 Git 기록에는 남아 있습니다.
- AI 실행에는 로컬 Runner와 본인 CLI 로그인이 필요하며, 이번 릴리스 발행은 Vercel 재배포와 별개입니다.
