'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { ParsedQuestion } from '@/lib/parse-questions';

// 프로필(목표 직무·관심 분야)이 비어 있으면 루미(뉴스)·모카(채용탐색)가
// 무엇을 찾아야 할지 알 수 없어 매번 빈 결과만 낸다(실제로 겪음, 2026-09-04
// — profiles 행 자체가 없어 두 비서가 계속 빈 배열을 반환했다). v1에서
// 있었던 프로필 편집이 v2엔 아직 없어서, 이 화면 자체가 존재하지 않았다.
// owner_id가 unique(0001)라 upsert로 안전하게 한 번에 처리한다.
export async function saveProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const splitList = (value: FormDataEntryValue | null) =>
    String(value ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

  const { error } = await supabase.from('profiles').upsert(
    {
      owner_id: user.id,
      display_name: String(formData.get('display_name') ?? '').trim() || '사용자',
      target_roles: splitList(formData.get('target_roles')),
      interests: splitList(formData.get('interests')),
      summary: String(formData.get('summary') ?? '').trim(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'owner_id' },
  );
  if (error) throw new Error(error.message);

  revalidatePath('/dashboard');
}

// 4단계 세 번째 수직 슬라이스(루미/뉴스) — 잡 큐에 넣기만 한다. 프로필 기반이라
// essayId가 필요 없다.
export async function requestNewsResearch() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase.from('jobs').insert({
    owner_id: user.id,
    kind: 'news',
    payload: {},
    harness_snapshot: {},
  });
  if (error) throw new Error(error.message);
}

// 4단계 마지막 수직 슬라이스(모카/채용탐색) — 프로필 기반, essayId 불필요.
export async function requestJobSearch() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase.from('jobs').insert({
    owner_id: user.id,
    kind: 'jobs',
    payload: {},
    harness_snapshot: {},
  });
  if (error) throw new Error(error.message);
}

// 6단계 첫 조각(§10) — 붙여넣기 파서 결과 저장. LLM을 쓰지 않으므로 잡 큐를
// 거치지 않고 바로 쓴다. 재붙여넣기는 병합이다: 기존 문항을 지우지 않고
// 현재 최대 order_no 뒤에 이어 붙인다(v1의 비파괴 원칙 계승, §10 UI 명세 규칙 3).
export async function saveParsedQuestions(
  jobPostId: string,
  questions: (Pick<ParsedQuestion, 'question' | 'char_limit' | 'char_min' | 'char_limit_basis'> & { raw: string | null })[],
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  if (questions.length === 0) return;

  const { data: existing } = await supabase
    .from('essay_questions')
    .select('order_no')
    .eq('job_post_id', jobPostId)
    .order('order_no', { ascending: false })
    .limit(1);
  const startAt = (existing?.[0]?.order_no ?? 0) + 1;

  const rows = questions.map((q, i) => ({
    owner_id: user.id,
    job_post_id: jobPostId,
    order_no: startAt + i,
    question: q.question,
    char_limit: q.char_limit,
    char_min: q.char_min,
    char_limit_basis: q.char_limit_basis,
    raw: q.raw,
    source: 'paste_import',
  }));

  const { error } = await supabase.from('essay_questions').insert(rows);
  if (error) throw new Error(error.message);
}
