// 자소서 글자수 계산 — 공백 포함/제외 두 기준을 항상 함께 보여준다 (§7, docs/AI-HANDOFF.md §2).
export function countChars(content: string) {
  const withSpaces = content.length;
  const withoutSpaces = content.replace(/\s/g, '').length;
  return { withSpaces, withoutSpaces };
}
