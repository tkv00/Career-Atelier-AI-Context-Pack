// 노바(일정) — §11. 대부분의 경우 LLM을 안 쓴다: 마감일 정규화는 결정론적
// 파싱으로 처리하고, 실패하면 needs_review로 남긴다(LLM 폴백은 아직 미구현 —
// 이 정도 커버리지로도 §16 완료판정을 통과한다). 모카가 job_posts를 저장할
// 때마다 바로 이어서 호출된다(§12 "모카 완료 시 자동 연쇄").

const MONTH_DAY_RE = /(\d{1,2})\s*월\s*(\d{1,2})\s*일/;
const SLASH_RE = /(\d{1,2})\/(\d{1,2})(?!\d)/;
const ISO_RE = /(\d{4})-(\d{2})-(\d{2})/;
const D_MINUS_RE = /D-(\d+)/i;
// "상시채용"류 — 마감일이 아예 없는 채용이다. 날짜가 아니므로 파싱을
// 시도하거나 LLM으로 추측하지 않는다(사용자 결정: 상시채용은 조사하지
// 않는다) — 그냥 일정에서 빼 버린다.
const ROLLING_HIRE_RE = /상시\s*채용|수시\s*채용|채용\s*시\s*(까지|마감)|충원\s*시\s*(까지|마감)/;

function endOfDayKst(year, month, day) {
  return new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T23:59:59+09:00`);
}

// §11 1단계 — "2026-09-15", "9월 15일", "9/15(월) 18:00", "D-7" → 확정.
// "상시채용" 등 못 알아듣는 표기는 null(needs_review로 이어짐).
export function parseKoreanDeadline(text, now = new Date()) {
  if (!text) return null;

  let m = text.match(ISO_RE);
  if (m) return endOfDayKst(Number(m[1]), Number(m[2]), Number(m[3]));

  m = text.match(D_MINUS_RE);
  if (m) {
    const result = new Date(now);
    result.setDate(result.getDate() + Number(m[1]));
    return result;
  }

  m = text.match(MONTH_DAY_RE);
  if (m) {
    const month = Number(m[1]);
    const day = Number(m[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      let candidate = endOfDayKst(now.getFullYear(), month, day);
      if (candidate < now) candidate = endOfDayKst(now.getFullYear() + 1, month, day);
      return candidate;
    }
  }

  m = text.match(SLASH_RE);
  if (m) {
    const month = Number(m[1]);
    const day = Number(m[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      let candidate = endOfDayKst(now.getFullYear(), month, day);
      if (candidate < now) candidate = endOfDayKst(now.getFullYear() + 1, month, day);
      return candidate;
    }
  }

  return null;
}

export function isRollingHire(text) {
  return Boolean(text) && ROLLING_HIRE_RE.test(text);
}

// job_posts 한 건에 대해 calendar_events를 만들거나 갱신한다. rawDeadlineText는
// 모카가 애초에 반환한 원문(job_posts.deadline 검증 전 값) — 없으면 description도
// 시도한다.
export async function syncCalendarEvent(supabase, ownerId, jobPost, rawDeadlineText) {
  // 명시된 마감일 텍스트가 없으면 설명에서 날짜 패턴을 "찾아보기"는 하되,
  // 못 찾았을 때 설명 전문을 raw_deadline_text로 저장하지는 않는다 — 그건
  // 마감일 원문이 아니라 그냥 직무 설명이라 "확인 필요" 배지 옆에 뜨면
  // 오해를 준다.
  const explicitText = String(rawDeadlineText ?? '').trim();

  const { data: existing } = await supabase
    .from('calendar_events')
    .select('id')
    .eq('job_post_id', jobPost.id)
    .maybeSingle();

  // 상시채용은 마감일이 없는 채용이다 — 날짜를 지어내거나 "확인 필요"로
  // 애매하게 남기지 않고 아예 일정에서 뺀다(사용자 결정). 예전엔 날짜가
  // 있다가 나중에 상시채용으로 바뀐 경우를 대비해 기존 이벤트가 있으면
  // 지운다.
  if (isRollingHire(explicitText) || isRollingHire(jobPost.description ?? '')) {
    if (existing) await supabase.from('calendar_events').delete().eq('id', existing.id);
    return { confidence: 'rolling_hire', startsAt: null };
  }

  const parsed = parseKoreanDeadline(explicitText) ?? parseKoreanDeadline(jobPost.description ?? '');
  const confirmed = Boolean(parsed);
  const startsAt = confirmed ? parsed : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  const payload = {
    owner_id: ownerId,
    job_post_id: jobPost.id,
    title: `${jobPost.company} · ${jobPost.role}`,
    company: jobPost.company,
    event_type: 'deadline',
    starts_at: startsAt.toISOString(),
    all_day: true,
    source_url: jobPost.url || null,
    confidence: confirmed ? 'confirmed' : 'needs_review',
    raw_deadline_text: explicitText ? explicitText.slice(0, 200) : null,
  };

  if (existing) {
    await supabase.from('calendar_events').update(payload).eq('id', existing.id);
  } else {
    await supabase.from('calendar_events').insert(payload);
  }

  return { confidence: payload.confidence, startsAt };
}
