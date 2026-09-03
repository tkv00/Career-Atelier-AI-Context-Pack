'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BrandIcon } from '../../brand-icon';

// auth/confirm이 recovery 토큰을 검증해 세션을 만든 뒤 여기로 보낸다.
// 미들웨어가 비로그인 접근을 이미 막아 주므로 이 페이지 자체는 세션 유무를
// 따로 확인하지 않는다.
export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirm) {
      setStatus('error');
      setErrorMessage('두 비밀번호가 서로 다릅니다.');
      return;
    }
    setStatus('saving');
    setErrorMessage('');
    const supabase = createClient();
    // generated_password는 설치 마법사가 자동 생성한 비밀번호를 쓰는 동안만
    // 대시보드 배너를 띄우는 플래그다 — 직접 바꿨으니 여기서 내린다.
    const { error } = await supabase.auth.updateUser({ password, data: { generated_password: false } });
    if (error) {
      setStatus('error');
      setErrorMessage(error.message);
      return;
    }
    setStatus('done');
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
      <div className="card card-pad" style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
          <BrandIcon priority />
        </div>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 22, margin: '0 0 8px', textAlign: 'center' }}>새 비밀번호 설정</h1>
        {status === 'done' ? (
          <>
            <p style={{ color: 'var(--text-3)', fontSize: 13, textAlign: 'center', margin: '0 0 20px' }}>비밀번호를 변경했습니다.</p>
            <a href="/dashboard" className="run-button" style={{ width: '100%', justifyContent: 'center', display: 'flex' }}>
              관제실로 이동
            </a>
          </>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 10 }}>
            <label style={{ fontSize: 12, color: 'var(--text-3)' }}>
              새 비밀번호
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="field-input"
                style={{ marginTop: 4 }}
                placeholder="8자 이상"
              />
            </label>
            <label style={{ fontSize: 12, color: 'var(--text-3)' }}>
              새 비밀번호 확인
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                className="field-input"
                style={{ marginTop: 4 }}
                placeholder="다시 입력"
              />
            </label>
            {status === 'error' && <p style={{ color: 'var(--danger)', fontSize: 12, margin: 0 }}>{errorMessage}</p>}
            <button type="submit" className="run-button" style={{ width: '100%', justifyContent: 'center' }} disabled={status === 'saving'}>
              {status === 'saving' ? '저장 중…' : '비밀번호 변경'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
