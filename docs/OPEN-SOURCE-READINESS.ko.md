# 오픈소스 운영 비교와 도입 판단

확인일: 2026-09-07. 저장소 설정 파일과 공식 릴리스 자료를 비교했습니다. 프로젝트 규모나 인기 순위를 평가한 문서는 아닙니다.

## 비교에서 가져온 것

| 비교 대상 | 공식 자료에서 확인한 운영 방식 | Career Atelier에 적용한 판단 |
|---|---|---|
| Excalidraw | 비공개 모노레포 루트에 패키지 매니저·워크스페이스·검증/릴리스 스크립트 명시 | 패키지 메타데이터, npm 버전, 공통 검증 진입점 도입 |
| Cal.com 계열의 cal.diy | 현재 공식 경로가 cal.diy로 연결되며, 여러 패키지와 Changesets 버전·배포 명령 운영 | 버전 갱신을 수작업에서 명시적 명령으로 전환. 현재 세 패키지는 독립 배포 SDK가 아니므로 Changesets는 보류 |
| Immich | 버전별 GitHub Releases에 변경 사항과 사용자가 읽을 업데이트 정보 제공 | 변경 이력·태그·릴리스 초안·업그레이드 절차를 연결 |

출처: [Excalidraw package.json](https://github.com/excalidraw/excalidraw/blob/master/package.json), [cal.diy package.json](https://github.com/calcom/cal.diy/blob/main/package.json), [Immich Releases](https://github.com/immich-app/immich/releases). 유명 프로젝트의 구성을 전부 복사하는 대신 현재 배포 구조와 유지보수 규모를 기준으로 골랐습니다.

## 이번에 보완한 항목

| 기존 상태 | 보완 | 검증·운영 경계 |
|---|---|---|
| 세 곳의 `0.1.0` 수동 관리 | 제품 버전 동기화 검사·상향 갱신 명령 | 현재 버전을 임의로 올리거나 릴리스를 발행하지 않음 |
| 라이선스 파일만 존재 | 패키지별 MIT·저장소·이슈·홈페이지 메타데이터 | npm 공개는 계속 금지(`private: true`) |
| lockfile 있으나 통합 검증 없음 | `npm ci` 기반 CI, 루트 `npm run verify` | GitHub에서의 실행은 푸시 후 확인 필요 |
| OS별 인증 문제를 로컬에서만 확인 | Windows/Linux, 최소 Node 22.13.0/Node 24 테스트 매트릭스 | 모의 인증 테스트이며 실제 계정 로그인은 별도 |
| 변경 이력·태그 절차 없음 | CHANGELOG, 태그와 버전 검사, CI 후 Draft Release | 발행·태그 보호 설정은 관리자가 수행 |
| 의존성 업데이트 수동 확인 | 주간 Dependabot 설정, 도구 묶음별 PR | 자동 병합하지 않음. 설정이 main에 반영돼야 동작 |
| 업데이트가 재설치와 혼동 | 기존 데이터 보존·동일 버전 운영·DB 롤백 한계 문서 | 자동 DB 복원 기능을 추가한 것은 아님 |
| 보안 제보 안내가 기여 문서에만 있음 | 루트 SECURITY.md | GitHub 비공개 제보 기능 활성화 여부는 별도 설정 |

[SemVer](https://semver.org/)를 사용하되 0.x에서는 호환성을 깨는 변경을 minor 증가와 명시적 업그레이드 설명으로 알립니다. 커밋 메시지는 기존 영어 명령형 규칙을 유지합니다. 버전 결정을 커밋 접두사에 맡기지 않아 기존 이력을 바꿀 필요가 없습니다.

## 아직 도입하지 않은 것과 이유

- **npm 공개 패키지:** 웹은 Vercel, Runner는 개인 PC에서 동작합니다. npm 이름만 등록해도 설치가 끝나는 구조가 아닙니다. 향후 독립 설치 CLI를 공개하려면 파일 포함 범위·자격증명 제외·업데이트 정책을 먼저 설계해야 합니다.
- **워크스페이스 통합:** Vercel의 `web` 루트 배포와 기존 폴더별 설치를 유지합니다. lockfile을 합치면 베타 사용자의 설치 방식까지 바뀌므로 현재는 공통 명령과 버전 검사로 관리합니다.
- **Docker 배포:** 사용자의 호스트 AI CLI 로그인·Runner 세션·OS 권한 문제를 해결하지 않고 이미지만 만들면 실제 설치는 더 어려워질 수 있습니다.
- **자동 메이저 업데이트·자동 병합:** 인증·DB·제공자 CLI 호환성이 중요해 실제 동작 검토를 유지합니다.
- **과장된 배지·지원 보장:** 아직 실행하지 않은 CI를 통과했다고 표시하거나 응답 SLA·보안 지원 기간을 약속하지 않습니다.

다음 운영 단계는 main에 변경 반영, CI 확인, 베타 환경 실제 실행, 버전 결정, 태그와 릴리스 초안 검토 순서입니다. 구체적인 명령은 [릴리스 정책](RELEASING.md)에 있습니다. 프로젝트 설정의 branch protection, tag rules, private vulnerability reporting은 이번 파일 변경으로 활성화되지 않습니다.

의존성 자동화 구성은 [GitHub Dependabot 공식 문서](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference), CI 재사용은 [GitHub Actions 공식 문서](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows)를 기준으로 작성했습니다.
