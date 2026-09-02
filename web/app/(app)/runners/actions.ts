'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// 신규 러너는 approved=false로 등록되고, 여기서 승인해야 잡을 집는다 (§6).
export async function approveRunner(runnerId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase.from('runners').update({ approved: true }).eq('id', runnerId);
  if (error) throw new Error(error.message);
  revalidatePath('/dashboard');
}
