// 비서마다 "반드시 지켜야 하는 규칙"을 prompt_templates.body(사용자가 프롬프트
// 랩에서 고치는 부분)와 분리해 여기 고정한다(요청 2026-09-06).
//
// 계기: 뮤즈의 evidence[].experience_id 규칙("반드시 context/04-experiences.md의
// [id: ...] 값을 그대로 씁니다")이 body 안에 있었다. 이 문장이 없으면 §14
// 3겹(index.mjs processWriterJob의 사후 대조)이 항상 실패한다 — LLM이 근거
// ID를 지어내기 시작하기 때문이다. 사용자가 프롬프트를 실험하다 이 줄을
// 실수로 지우거나 순화하면, 겉으로는 잘 도는 것처럼 보이다가 근거 검증만
// 조용히 깨진다.
//
// 여기 넣는 기준은 하나뿐이다 — "이 문장이 없으면 러너나 DB 코드의 검증이
// 깨지는가?" 그렇다인 것만 옮긴다. 페르소나·조사 절차·문체 같은 "이 비서가
// 어떻게 일하는가"는 여전히 prompt_templates.body다: 사용자가 자유롭게
// 고치고, 프롬프트 랩(web)에 그대로 보인다.
//
// 이 파일은 runner에만 존재한다 — web/ 번들에 포함되지 않고, DB에도 저장되지
// 않으므로 프롬프트 랩 화면 어디에도 나타나지 않는다.
//
// 처음 이 파일을 만들 때(2026-09-06) 0023의 원본 시드 텍스트만 기준으로
// 옮길 규칙을 골랐는데, 그 뒤 0025가 루미·모카 본문에 "웹 검색 도구를
// 반드시 호출하라"는 규칙을 이미 추가해 둔 걸 놓쳤다 — search-quality.mjs의
// searchQualityError()가 이 규칙이 실제로 지켜졌는지(webSearchUsed)를
// 코드로 검사하므로 똑같이 시스템 기준에 들어맞는데도 빠뜨린 것이다.
// 사용자가 지적해 0029에서 마저 옮겼다(§ 교훈: 원본 시드가 아니라 "지금
// 실제로 DB에 있는 본문"을 기준으로 확인해야 한다).

const SCHEMA_COMPLIANCE =
  '출력은 주어진 JSON 스키마를 정확히 따릅니다. 스키마에 없는 필드를 추가하거나 필수 필드를 비우지 않습니다.';

export const SYSTEM_RULES = {
  review: SCHEMA_COMPLIANCE,

  // §14 3겹(사후 대조)이 검증하는 값 그 자체를 만드는 규칙이라 가장 중요하다.
  writer: [
    '근거(evidence) 규칙 — 반드시 지킵니다:',
    '- 초안에서 구체적 사실(회사명, 수치, 성과, 기간 등)을 쓸 때마다, 그 문장이 어느 경험 카드에서 나왔는지 evidence 배열에 기록합니다.',
    '- evidence[].experience_id는 반드시 context/04-experiences.md의 "[id: ...]" 값을 그대로 씁니다. 지어낸 id를 쓰지 않습니다.',
    '- 경험 카드에 없는 사실은 애초에 초안에 넣지 않습니다.',
    SCHEMA_COMPLIANCE,
  ].join('\n'),

  // "웹 검색을 반드시 호출하라"는 search-quality.mjs의 searchQualityError()가
  // provider==='codex'일 때 webSearchUsed를 코드로 검사한다 — 이 문장이
  // 없으면 계획만 말하고 끝내는 실행이 통과 못 하고 계속 재시도만 반복한다.
  // Codex 발견 단계 자체는 buildNewsDiscoveryPrompt()가 이미 같은 지시를
  // 코드로 박아 두지만(search-quality.mjs), Claude/Gemini로 바꾸면 body가
  // 유일한 경로라 여기 없으면 그 provider들은 이 규칙을 아예 못 받는다.
  news: [
    '최종 답변 전에 실제 웹 검색 도구를 반드시 한 번 이상 호출합니다. "검색하겠습니다"라고 계획만 말한 뒤 검색 없이 결과를 마무리하지 않습니다 — 첫 검색에서 원하는 결과를 못 찾으면 검색어를 바꿔 다시 시도합니다.',
    '확인되지 않는 URL이나 날짜는 지어내지 않습니다 — 검색 결과에 없으면 항목에서 뺍니다.',
    SCHEMA_COMPLIANCE,
  ].join('\n'),

  company: [
    '확인되지 않는 사실은 지어내지 않습니다 — 검색으로 확인하지 못하면 넣지 않습니다.',
    SCHEMA_COMPLIANCE,
  ].join('\n'),

  // 마감일 형식은 processJobSearchJob이 정규식으로 그대로 검사한다 — 형식이
  // 어긋나면 코드가 null로 떨어뜨리므로 깨지진 않지만, 프롬프트가 형식을
  // 안 알려주면 항상 null이 되어 캘린더에 마감일이 하나도 안 뜬다.
  jobs: [
    '최종 답변 전에 실제 웹 검색 도구를 반드시 한 번 이상 호출합니다. "검색하겠습니다"라고 계획만 말한 뒤 검색 없이 빈 결과로 마무리하지 않습니다 — 첫 검색에서 원하는 결과를 못 찾으면 검색어를 바꿔 다시 시도합니다.',
    '확인되지 않는 URL이나 지어낸 공고는 절대 포함하지 않습니다.',
    '마감일(deadline)은 반드시 YYYY-MM-DD 형식으로만 쓰고, "상시채용"·"채용 시 마감"처럼 날짜가 아니면 null로 둡니다.',
    SCHEMA_COMPLIANCE,
  ].join('\n'),

  subtitle: [
    '본문에 실제로 없는 사실·수치·표현을 소제목에 새로 만들어 넣지 않습니다 — 소제목은 본문의 압축이지 새로운 주장이 아닙니다.',
    SCHEMA_COMPLIANCE,
  ].join('\n'),

  interview: [
    '경험 카드에 없는 회사명, 수치, 행동을 만들지 않습니다. 답할 근거가 부족하면 "[내 경험 입력 필요]"라고 명확히 표시합니다.',
    SCHEMA_COMPLIANCE,
  ].join('\n'),
};

/** 알 수 없는 agent_id가 와도(예: 아직 4단계에서 구체화하지 않은 범용
    경로) 빈 문자열로 떨어뜨려 프롬프트에 "undefined"가 섞이지 않게 한다. */
export function systemRulesFor(agentId) {
  return SYSTEM_RULES[agentId] ?? '';
}
