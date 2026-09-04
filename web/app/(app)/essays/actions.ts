'use server';

import { randomUUID } from 'node:crypto';
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

  // pipeline_id를 채우면 러너가 이 잡을 "체인의 시작"으로 인식해, 조사가
  // 끝나는 대로 뮤즈(작성)→렌즈(검수)→콤마(소제목)까지 자동으로 이어서
  // 실행한다(runner/index.mjs). 개별 재실행 버튼(requestWriterDraft 등)은
  // pipeline_id를 채우지 않으므로 그쪽은 여전히 단독 실행으로 끝난다.
  const { error: jobError } = await supabase.from('jobs').insert({
    owner_id: user.id,
    kind: 'company',
    pipeline_id: randomUUID(),
    payload: { essayId, jobPostId, instruction: instruction.trim() },
    harness_snapshot: {},
  });
  if (jobError) throw new Error(jobError.message);
}

// 솔(기업조사) 첨부파일 — DART 공시자료 등. 회사명·JD처럼 텍스트로 붙여넣기
// 힘든 원문 자료를 파일로 올리면, essayId로 연결돼 있어 러너가 조사를 실행할
// 때 함께 읽는다(runner/index.mjs processCompanyJob, context-pack.mjs).
const COMPANY_ATTACHMENT_BUCKET = 'company-research';
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024; // DART 공시자료는 records의 증명서보다 클 수 있다.
const ALLOWED_ATTACHMENT_EXTENSIONS = new Set(['pdf', 'md', 'markdown']);

export async function uploadCompanyAttachment(essayId: string, formData: FormData) {
  const { supabase, user } = await requireUser();
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) throw new Error('파일을 선택하세요.');

  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(`파일이 너무 큽니다. ${Math.round(MAX_ATTACHMENT_BYTES / 1024 / 1024)}MB 이하만 올릴 수 있습니다.`);
  }
  // 마크다운은 브라우저마다 file.type이 제각각(text/markdown · text/plain ·
  // 빈 문자열)이라 MIME이 아니라 확장자로 판별한다.
  const extension = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
  if (!ALLOWED_ATTACHMENT_EXTENSIONS.has(extension)) {
    throw new Error('PDF나 마크다운(.md) 파일만 올릴 수 있습니다.');
  }

  // 경로 첫 칸이 소유자 uid여야 Storage 정책을 통과한다(0024). 파일명은 새로
  // 만든다 — 사용자가 준 이름을 경로에 그대로 쓰지 않아 경로 조작을 막는다.
  const storagePath = `${user.id}/${essayId}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(COMPANY_ATTACHMENT_BUCKET)
    .upload(storagePath, file, { contentType: file.type || 'application/octet-stream', upsert: false });
  if (uploadError) throw new Error(uploadError.message);

  const { error } = await supabase.from('company_research_attachments').insert({
    owner_id: user.id,
    essay_id: essayId,
    file_name: file.name,
    storage_path: storagePath,
    size_bytes: file.size,
  });
  if (error) {
    // 행을 못 남겼으면 파일만 떠도는 상태가 된다. 되돌린다.
    await supabase.storage.from(COMPANY_ATTACHMENT_BUCKET).remove([storagePath]);
    throw new Error(error.message);
  }

  revalidatePath(`/essays/${essayId}`);
}

export async function deleteCompanyAttachment(attachmentId: string, essayId: string) {
  const { supabase } = await requireUser();

  const { data: attachment } = await supabase
    .from('company_research_attachments')
    .select('storage_path')
    .eq('id', attachmentId)
    .maybeSingle();
  if (!attachment) return;

  await supabase.storage.from(COMPANY_ATTACHMENT_BUCKET).remove([attachment.storage_path]);
  const { error } = await supabase.from('company_research_attachments').delete().eq('id', attachmentId);
  if (error) throw new Error(error.message);

  revalidatePath(`/essays/${essayId}`);
}

// 6단계 JD 입력(§10 후반) — 모카가 찾은 채용공고에서 바로 자소서를 시작한다.
// job_id를 미리 연결해 두면 에디터가 열리자마자 solPost의 description이
// 솔 다이얼로그의 JD 칸을 자동으로 채운다(essays/[id]/page.tsx가 이미
// job_id로 job_posts를 조회해 jobPost prop을 채워주고 있었다).
//
// "문항 붙여넣기"(question-import.tsx)로 이 공고에 문항을 여러 개 저장해
// 뒀으면(essay_questions) 그 개수만큼 자소서를 한 번에 만든다 — 예전엔
// 문항이 몇 개든 항상 빈 자소서 1개만 만들어서, 붙여넣은 문항이 실제 작성
// 화면 어디에도 연결되지 않는 문제가 있었다(사용자 실제로 겪음, 2026-09-04).
// 이미 그 문항 텍스트로 만들어 둔 자소서가 있으면 새로 만들지 않는다(같은
// 공고에서 다시 눌러도 중복 생성 안 됨) — 문항 텍스트 자체를 키로 매칭한다,
// essay_projects가 essay_questions를 참조하는 FK를 아직 두지 않았으므로.
// 문항이 하나도 없으면(아직 안 붙여넣었으면) 예전처럼 빈 자소서 1개만 만든다.
export async function startEssayForJobPost(jobPostId: string) {
  const { supabase, user } = await requireUser();

  const { data: jobPost, error: jobPostError } = await supabase
    .from('job_posts')
    .select('company, role')
    .eq('id', jobPostId)
    .single();
  if (jobPostError || !jobPost) throw new Error(jobPostError?.message ?? '채용공고를 찾을 수 없습니다');

  const { data: questions } = await supabase
    .from('essay_questions')
    .select('question, char_limit')
    .eq('job_post_id', jobPostId)
    .order('order_no', { ascending: true });

  const { data: existingEssays } = await supabase
    .from('essay_projects')
    .select('id, question')
    .eq('job_id', jobPostId)
    .order('updated_at', { ascending: false });

  if (!questions?.length) {
    if (existingEssays?.[0]) redirect(`/essays/${existingEssays[0].id}`);
    const { data: essay, error } = await supabase
      .from('essay_projects')
      .insert({ owner_id: user.id, title: `${jobPost.company} · ${jobPost.role}`, job_id: jobPostId })
      .select('id')
      .single();
    if (error || !essay) throw new Error(error?.message ?? '자소서 생성 실패');
    redirect(`/essays/${essay.id}`);
  }

  const existingByQuestion = new Map((existingEssays ?? []).map((e) => [e.question, e.id]));
  let firstEssayId: string | null = null;

  for (const [index, q] of questions.entries()) {
    const already = existingByQuestion.get(q.question);
    if (already) {
      firstEssayId ??= already;
      continue;
    }
    const { data: essay, error } = await supabase
      .from('essay_projects')
      .insert({
        owner_id: user.id,
        title: `${jobPost.company} · ${jobPost.role} · 문항 ${index + 1}`,
        job_id: jobPostId,
        question: q.question,
        ...(q.char_limit ? { target_chars: q.char_limit } : {}),
      })
      .select('id')
      .single();
    if (error || !essay) throw new Error(error?.message ?? '자소서 생성 실패');
    firstEssayId ??= essay.id;
  }

  redirect(`/essays/${firstEssayId}`);
}

// 같은 공고의 모든 문항에 대해 한 번에 초안 생성을 요청한다(사용자 요청
// 2026-09-04, "처음 초안은 한 번에 모든 문항에 대해서 작성"). requestWriterDraft
// 하나를 여러 essay에 반복하는 것과 같다 — 러너가 CONCURRENT_RUN_LIMIT=1로
// 어차피 순차 처리하므로 한꺼번에 큐에 넣어도 안전하다.
export async function requestAllDrafts(jobPostId: string) {
  const { supabase, user } = await requireUser();

  const { data: essays } = await supabase.from('essay_projects').select('id').eq('job_id', jobPostId);
  if (!essays?.length) return;

  const { error } = await supabase.from('jobs').insert(
    essays.map((essay) => ({
      owner_id: user.id,
      kind: 'writer',
      payload: { essayId: essay.id },
      harness_snapshot: {},
    })),
  );
  if (error) throw new Error(error.message);
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
