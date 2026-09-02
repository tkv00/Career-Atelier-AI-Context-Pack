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

// 로컬 폴더 자동 백업 설정. 실제 파일 쓰기는 러너가 한다 — 브라우저는 임의 폴더에
// 못 쓰기 때문이다. 여기서는 "어디에, 켤지 말지"만 정해 러너 행에 남긴다.
export async function updateRunnerBackup(runnerId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const enabled = formData.get('backupEnabled') === 'on';
  const dir = String(formData.get('backupDir') ?? '').trim();

  if (enabled && !dir) {
    throw new Error('백업을 켜려면 저장할 폴더 경로를 입력하세요.');
  }
  // 상대경로는 러너를 어디서 실행했는지에 따라 엉뚱한 곳에 쌓인다. 러너 쪽에서도
  // 한 번 더 막지만, 사용자가 바로 알 수 있게 여기서 먼저 걸러 준다.
  if (enabled && !(dir.startsWith('/') || dir.startsWith('~') || /^[A-Za-z]:[\\/]/.test(dir))) {
    throw new Error('절대 경로를 입력하세요. 예: ~/career-atelier-backups 또는 C:\\career-atelier-backups');
  }

  const { error } = await supabase
    .from('runners')
    .update({ backup_enabled: enabled, backup_dir: dir || null, last_backup_error: null })
    .eq('id', runnerId);
  if (error) throw new Error(error.message);
  revalidatePath('/dashboard');
}
