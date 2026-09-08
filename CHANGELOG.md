# Changelog

User-facing changes are recorded here before release. See [the release policy](docs/RELEASING.md).

## [Unreleased]

### Added

- Start the local web app and runner with `npm start` on Windows, macOS, and Linux, including dependency setup, interactive login when needed, and shared shutdown.
- Windows·macOS·Linux에서 `npm start` 하나로 패키지 준비, 웹·러너 실행, 필요한 로그인 안내와 동시 종료를 제공합니다.

- Show each available Codex subscription-limit window, its remaining percentage, and reset time from the signed-in local runner.

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
