'use client';

import { Suspense, useState } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { env } from '@/lib/env';
import { BrandIcon } from '../brand-icon';
import { CosmicScene } from './cosmic-scene';
import styles from './login.module.css';
import { authErrorMessage, signupOutcome } from './auth-feedback';

const linkErrorMessages: Record<string, string> = {
  invalid_link: '로그인 링크가 만료됐거나 이미 사용됐습니다. 다시 요청해 주세요.',
};

const crew = [
  { name: '기업 분석', image: 'company' },
  { name: '공고 탐색', image: 'jobs' },
  { name: '자소서 작성', image: 'writer' },
  { name: '자소서 검수', image: 'review' },
  { name: '소제목 제안', image: 'subtitle' },
  { name: '뉴스 탐색', image: 'news' },
  { name: '면접 준비', image: 'interview' },
];

export default function LoginPage() {
  return <main className={styles.login}>
    <CosmicScene />
    <header className={styles.masthead}>
      <div className={styles.brand}>
        <BrandIcon priority />
        <div><span className={styles.brandName}>Career Atelier</span><span className={styles.brandCaption}>YOUR CAREER, A NEW UNIVERSE</span></div>
      </div>
      <p className={styles.topNote}>나만의 AI 커리어 워크스페이스</p>
    </header>

    <div className={styles.content}>
      <section className={styles.story} aria-labelledby="login-headline">
        <p className={styles.eyebrow}><span /> BEYOND YOUR ORBIT</p>
        <h1 id="login-headline">당신의 경험을<br /><span>다음 궤도로.</span></h1>
        <p className={styles.intro}>쌓아온 경험이 새로운 가능성이 되는 곳.<br />일곱 AI 에이전트와 함께, 다음 커리어를 향해.</p>
        <div className={styles.journey} aria-label="경험 정리부터 지원, 면접까지">
          <span>경험의 발견</span><i aria-hidden="true" /><span>가능성의 연결</span><i aria-hidden="true" /><span>새로운 출발</span>
        </div>
      </section>

      <div className={styles.dock}>
        <Suspense fallback={<div className={`${styles.card} ${styles.loading}`} aria-label="로그인 화면 준비 중" aria-busy="true" />}>
          <LoginForm />
        </Suspense>
        <p className={styles.privateNote}><svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m8 1.5 5 2v4c0 3-5 6-5 6s-5-3-5-6v-4l5-2Z" stroke="currentColor" /><path d="m5.5 7.3 1.7 1.7 3.3-3.5" stroke="currentColor" /></svg>당신의 경험에 집중하는, 당신만의 공간</p>
      </div>
    </div>

    <footer className={styles.footer}>
      <div className={styles.crew}>
        <div className={styles.crewAvatars} aria-hidden="true">
          {crew.map((agent) => <span key={agent.image} title={agent.name}><Image src={`/assets/agent-${agent.image}.png`} alt="" width={128} height={40} sizes="128px" /></span>)}
        </div>
        <p><strong>7명의 AI 크루, 하나의 목표.</strong><span>기업 탐색부터 자소서, 면접까지 함께합니다.</span></p>
      </div>
    </footer>
  </main>;
}

function FieldIcon({ password = false }: { password?: boolean }) {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
    {password ? <><rect x="4.5" y="8.5" width="11" height="8" rx="2" /><path d="M7 8.5V6a3 3 0 0 1 6 0v2.5M10 12v2" /></> : <><rect x="3" y="5" width="14" height="11" rx="2" /><path d="m3.5 6 6.5 5 6.5-5" /></>}
  </svg>;
}

type Mode = 'login' | 'signup' | 'forgot';

function LoginForm() {
  const searchParams = useSearchParams();
  const linkError = searchParams.get('error');
  const [mode, setMode] = useState<Mode>(searchParams.get('mode') === 'signup' ? 'signup' : 'login');
  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  function switchMode(next: Mode) {
    if (status === 'sending') return;
    setMode(next);
    setStatus('idle');
    setErrorMessage('');
    setPassword('');
    setSuccessMessage('');
    setShowPassword(false);
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('sending');
    setErrorMessage('');
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password }).catch(() => ({ data: null, error: {} }));
    if (error) {
      setStatus('error');
      setErrorMessage(authErrorMessage(error, 'login'));
      return;
    }
    // 서버 컴포넌트가 방금 설정된 쿠키를 확실히 읽도록 풀 네비게이션으로 이동한다.
    if (!data?.session) { setStatus('error'); setErrorMessage('로그인 세션을 받지 못했습니다. 다시 시도해 주세요.'); return; }
    window.location.assign('/dashboard');
  }

  async function handleSignup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('sending');
    setErrorMessage('');
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password }).catch(() => ({ data: null, error: {} }));
    if (error) {
      setStatus('error');
      setErrorMessage(authErrorMessage(error, 'signup'));
      return;
    }
    const outcome = signupOutcome(data ?? { session: null, user: null });
    if (outcome !== 'ready') {
      setStatus('sent');
      setSuccessMessage(outcome === 'existing'
        ? '이미 가입한 계정일 수 있습니다. 로그인하거나 비밀번호를 재설정해 주세요.'
        : '가입 요청을 접수했습니다. 이메일 확인이 필요한 경우 메일함의 확인 링크를 연 뒤 로그인해 주세요. 메일이 없다면 스팸함과 설치 프로젝트의 Auth 설정을 확인하세요.');
      return;
    }
    window.location.assign('/dashboard');
  }

  async function handleForgot(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('sending');
    setErrorMessage('');
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/confirm`,
    }).catch(() => ({ error: {} }));
    if (error) {
      setStatus('error');
      setErrorMessage(authErrorMessage(error, 'forgot'));
      return;
    }
    setStatus('sent');
    setSuccessMessage('가입된 계정이라면 비밀번호 재설정 메일이 발송됩니다. 메일함과 스팸함을 확인해 주세요.');
  }

  const headerText =
    mode === 'signup'
      ? '내 이메일과 비밀번호로 시작하세요. 웹과 러너에서 같은 계정을 사용합니다. 작업실마다 첫 계정 하나만 만들 수 있습니다.'
      : mode === 'forgot'
        ? '가입한 이메일로 비밀번호 재설정 메일을 보내드립니다.'
        : env.allowedEmail
          ? `${env.allowedEmail} 계정으로만 로그인할 수 있습니다.`
          : 'Career Atelier에서 가입한 이메일과 비밀번호를 입력하세요.';

  return <section className={styles.card} aria-label="Career Atelier 로그인">
    <header className={styles.cardHeader}>
      <p className={styles.cardEyebrow}><span aria-hidden="true">✦</span> WELCOME ABOARD</p>
      <h2>{mode === 'signup' ? '당신만의 관제실 만들기' : mode === 'forgot' ? '비밀번호를 잊으셨나요?' : '다음 여정을 시작하세요.'}</h2>
      <p>{headerText}</p>
    </header>
    {linkError && <div className={`${styles.message} ${styles.error}`} role="alert">{linkErrorMessages[linkError] ?? '로그인에 실패했습니다. 다시 시도해 주세요.'}</div>}
    {mode !== 'forgot' && <div className={styles.authTabs} aria-label="계정 시작 방법">
      <button type="button" disabled={status === 'sending'} aria-pressed={mode === 'signup'} onClick={() => switchMode('signup')}>처음이에요 · 계정 만들기</button>
      <button type="button" disabled={status === 'sending'} aria-pressed={mode === 'login'} onClick={() => switchMode('login')}>기존 계정 로그인</button>
    </div>}

    {mode === 'forgot' ? (
      <form onSubmit={handleForgot}>
        <label><span>이메일</span><div><FieldIcon /><input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com"/></div></label>
        <button type="submit" disabled={status === 'sending'}><span>{status === 'sending' ? '전송 중…' : '재설정 메일 받기'}</span><i aria-hidden="true">↗</i></button>
      </form>
    ) : (
      <form onSubmit={mode === 'signup' ? handleSignup : handleLogin}>
        <label><span>이메일</span><div><FieldIcon /><input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com"/></div></label>
        <label>
          <span>비밀번호</span>
          <div>
            <FieldIcon password />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={mode === 'signup' ? 8 : undefined}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={mode === 'signup' ? '8자 이상' : '비밀번호'}
            />
          </div>
        </label>
        <button className={styles.passwordToggle} type="button" aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}</button>
        <p className={styles.authHint}>Supabase 관리 계정이나 DB 비밀번호가 아닌, 여기서 직접 정한 비밀번호를 사용하세요.</p>
        <button type="submit" disabled={status === 'sending'}>
          <span>{status === 'sending' ? (mode === 'signup' ? '만드는 중…' : '로그인 중…') : mode === 'signup' ? '계정 만들기' : '로그인'}</span>
          <i aria-hidden="true">↗</i>
        </button>
      </form>
    )}

    <div className={styles.modeSwitch}>
      {mode === 'login' && <>
        <button type="button" onClick={() => switchMode('signup')}>계정이 없으신가요? 만들기</button>
        <button type="button" onClick={() => switchMode('forgot')}>비밀번호를 잊으셨나요?</button>
      </>}
      {mode === 'signup' && <button type="button" onClick={() => switchMode('login')}>이미 계정이 있으신가요? 로그인</button>}
      {mode === 'forgot' && <button type="button" onClick={() => switchMode('login')}>로그인으로 돌아가기</button>}
    </div>

    {status === 'sent' && <div className={`${styles.message} ${styles.success}`} role="status">{successMessage}</div>}
    {status === 'error' && <div className={`${styles.message} ${styles.error}`} role="alert">{errorMessage}</div>}
    <details className={styles.connectionInfo}><summary>로그인이 계속 실패하나요?</summary><p>연결 프로젝트: <code>{new URL(env.supabaseUrl).host}</code></p><p>러너가 표시하는 프로젝트와 같아야 합니다. 새 이메일은 먼저 계정을 만들어야 합니다. 기존 설치 비밀번호로 실패하면 비밀번호를 재설정하세요.</p></details>
  </section>;
}
