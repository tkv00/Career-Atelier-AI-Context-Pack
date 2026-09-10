'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function addEssayQuestion(essayId: string, question: string, targetChars: number) {
  if (!question.trim() || question.length > 10000 || !Number.isInteger(targetChars) || targetChars < 0 || targetChars > 100000) {
    throw new Error('문항 내용과 글자 수를 확인해 주세요.');
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('로그인이 필요합니다.');
  const { data: source, error: sourceError } = await supabase.from('essay_projects')
    .select('job_id').eq('id', essayId).eq('owner_id', user.id).single();
  if (sourceError || !source?.job_id) throw new Error('채용공고에 연결된 자기소개서에서 문항을 추가해 주세요.');
  // 문항마다 본문과 수정 이력을 독립적으로 보관하도록 새 작성 문서를 만든다.
  const { data, error } = await supabase.from('essay_projects').insert({
    owner_id: user.id, job_id: source.job_id, question: question.trim(),
    title: question.trim().slice(0, 100), target_chars: targetChars,
  }).select('id').single();
  if (error || !data) throw new Error(error?.message ?? '문항을 추가하지 못했습니다.');
  revalidatePath('/dashboard');
  revalidatePath('/essays/[id]', 'page');
  return data.id;
}
