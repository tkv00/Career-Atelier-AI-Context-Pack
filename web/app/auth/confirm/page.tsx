import { redirect } from 'next/navigation';
import { confirmLogin } from './actions';
import { BrandIcon } from '../../brand-icon';

// 메일 링크가 도착하는 곳. 여기서 바로 검증하지 않고 사용자의 명시적 클릭을
// 받은 뒤 actions.ts의 confirmLogin이 실제 검증을 수행한다.
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string }>;
}) {
  const { token_hash, type, next } = await searchParams;

  if (!token_hash || !type) {
    redirect('/login?error=invalid_link');
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'radial-gradient(circle at 15% -10%,#f5f8f1,transparent 28%),#e9eeea',
        padding: 20,
      }}
    >
      <div className="card card-pad" style={{ width: '100%', maxWidth: 360, textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
          <BrandIcon priority />
        </div>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 22, margin: '0 0 8px' }}>Career Atelier</h1>
        <p style={{ color: 'var(--text-3)', fontSize: 13, margin: '0 0 20px' }}>버튼을 눌러 로그인을 완료하세요.</p>
        <form action={confirmLogin}>
          <input type="hidden" name="token_hash" value={token_hash} />
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="next" value={next ?? '/dashboard'} />
          <button type="submit" className="run-button" style={{ width: '100%', justifyContent: 'center' }}>
            로그인 확인
          </button>
        </form>
      </div>
    </main>
  );
}
