'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

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
