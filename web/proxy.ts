import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // 정적 자산과 이미지 최적화 경로는 세션 확인에서 뺀다. ttf가 빠져 있으면
    // public/fonts의 PDF용 한글 폰트가 /login HTML로 리다이렉트되어 오면서
    // "폰트를 못 읽는다"는 원인 불명 에러로만 보인다 — 실제로 겪은 버그.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ttf|otf|woff|woff2)$).*)',
  ],
};
