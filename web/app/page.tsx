import { redirect } from 'next/navigation';

export default function RootPage() {
  // 로그인 여부는 middleware.ts가 이미 걸러낸다. 여기 도달했다면 로그인된 상태다.
  redirect('/dashboard');
}
