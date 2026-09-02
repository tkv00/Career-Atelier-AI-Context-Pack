'use server';

import { type EmailOtpType } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// 사용자가 확인 버튼을 눌렀을 때만 토큰을 소모한다. 메일 링크를 GET에서 바로
// 검증하면 Gmail 등 메일 보안 스캐너가 미리 열어봐서 1회용 토큰이 먼저
// 소모되는 문제가 있어, 실제 클릭(폼 제출) 시점까지 검증을 미룬다.
export async function confirmLogin(formData: FormData) {
  const token_hash = formData.get('token_hash') as string;
  const type = formData.get('type') as EmailOtpType;
  const next = (formData.get('next') as string) || '/dashboard';

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });

  if (error) {
    redirect('/login?error=invalid_link');
  }

  redirect(next);
}
