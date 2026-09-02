// 솔(기업 조사)이 돌려주는 구조화 JSON을 다루는 공용 로직. essays 편집기의
// 미리보기·MD 다운로드·PDF 다운로드가 전부 같은 마크다운 문자열을 기준으로
// 삼도록 여기에 모아 둔다 — 세 곳이 각자 포맷을 만들면 미묘하게 어긋난다.

export type CompanyFact = { claim: string; source_url: string };
export type CompanyResult = {
  summary: string;
  facts: CompanyFact[];
  role_requirements: string[];
  writing_material: string[];
};

export function isCompanyResult(value: unknown): value is CompanyResult {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record.summary === 'string' && Array.isArray(record.facts);
}

// 다운로드 파일명에 그대로 쓰이므로 OS가 싫어하는 문자를 미리 걷어낸다.
export function sanitizeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim() || 'company-research';
}

export function companyResearchToMarkdown(
  parsed: CompanyResult,
  meta: { company: string; role: string; createdAt: string; providerLabel: string },
) {
  const lines: string[] = [];
  lines.push(`# ${meta.company}${meta.role ? ` · ${meta.role}` : ''} 기업 조사`);
  lines.push('');
  lines.push(`> ${meta.createdAt} · ${meta.providerLabel}`);
  lines.push('');
  lines.push('## 요약');
  lines.push('');
  lines.push(parsed.summary);

  if (parsed.role_requirements.length > 0) {
    lines.push('');
    lines.push('## 요구 역량');
    lines.push('');
    for (const item of parsed.role_requirements) lines.push(`- ${item}`);
  }

  if (parsed.facts.length > 0) {
    lines.push('');
    lines.push('## 확인된 사실');
    lines.push('');
    for (const fact of parsed.facts) {
      lines.push(fact.source_url ? `- ${fact.claim} ([출처](${fact.source_url}))` : `- ${fact.claim}`);
    }
  }

  if (parsed.writing_material.length > 0) {
    lines.push('');
    lines.push('## 자소서 작성 각도');
    lines.push('');
    for (const item of parsed.writing_material) lines.push(`- ${item}`);
  }

  return lines.join('\n');
}
