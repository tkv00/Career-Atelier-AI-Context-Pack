import { createHash } from 'node:crypto';

// 프로젝트별 DB에서 소유자·날짜로 같은 ID를 사용해 여러 러너의 중복 등록을 막는다.
export async function enqueueDailySearch(supabase, ownerId, runnerId, now = new Date()) {
  if (currentKstHour(now) < TRIGGER_HOUR_KST) return false;
  const { data: runner, error: runnerError } = await supabase.from('runners').select('approved').eq('id', runnerId).maybeSingle();
  if (runnerError) throw runnerError;
  if (!runner?.approved) return false;
  const date = todayKstDateString(now);
  const hash = createHash('sha256').update(`career-atelier:daily-search:${ownerId}:${date}`).digest('hex');
  const id = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
  const { error } = await supabase.from('jobs').insert({ id, owner_id: ownerId, kind: 'jobs', payload: { scheduledDate: date }, harness_snapshot: {} });
  if (error?.code === '23505') return false;
  if (error) throw error;
  return true;
}

// 꺼져 있던 날의 작업은 소급하지 않고, 당일 15시 이후에만 등록한다.
const TRIGGER_HOUR_KST = 15;

function todayKstDateString(now = new Date()) {
  // Asia/Seoul은 DST가 없어 UTC+9 고정 오프셋으로 계산해도 안전하다.
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function currentKstHour(now = new Date()) {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.getUTCHours();
}
