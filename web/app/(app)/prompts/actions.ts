'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { EFFORT_OPTIONS, isProvider } from '@/lib/agent-providers';

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { supabase, user };
}

// v1의 Prompt Lab을 v2로 이식 — 승무원(에이전트)의 시스템 프롬프트를 직접
// 고쳐 쓸 수 있게 한다. 저장 전에 현재 본문을 prompt_versions에 스냅샷으로
// 남긴 뒤 prompt_templates를 갱신한다 — "새 버전 저장"이 실제로 버전을
// 남기게 하기 위해서다(v1은 body만 덮어썼을 뿐 이력이 없었다).
export async function savePromptVersion(templateId: string, body: string) {
  const trimmed = body.trim();
  if (!trimmed) throw new Error('프롬프트 본문을 비울 수 없습니다.');

  const { supabase, user } = await requireUser();

  const { data: current, error: fetchError } = await supabase
    .from('prompt_templates')
    .select('body, version')
    .eq('id', templateId)
    .single();
  if (fetchError || !current) throw new Error(fetchError?.message ?? '프롬프트를 찾을 수 없습니다.');

  if (current.body === trimmed) return; // 변경 없으면 버전을 만들지 않는다.

  const { error: versionError } = await supabase.from('prompt_versions').insert({
    owner_id: user.id,
    template_id: templateId,
    body: current.body,
    version: current.version,
  });
  if (versionError) throw new Error(versionError.message);

  const { error: updateError } = await supabase
    .from('prompt_templates')
    .update({ body: trimmed, version: current.version + 1, updated_at: new Date().toISOString() })
    .eq('id', templateId);
  if (updateError) throw new Error(updateError.message);

  revalidatePath('/prompts');
}

// 실수로 고친 걸 되돌릴 수 있어야 진짜로 "안전하게 실험"할 수 있다.
export async function restorePromptVersion(templateId: string, versionId: string) {
  const { supabase } = await requireUser();

  const { data: target, error: fetchError } = await supabase
    .from('prompt_versions')
    .select('body')
    .eq('id', versionId)
    .eq('template_id', templateId)
    .single();
  if (fetchError || !target) throw new Error(fetchError?.message ?? '되돌릴 버전을 찾을 수 없습니다.');

  await savePromptVersion(templateId, target.body);
}

// 비서가 어떤 LLM으로 돌지 고른다(요청 2026-09-02).
//
// 프롬프트 본문과 달리 버전을 남기지 않는다 — 되돌릴 만한 이력이라기보다
// "지금 어느 구독을 쓸지"에 가까운 설정이라, 이력을 쌓으면 버전 목록이
// 프롬프트 변경과 섞여 읽기 어려워진다.
export async function setAgentProvider(templateId: string, provider: string) {
  if (!isProvider(provider)) {
    throw new Error('지원하지 않는 LLM입니다.');
  }

  const { supabase } = await requireUser();

  // 모델명·사용량은 CLI마다 표기가 다르다(agent-providers.ts) — LLM을
  // 바꾸면서 이전 값을 그대로 두면, 예를 들어 provider=codex인데
  // model=claude-opus-5가 남아 다음 실행이 codex CLI에 `-m claude-opus-5`를
  // 그대로 넘겨 깨진다. LLM을 바꿀 때마다 함께 비운다.
  const { error } = await supabase
    .from('prompt_templates')
    .update({ provider, model: '', effort: '' })
    .eq('id', templateId);
  if (error) throw new Error(error.message);

  revalidatePath('/prompts');
}

// 비서가 쓸 구체적인 모델(요청 2026-09-05) — 같은 Claude 안에서도
// Opus/Sonnet/Haiku 중 뭘 쓸지 등. 직접 입력이라 값 자체는 검증하지 않는다
// (CLI 버전마다 유효한 이름이 달라 여기서 화이트리스트를 걸면 새 모델이
// 나올 때마다 이 코드를 고쳐야 한다). 빈 문자열은 "CLI 기본값 사용".
export async function setAgentModel(templateId: string, model: string) {
  const trimmed = model.trim();
  if (trimmed.length > 200) throw new Error('모델 이름이 너무 깁니다.');

  const { supabase } = await requireUser();

  const { error } = await supabase
    .from('prompt_templates')
    .update({ model: trimmed })
    .eq('id', templateId);
  if (error) throw new Error(error.message);

  revalidatePath('/prompts');
}

// 비서의 추론 사용량(effort) — 프로바이더별 유효값이 다르므로 저장 전에
// 지금 이 비서의 provider를 다시 읽어 그 provider가 아는 값인지 확인한다.
export async function setAgentEffort(templateId: string, effort: string) {
  const { supabase } = await requireUser();

  const { data: current, error: fetchError } = await supabase
    .from('prompt_templates')
    .select('provider')
    .eq('id', templateId)
    .single();
  if (fetchError || !current) throw new Error(fetchError?.message ?? '프롬프트를 찾을 수 없습니다.');

  const provider = isProvider(current.provider) ? current.provider : 'codex';
  const trimmed = effort.trim();
  const known = trimmed === '' || EFFORT_OPTIONS[provider].some((option) => option.value === trimmed);
  if (!known) throw new Error('이 LLM에서 지원하지 않는 사용량입니다.');

  const { error } = await supabase
    .from('prompt_templates')
    .update({ effort: trimmed })
    .eq('id', templateId);
  if (error) throw new Error(error.message);

  revalidatePath('/prompts');
}
