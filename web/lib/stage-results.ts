// 전형 단계별 합불 추적. 서류 하나로만 뭉뚱그리던 result_status를
// 단계별로 쪼갠다(사용자 요청, 2026-09-02). job_posts.stage_results는
// { [단계]: '합격' | '불합격' } 형태의 jsonb — 값이 없으면 "대기"다.
export const STAGES = ['서류', '필기시험', '코딩테스트', '기술면접', '최종면접'] as const;
export type Stage = (typeof STAGES)[number];
export type StageStatus = '합격' | '불합격';
export type StageResults = Partial<Record<Stage, StageStatus>>;

export function parseStageResults(value: unknown): StageResults {
  if (!value || typeof value !== 'object') return {};
  const result: StageResults = {};
  for (const stage of STAGES) {
    const v = (value as Record<string, unknown>)[stage];
    if (v === '합격' || v === '불합격') result[stage] = v;
  }
  return result;
}

// 캘린더 칩·현황판 색상(progressTone)이 이미 result_status의 ".includes('합격')"
// 또는 "==='불합격'"만 검사하므로, 여기서 만든 문자열을 result_status에
// 그대로 써도 기존 로직을 하나도 안 고치고 그대로 통한다.
export function deriveResultStatus(stages: StageResults): string {
  if (Object.values(stages).some((status) => status === '불합격')) return '불합격';
  for (const stage of [...STAGES].reverse()) {
    if (stages[stage] === '합격') return `${stage} 합격`;
  }
  return '아직';
}

export function nextStageStatus(current: StageStatus | undefined): StageStatus | undefined {
  if (current === undefined) return '합격';
  if (current === '합격') return '불합격';
  return undefined; // 불합격 다음은 다시 대기로 순환한다.
}
