'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// 대시보드와 자소서 편집기가 공유하는 취소 액션. 러너가 꺼져 있으면 잡이
// queued 상태로 무한 대기하는데, 이걸 사용자가 직접 끊어낼 방법이 없었다.
// running(러너가 실제로 처리 중)은 대상에서 뺀다 — DB 상태만 지워도 로컬에서
// 돌고 있는 실제 CLI 프로세스는 멈추지 않아, 취소했다는 표시가 거짓 신호가 된다.
export async function cancelQueuedJob(jobId: string, revalidate: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase.from('jobs').delete().eq('id', jobId).eq('owner_id', user.id).eq('status', 'queued');
  if (error) throw new Error(error.message);

  revalidatePath(revalidate);
}
