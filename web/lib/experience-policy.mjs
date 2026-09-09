export const EXPERIENCE_POLICY_VERSION = 'experience-metadata-v1';
export const MAX_EXPERIENCE_TAGS = 3;
export const EXPERIENCE_COMPETENCIES = [
  '문제해결', '의사소통', '협업', '리더십', '자기개발', '자원관리',
  '정보분석', '기술활용', '조직이해', '직업윤리', '고객중심', '갈등관리',
];

// 제목을 잘라 저장하면 문장이 다시 제목이 된다. 정리가 필요한 입력은 저장 전에 돌려보낸다.
export function assertExperienceTitle(title) {
  if (typeof title !== 'string' || !title.trim() || [...title].length > 40 ||
      /[\r\n\u2028\u2029]|^\s*(?:[-*#•]|\d+[.)]|제목\s*[:：])|[.!?。]$|(?:했다|하였다|했습니다|있었다|이었다|였다|한다|이다|있다)$/.test(title.trim())) {
    throw new Error('경험 제목은 목록 기호 없이 공백 포함 40자 이내의 한 줄 요약으로 입력하세요.');
  }
}

export function assertExperienceMetadata(title, tags) {
  assertExperienceTitle(title);
  if (!Array.isArray(tags) || tags.length > MAX_EXPERIENCE_TAGS || new Set(tags).size !== tags.length ||
      tags.some(tag => !EXPERIENCE_COMPETENCIES.includes(tag))) {
    throw new Error('경험 역량은 지정된 12개 항목에서 최대 3개만 선택하세요.');
  }
}
