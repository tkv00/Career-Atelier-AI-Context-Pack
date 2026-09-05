// 직접 입력한 #태그와 선택한 태그가 같은 행성으로 연결되도록 표기를 통일한다.
export function normalizeExperienceTag(value: string): string {
  return value.normalize('NFKC').trim().replace(/^#+\s*/, '').trim();
}

export function experienceTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((tag): tag is string => typeof tag === 'string')
    .map(normalizeExperienceTag).filter(Boolean))];
}
