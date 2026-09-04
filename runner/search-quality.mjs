// 최신성 조사 결과는 JSON 스키마 통과만으로 충분하지 않다. 빈 배열이나 빈
// 문자열도 스키마상 유효하고, URL처럼 보이는 문자열도 실제 저장 단계에서
// 탈락할 수 있으므로 DB에 쓰기 전에 최소 품질을 순수 코드로 판정한다.

export function parseResultArray(output, key) {
  let parsed;
  try {
    parsed = JSON.parse(output);
  } catch {
    // 복구 재시도는 --output-schema를 제거하므로 일부 CLI 버전이 JSON을
    // Markdown 코드 블록으로 감쌀 수 있다. 첫 실행의 엄격한 JSON 경로는
    // 유지하면서 이 한 가지 흔한 포장만 벗겨 다시 읽는다.
    const fenced = String(output).match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
    if (!fenced) return { error: '구조화 결과를 JSON으로 읽지 못했습니다.', parsed: null, items: [] };
    try {
      parsed = JSON.parse(fenced.trim());
    } catch {
      return { error: '구조화 결과를 JSON으로 읽지 못했습니다.', parsed: null, items: [] };
    }
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed[key])) {
    return { error: `구조화 결과에 ${key} 배열이 없습니다.`, parsed, items: [] };
  }
  return { error: '', parsed, items: parsed[key] };
}

export function normalizeHttpUrl(value) {
  try {
    const url = new URL(String(value));
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function normalizeNewsItems(items, limit = 5) {
  const normalized = [];
  const seenUrls = new Set();
  for (const item of items) {
    const title = String(item?.title ?? '').trim();
    const source = String(item?.source ?? '').trim();
    const url = normalizeHttpUrl(item?.url);
    if (!title || !source || !url || seenUrls.has(url)) continue;
    seenUrls.add(url);
    normalized.push({
      title,
      source,
      url,
      date: String(item?.date ?? '').trim(),
      implication: String(item?.implication ?? '').trim(),
    });
    if (normalized.length >= limit) break;
  }
  return normalized;
}

export function normalizeJobCandidates(items, limit = 30) {
  const normalized = [];
  const seenUrls = new Set();
  for (const item of items) {
    const company = String(item?.company ?? '').trim();
    const role = String(item?.role ?? '').trim();
    const url = normalizeHttpUrl(item?.url);
    if (!company || !role || !url || seenUrls.has(url)) continue;
    seenUrls.add(url);
    normalized.push({ ...item, company, role, url });
    if (normalized.length >= limit) break;
  }
  return normalized;
}

export function searchQualityError({ provider, webSearchUsed, validCount, subject }) {
  if (provider === 'codex' && !webSearchUsed) {
    return `Codex가 ${subject} 전에 실제 웹 검색 도구를 호출하지 않았습니다.`;
  }
  if (validCount === 0) return `저장 가능한 ${subject} 결과가 0건입니다.`;
  return '';
}

export function nextSearchRetryAttempt(payload) {
  const attempt = Number(payload?.searchRetryAttempt) || (payload?.retried ? 1 : 0);
  return attempt >= 1 ? null : attempt + 1;
}

export function isSearchRecoveryAttempt(payload) {
  return Number(payload?.searchRetryAttempt) >= 1 || payload?.retried === true;
}
