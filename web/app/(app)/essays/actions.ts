'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { countChars } from '@/lib/chars';

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { supabase, user };
}

export async function createEssay(formData: FormData) {
  const title = ((formData.get('title') as string) || '').trim() || '제목 없는 자소서';
  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from('essay_projects')
    .insert({ owner_id: user.id, title })
    .select('id')
    .single();

  if (error || !data) throw new Error(error?.message ?? '자소서 생성 실패');
  redirect(`/essays/${data.id}`);
}

export type SaveDraftResult =
  | { ok: true; revision: number; updatedAt: string }
  | { ok: false; conflict: { serverDraft: string; serverRevision: number; serverUpdatedAt: string } };

// §7 낙관적 잠금. revision이 기대값과 다르면 0행이 반환되고, 그걸 충돌로 간주해
// 서버의 현재 상태를 함께 돌려준다 — 조용한 덮어쓰기는 절대 하지 않는다.
export async function saveDraft(essayId: string, content: string, expectedRevision: number): Promise<SaveDraftResult> {
  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from('essay_projects')
    .update({ draft: content, revision: expectedRevision + 1, updated_at: new Date().toISOString() })
    .eq('id', essayId)
    .eq('revision', expectedRevision)
    .select('revision, updated_at')
    .maybeSingle();

  if (error) throw new Error(error.message);

  if (!data) {
    const { data: server, error: fetchError } = await supabase
      .from('essay_projects')
      .select('draft, revision, updated_at')
      .eq('id', essayId)
      .single();
    if (fetchError || !server) throw new Error(fetchError?.message ?? '충돌 확인 실패');
    return {
      ok: false,
      conflict: { serverDraft: server.draft, serverRevision: server.revision, serverUpdatedAt: server.updated_at },
    };
  }

  return { ok: true, revision: data.revision, updatedAt: data.updated_at };
}

// 충돌 해결 후 "이긴 쪽" 내용을 강제 반영한다. knownRevision은 방금 조회한 서버
// 최신값이라 정상적으로는 성공한다 — 그 사이 세 번째 기기가 또 끼어들면 다시
// 충돌로 떨어지고, 호출자는 saveDraft와 동일한 결과 형태를 받는다.
export async function forceSaveDraft(essayId: string, content: string, knownRevision: number): Promise<SaveDraftResult> {
  return saveDraft(essayId, content, knownRevision);
}

// §7 "버려지는 쪽은 essay_autosaves에 보존한다" — 충돌 해결의 세 갈래(내 것 유지 /
// 상대 것 가져오기 / 수동 병합) 모두 여기서 discarded 콘텐츠를 저장한다.
export async function snapshotDraft(essayId: string, content: string, deviceName: string) {
  const { supabase, user } = await requireUser();
  const { withSpaces, withoutSpaces } = countChars(content);

  const { error } = await supabase.from('essay_autosaves').insert({
    owner_id: user.id,
    essay_id: essayId,
    content,
    chars_with_spaces: withSpaces,
    chars_without_spaces: withoutSpaces,
    device_name: deviceName,
  });
  if (error) throw new Error(error.message);

  // 롤링 50개 유지 (§7) — 51번째부터 삭제.
  const { data: stale } = await supabase
    .from('essay_autosaves')
    .select('id')
    .eq('essay_id', essayId)
    .order('created_at', { ascending: false })
    .range(50, 500);

  if (stale && stale.length > 0) {
    await supabase.from('essay_autosaves').delete().in('id', stale.map((row) => row.id));
  }
}

// 4단계 첫 수직 슬라이스(렌즈/검수) — 잡 큐에 넣기만 한다. 실행은 러너가 한다.
// 마지막으로 클라우드에 저장된 draft를 검수 대상으로 삼는다(에디터의 아직
// 저장 안 된 변경사항은 포함되지 않음 — 자동저장 주기 안에서는 큰 차이 없음).
export async function requestReview(essayId: string) {
  const { supabase, user } = await requireUser();

  const { error } = await supabase.from('jobs').insert({
    owner_id: user.id,
    kind: 'review',
    payload: { essayId },
    harness_snapshot: {},
  });
  if (error) throw new Error(error.message);
}

// 4단계 두 번째 수직 슬라이스(뮤즈/작성).
export async function requestWriterDraft(essayId: string) {
  const { supabase, user } = await requireUser();

  const { error } = await supabase.from('jobs').insert({
    owner_id: user.id,
    kind: 'writer',
    payload: { essayId },
    harness_snapshot: {},
  });
  if (error) throw new Error(error.message);
}

// 대화형 수정(요청 2026-09-02) — "2문단을 더 구체적으로" 같은 지시를 받아
// 지금 본문을 고친다. 백지에서 다시 쓰는 requestWriterDraft와 같은 잡 종류를
// 쓰되, 요청을 먼저 남겨 두면 러너가 수정 모드로 돈다.
//
// currentDraft를 함께 보내는 이유: 사용자가 방금 손으로 고친 내용이 아직
// 저장되지 않았을 수 있다. 화면에 보이는 글을 기준으로 고쳐야 말이 된다.
export async function requestEssayRevision(essayId: string, instruction: string, currentDraft: string) {
  const trimmed = instruction.trim();
  if (!trimmed) throw new Error('어떻게 고칠지 적어 주세요.');
  if (!currentDraft.trim()) throw new Error('고칠 본문이 없습니다. 먼저 초안을 만드세요.');

  const { supabase, user } = await requireUser();

  const { error: requestError } = await supabase.from('essay_revision_requests').insert({
    owner_id: user.id,
    essay_id: essayId,
    instruction: trimmed,
    base_draft: currentDraft,
  });
  if (requestError) throw new Error(requestError.message);

  const { error } = await supabase.from('jobs').insert({
    owner_id: user.id,
    kind: 'writer',
    payload: { essayId, currentDraft },
    harness_snapshot: {},
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/essays/${essayId}`);
}

// 요청 이력을 지운다. 방향을 완전히 새로 잡고 싶을 때 쓴다 — 이력이 남아 있으면
// 러너가 계속 옛 지시를 함께 반영하려 든다.
export async function clearRevisionRequests(essayId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('essay_revision_requests').delete().eq('essay_id', essayId);
  if (error) throw new Error(error.message);
  revalidatePath(`/essays/${essayId}`);
}

// 4단계 네 번째 수직 슬라이스(솔/기업조사) + 6단계 JD 입력(§10 후반).
// essay가 이미 채용공고에 연결돼 있으면(모카가 찾았거나 이전에 솔을 실행한
// 적 있으면) 그 job_posts 행을 갱신한다 — 매번 새로 insert하면 "다시 요청"할
// 때마다 이전 행이 essay 연결만 잃은 채 고아로 쌓이고, 모카가 채워둔
// url·fit_score 같은 원본 메타데이터도 조용히 버려진다. 새 essay면 그때만
// insert 후 연결한다.
export async function requestCompanyResearch(essayId: string, company: string, role: string, jobDescription: string, instruction: string) {
  const { supabase, user } = await requireUser();

  const { data: essay, error: essayFetchError } = await supabase
    .from('essay_projects')
    .select('job_id')
    .eq('id', essayId)
    .single();
  if (essayFetchError || !essay) throw new Error(essayFetchError?.message ?? '자소서를 찾을 수 없습니다');

  let jobPostId = essay.job_id;
  if (jobPostId) {
    const { error: updateError } = await supabase
      .from('job_posts')
      .update({ company, role, description: jobDescription, updated_at: new Date().toISOString() })
      .eq('id', jobPostId);
    if (updateError) throw new Error(updateError.message);
  } else {
    const { data: jobPost, error: jobPostError } = await supabase
      .from('job_posts')
      .insert({ owner_id: user.id, company, role, description: jobDescription, source: '솔 기업조사 요청' })
      .select('id')
      .single();
    if (jobPostError || !jobPost) throw new Error(jobPostError?.message ?? '채용공고 생성 실패');
    jobPostId = jobPost.id;

    const { error: essayError } = await supabase.from('essay_projects').update({ job_id: jobPostId }).eq('id', essayId);
    if (essayError) throw new Error(essayError.message);
  }

  const { error: jobError } = await supabase.from('jobs').insert({
    owner_id: user.id,
    kind: 'company',
    payload: { essayId, jobPostId, instruction: instruction.trim() },
    harness_snapshot: {},
  });
  if (jobError) throw new Error(jobError.message);
}

// 6단계 JD 입력(§10 후반) — 모카가 찾은 채용공고에서 바로 자소서를 시작한다.
// job_id를 미리 연결해 두면 에디터가 열리자마자 solPost의 description이
// 솔 다이얼로그의 JD 칸을 자동으로 채운다(essays/[id]/page.tsx가 이미
// job_id로 job_posts를 조회해 jobPost prop을 채워주고 있었다).
//
// 이 공고로 이미 쓰던 자소서가 있으면 그리로 보내고, 없을 때만 새로 만든다.
// 예전에는 누를 때마다 무조건 새로 만들어서 같은 공고에 빈 자소서가 계속
// 쌓였다(2026-09-02 수정). 여러 개면 가장 최근 것을 연다.
export async function startEssayForJobPost(jobPostId: string) {
  const { supabase, user } = await requireUser();

  const { data: existing } = await supabase
    .from('essay_projects')
    .select('id')
    .eq('job_id', jobPostId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) redirect(`/essays/${existing.id}`);

  const { data: jobPost, error: jobPostError } = await supabase
    .from('job_posts')
    .select('company, role')
    .eq('id', jobPostId)
    .single();
  if (jobPostError || !jobPost) throw new Error(jobPostError?.message ?? '채용공고를 찾을 수 없습니다');

  const { data: essay, error } = await supabase
    .from('essay_projects')
    .insert({ owner_id: user.id, title: `${jobPost.company} · ${jobPost.role}`, job_id: jobPostId })
    .select('id')
    .single();
  if (error || !essay) throw new Error(error?.message ?? '자소서 생성 실패');

  redirect(`/essays/${essay.id}`);
}

// 6번째 비서(소제목) — Gemini로 실행. 잡 큐에 넣기만 한다. 완성된 본문이
// 있어야 하므로(러너가 없으면 실행을 거부한다) 초안이 비어 있어도 요청
// 자체는 막지 않는다 — 실패 사유를 잡 상태로 보여주는 게 더 정직하다.
export async function requestSubtitle(essayId: string) {
  const { supabase, user } = await requireUser();

  const { error } = await supabase.from('jobs').insert({
    owner_id: user.id,
    kind: 'subtitle',
    payload: { essayId },
    harness_snapshot: {},
  });
  if (error) throw new Error(error.message);
}

// AI가 제안한 소제목을 실제로 essay_projects.subtitle에 반영한다(뮤즈
// 초안의 [반영] 버튼과 같은 원칙 — 자동 반영하지 않고 사용자가 확정한다).
export async function applySubtitle(essayId: string, subtitle: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('essay_projects').update({ subtitle }).eq('id', essayId);
  if (error) throw new Error(error.message);
}

export async function saveQuestionSettings(essayId: string, question: string, targetChars: number) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from('essay_projects')
    .update({ question, target_chars: targetChars, updated_at: new Date().toISOString() })
    .eq('id', essayId);
  if (error) throw new Error(error.message);
}

export async function saveVersion(essayId: string, content: string, note: string) {
  const { supabase, user } = await requireUser();

  const { data: latest } = await supabase
    .from('essay_versions')
    .select('version')
    .eq('essay_id', essayId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (latest?.version ?? 0) + 1;
  const { withSpaces, withoutSpaces } = countChars(content);

  const { error } = await supabase.from('essay_versions').insert({
    owner_id: user.id,
    essay_id: essayId,
    version: nextVersion,
    content,
    chars_with_spaces: withSpaces,
    chars_without_spaces: withoutSpaces,
    note,
  });
  if (error) throw new Error(error.message);
  return nextVersion;
}
