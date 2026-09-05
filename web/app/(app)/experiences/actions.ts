'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { experienceTags } from '@/lib/experience-tags';

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { supabase, user };
}

function splitList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function saveExperience(formData: FormData) {
  const { supabase, user } = await requireUser();

  const id = (formData.get('id') as string) || undefined;
  const context = (formData.get('context') as string) || '';
  const problem = (formData.get('problem') as string) || '';
  const payload = {
    owner_id: user.id,
    title: ((formData.get('title') as string) || '').trim() || '제목 없는 경험',
    context,
    problem,
    role_scope: (formData.get('role_scope') as string) || '',
    judgment: (formData.get('judgment') as string) || '',
    action: (formData.get('action') as string) || '',
    result: (formData.get('result') as string) || '',
    trial_error: (formData.get('trial_error') as string) || '',
    reflection: (formData.get('reflection') as string) || '',
    situation: context,
    task: problem,
    metrics: splitList((formData.get('metrics') as string) || ''),
    tags: experienceTags(splitList((formData.get('tags') as string) || '')),
    updated_at: new Date().toISOString(),
  };

  const { error } = id
    ? await supabase.from('experience_cards').update(payload).eq('id', id)
    : await supabase.from('experience_cards').insert(payload);

  if (error) throw new Error(error.message);
  revalidatePath('/experiences');
  revalidatePath('/dashboard');
}

export async function deleteExperience(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('experience_cards').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/experiences');
  revalidatePath('/dashboard');
}
