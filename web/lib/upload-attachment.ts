'use client';

import { createClient } from '@/lib/supabase/client';

export type UploadedAttachment = { storagePath: string; fileName: string };

// 파일 본문은 Vercel 요청 한도를 거치지 않고 비공개 Storage로 전송한다.
export async function uploadPrivateAttachment(bucket: string, parent: string, file: File, maxBytes: number, commit: (file: UploadedAttachment) => Promise<void>) {
  if (!file.size || file.size > maxBytes) throw new Error(`${Math.round(maxBytes / 1024 / 1024)}MB 이하의 파일을 선택하세요.`);
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('다시 로그인해 주세요.');
  const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10) || 'bin';
  const storagePath = `${user.id}/${parent}/${crypto.randomUUID()}.${extension}`;
  const uploaded = await supabase.storage.from(bucket).upload(storagePath, file, { contentType: file.type || 'application/octet-stream', upsert: false });
  if (uploaded.error) throw new Error(uploaded.error.message);
  // 완료 응답이 유실되었을 수도 있으므로 클라이언트에서 파일을 추측 삭제하지 않는다.
  await commit({ storagePath, fileName: file.name });
}
