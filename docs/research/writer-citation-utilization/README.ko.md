# 뮤즈 경험 카드 인용 활용률 계측

이 폴더는 Career Atelier 제품 기능이 아니라 개인 포트폴리오용 실험 자료다. 제품 화면, 운영 DB 스키마, 마이그레이션에는 인용률 필드나 대시보드를 추가하지 않는다. 실행 결과도 Git에서 제외된 이 폴더 아래 `results/`에만 저장한다.

## 판단

`evidence[].experience_id`는 모델이 어떤 카드를 근거로 지목했는지를 보여 준다. 모델이 파일의 모든 카드를 실제로 읽었는지는 관측할 수 없으므로 이 값을 **읽기율**이라고 부르면 안 된다.

또한 현재 구현은 전체 경험 카드를 바로 `04-experiences.md`에 쓰지 않는다. `selectExperiences`가 문항·직무·요구 역량·수정 요청과 경험 카드의 제목·태그·본문을 비교하고, 기본 16,000자 예산 안에서 선별한 카드만 제공한다. 따라서 `전체 보유 카드 대비 인용 카드` 하나만 보면 검색 단계와 작성 단계가 섞인다.

포트폴리오에서는 다음 세 지표를 분리한다.

| 지표 | 계산 | 의미 |
|---|---:|---|
| 선별 커버리지 | 제공 카드 / 전체 후보 카드 | 검색기가 컨텍스트에 남긴 범위 |
| 인용 활용률 | 유효 고유 인용 카드 / 제공 카드 | 제공된 후보 중 초안의 명시적 근거가 된 비율 |
| 전체 후보 인용 수율 | 유효 고유 인용 카드 / 전체 후보 카드 | 검색과 작성을 합친 최종 선택 비율 |

예를 들어 전체 30장 중 10장을 제공하고 4장을 인용했다면 선별 커버리지는 33.3%, 인용 활용률은 40.0%, 전체 후보 인용 수율은 13.3%다. 기존의 `4 / 30 = 13%`는 틀린 계산은 아니지만, 현재 코드에서는 **인용률**보다 **전체 후보 인용 수율**이라는 이름이 정확하다.

낮은 인용 활용률은 컨텍스트 축소 실험을 시작할 신호가 될 수 있다. 그러나 인용되지 않은 카드가 비교·선택에 영향을 줬을 가능성이 있고, 적은 카드만 제공해서 인용률을 인위적으로 높일 수도 있다. 따라서 이것만으로 나머지 카드가 모두 노이즈였거나 검색기가 좋아졌다고 결론내리지 않는다. 검색 개선 주장은 이후 동일 문항 A/B 실행에서 사람 기준 관련 카드 recall, 초안 품질, 근거 위반, 입력 토큰을 함께 비교할 때만 한다.

## 계측 구간과 계측기

```text
T0 전체 후보 조회
   experience_cards 전체 → selectExperiences 입력
   계측기: context_selection.selected + context_selection.excluded

T1 컨텍스트 제공
   selectExperiences 출력 → context/04-experiences.md 기록 완료
   계측기: run_events(kind = context_selection).payload.selected

T2 명시적 근거 채택
   CLI 구조화 출력 → evidence ID 사후 검증
   계측기: agent_runs.output.evidence와 T1 selected ID의 교집합
```

`context_selection` 이벤트는 컨텍스트 파일을 만든 뒤, 모델 호출 전에 기록된다. 수집기는 완료된 writer 실행의 두 기존 관측값을 `run_id`로 결합한다. 제공하지 않은 ID를 모델이 반환하면 유효 인용 분자에서 제외하고 `invalid_cited_cards`로 센다. 같은 카드를 여러 문단에서 인용해도 카드 인용률 분자에는 한 번만 세고, 별도로 `evidence_items`에 반복 횟수를 남긴다.

## 실행

먼저 러너 로그인이 저장되어 있어야 한다. 제품 실행 중에는 별도 계측 코드가 동작하지 않는다. 측정하고 싶을 때만 저장소 루트에서 실행한다.

```powershell
node docs/research/writer-citation-utilization/collect.mjs --limit 100
```

기간을 제한하거나 출력 위치를 지정할 수 있다.

```powershell
node docs/research/writer-citation-utilization/collect.mjs --since 2026-09-01 --limit 200 --out docs/research/writer-citation-utilization/results/september
```

생성물:

- `runs.csv`: 실행별 비식별 계측값
- `summary.json`: 실행 수, 제외 사유, micro/macro 집계, 해석 한계
- `README.md`: 공개 자료에 함께 둘 수 있는 데이터 범위 설명

수집기는 저장된 access token을 갱신하지 않고 읽기 쿼리만 사용하므로 실행 중인 러너의 refresh token 회전에 개입하지 않는다. access token이 만료됐다면 `npm run login` 후 다시 실행한다. 프롬프트, 초안, `quoted_fact`, 실제 카드 ID, 사용자 ID, 인증 정보는 결과에 쓰지 않는다. `run_key`는 실행할 때마다 새 난수 salt로 만든 짧은 해시여서 서로 다른 내보내기 사이의 동일 실행도 연결할 수 없다.

테스트:

```powershell
node --test docs/research/writer-citation-utilization/metrics.test.mjs
```

## 해석 규칙

- micro 인용 활용률은 모든 실행의 인용 카드 합 / 제공 카드 합이다. 카드가 많은 실행의 영향이 크다.
- macro 인용 활용률은 실행별 인용 활용률의 평균이다. 각 실행의 가중치가 같다.
- `missing_context_selection`, `invalid_writer_output`, `missing_evidence`는 분모에 0으로 넣지 않고 제외 실행으로 보고한다.
- `character_reduction`은 JavaScript 문자열 길이 절감률이다. 제공자가 보고한 입력 토큰 절감률이 아니다.
- 적은 인용 활용률은 비용 낭비의 확정값이 아니라 후속 실험의 가설이다.
