'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type InterviewQuestionInput = {
  id?: string;
  job_post_id: string | null;
  category: 'experience' | 'personality' | 'company';
  question: string;
  answer_markdown: string;
  source?: 'manual' | 'agent' | 'starter';
  order_no?: number;
};

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { supabase, user };
}

export async function saveInterviewQuestion(input: InterviewQuestionInput) {
  const { supabase, user } = await requireUser();
  const question = input.question.trim();
  if (!question) throw new Error('면접 질문을 입력해 주세요.');

  const jobPostId = input.job_post_id || null;
  const category = jobPostId ? 'company' : input.category === 'personality' ? 'personality' : 'experience';
  if (jobPostId) {
    const { data: job } = await supabase.from('job_posts').select('id').eq('id', jobPostId).maybeSingle();
    if (!job) throw new Error('연결할 채용공고를 찾지 못했습니다.');
  }

  let orderNo = input.order_no;
  if (orderNo == null) {
    let query = supabase.from('interview_questions').select('order_no').eq('category', category).order('order_no', { ascending: false }).limit(1);
    query = jobPostId ? query.eq('job_post_id', jobPostId) : query.is('job_post_id', null);
    const { data: current } = await query;
    orderNo = (current?.[0]?.order_no ?? 0) + 10;
  }

  const payload = {
    owner_id: user.id,
    job_post_id: jobPostId,
    category,
    question,
    answer_markdown: input.answer_markdown,
    source: input.source || 'manual',
    order_no: orderNo,
    updated_at: new Date().toISOString(),
  };

  const { error } = input.id
    ? await supabase.from('interview_questions').update(payload).eq('id', input.id)
    : await supabase.from('interview_questions').insert(payload);
  if (error) throw new Error(error.message);
  revalidatePath('/interviews');
}

export async function deleteInterviewQuestion(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('interview_questions').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/interviews');
}

export async function requestInterviewQuestions(jobPostId: string) {
  const { supabase, user } = await requireUser();
  const { data: job } = await supabase.from('job_posts').select('id').eq('id', jobPostId).maybeSingle();
  if (!job) throw new Error('면접 준비에 연결할 채용공고를 찾지 못했습니다.');

  const { data: pending } = await supabase.from('jobs').select('id, payload').eq('kind', 'interview').in('status', ['queued', 'running']);
  const alreadyPending = (pending ?? []).some((item) => {
    const payload = item.payload as { jobPostId?: string } | null;
    return payload?.jobPostId === jobPostId;
  });
  if (alreadyPending) return;

  const { error } = await supabase.from('jobs').insert({
    owner_id: user.id,
    kind: 'interview',
    payload: { jobPostId },
    harness_snapshot: { evidenceRequired: true, answerFormat: 'markdown' },
    priority: 5,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/interviews');
  revalidatePath('/dashboard');
}
