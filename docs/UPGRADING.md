# Upgrading an existing installation

[README](../README.md) · [한국어 README](../README.ko.md) · [Release policy](RELEASING.md)

## 한국어

처음 설치하는 사람은 README를 사용하세요. 기존 설치는 다음 순서로 업데이트합니다.

1. 현재 버전은 저장소 최상위에서 `npm run check:version`으로 확인합니다. 변경 이력과 GitHub Releases에서 **실제 발행된 대상 버전**의 업그레이드 안내를 읽습니다. 릴리스가 아직 없으면 임의의 예제 태그를 사용하지 마세요.
2. 웹·Runner를 중지하고 로컬 변경 여부를 `git status`로 확인합니다. 작업 중인 변경은 먼저 정리합니다. `.env`와 필요한 데이터를 별도로 백업하세요. 앱의 자동 백업은 일부 테이블 대상이며 전체 DB·첨부파일 복구를 보장하지 않습니다.
3. `git fetch origin --tags` 후 선택한 실제 태그로 `git switch --detach <실제-태그>` 합니다. 이때도 비공개 설정 파일은 Git으로 관리하지 않습니다. `git reset --hard`나 기존 사용자 삭제로 업데이트하지 마세요.
4. 저장소 최상위에서 `npm ci`, `npm ci --prefix web`, `npm ci --prefix runner`를 각각 실행합니다.
5. 릴리스 안내에 DB 변경이 있을 때만 기존 프로젝트에 새 마이그레이션을 적용합니다. 마법사를 사용한다면 현재 프로젝트를 선택하고 기존 연결을 확인하세요. `--new-project`는 업데이트 명령이 아닙니다.
6. 웹과 Runner를 같은 버전으로 재시작합니다. Vercel 웹도 사용하면 해당 버전으로 별도 재배포합니다. 로그인, 기존 경험 조회, 저장, 비서 작업 하나를 확인합니다.

코드 태그를 이전 버전으로 돌려도 DB는 되돌아가지 않습니다. 마이그레이션 이후의 롤백은 해당 릴리스의 호환성 안내와 복구 가능한 백업을 기준으로 결정해야 합니다. 자동 DB 다운그레이드는 제공하지 않습니다.

## English

Read the actual target release notes, record your current version with `npm run check:version`, stop web and runner, inspect `git status`, and back up configuration and data. Built-in backup covers selected tables, not full database/attachment recovery.

Fetch tags, switch to a real published release tag, and run `npm ci` in root, web, and runner. Apply only the new migrations required by that release to the existing Supabase project. Creating a new project is not an upgrade. Restart both components at the same version, redeploy Vercel if used, and smoke-test login, existing records, saving, and an AI task.

A source-code rollback does not undo database migrations. Follow release-specific compatibility and backup guidance rather than assuming old code can use the new schema.
