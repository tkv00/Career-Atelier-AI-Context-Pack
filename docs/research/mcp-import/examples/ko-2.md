# Experience

## 가상 경험 0001
- context: 가상 서비스에서 사용자 요청이 늘어나 응답 지연이 발생했다.
- problem: 반복 쿼리가 지연의 원인이었고 측정 기준도 없었다.
- role_scope: 분석 및 구현 담당
- judgment: 동일한 부하에서 전후를 비교하기로 했다.
- action: 쿼리 계측을 추가하고 중복 호출을 줄였다.
- result: 가상 실험에서 지연이 감소했다.
- trial_error: 캐시 갱신 누락을 발견해 무효화 조건을 수정했다.
- reflection: 체감보다 재현 가능한 측정이 중요했다.
- metrics: sample=1, latency=120ms
- tags: 성능, 협업

## 가상 경험 0002
- context: 가상 서비스에서 사용자 요청이 늘어나 응답 지연이 발생했다.
- problem: 반복 쿼리가 지연의 원인이었고 측정 기준도 없었다.
- role_scope: 분석 및 구현 담당
- judgment: 동일한 부하에서 전후를 비교하기로 했다.
- action: 쿼리 계측을 추가하고 중복 호출을 줄였다.
- result: 가상 실험에서 지연이 감소했다.
- trial_error: 캐시 갱신 누락을 발견해 무효화 조건을 수정했다.
- reflection: 체감보다 재현 가능한 측정이 중요했다.
- metrics: sample=2, latency=120ms
- tags: 성능, 협업
