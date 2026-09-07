# Security policy

Do not disclose passwords, tokens, private resume data, or vulnerability details in a public issue.

Use [GitHub private vulnerability reporting](https://github.com/tkv00/Career-Atelier-AI-Context-Pack/security/advisories/new) when enabled. If that channel is unavailable, ask the maintainer for a private contact route without posting exploit details. Include the affected release/commit, component, impact, and minimal reproduction with synthetic data.

This project is in early development. There is no LTS branch or guaranteed response SLA. Security fixes target the current development line and, once available, the latest release. Review release notes before upgrading; an old deployment does not receive fixes automatically.

Supabase anon keys are public by design. AI credentials and authenticated user sessions must stay on the runner's machine. Unauthorized access to another user's records, missing RLS, or credential exposure are security issues.

한국어: 비밀번호·토큰·실제 이력정보나 취약점 상세를 공개 이슈에 올리지 마세요. 위 비공개 제보 경로를 사용하고, 비활성화돼 있다면 상세 공개 없이 관리자에게 비공개 연락 방법을 요청하세요. 영향받는 버전·커밋, 재현 방법과 영향을 합성 데이터로 설명해 주세요. 현재 장기 지원 버전이나 응답 기한을 보장하지 않습니다.
