'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { env } from '@/lib/env';

const linkErrorMessages: Record<string, string> = {
  invalid_link: '로그인 링크가 만료됐거나 이미 사용됐습니다. 다시 요청해 주세요.',
};

type Star = { x: number; y: number; z: number; size: number; tint: number };

function GalaxyCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    let animationFrame = 0;
    let stars: Star[] = [];
    let width = 0;
    let height = 0;
    let pointerX = 0;
    let pointerY = 0;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const reset = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      stars = Array.from({ length: Math.min(330, Math.floor((width * height) / 5200)) }, () => ({
        x: (Math.random() - .5) * width * 1.8,
        y: (Math.random() - .5) * height * 1.8,
        z: Math.random() * .94 + .06,
        size: Math.random() * 1.7 + .35,
        tint: Math.random(),
      }));
    };
    const onPointer = (event: PointerEvent) => {
      pointerX = (event.clientX / Math.max(width, 1) - .5) * 18;
      pointerY = (event.clientY / Math.max(height, 1) - .5) * 12;
    };
    const draw = () => {
      context.clearRect(0, 0, width, height);
      for (const star of stars) {
        if (!reducedMotion) star.z -= .00125;
        if (star.z <= .018) star.z = 1;
        const scale = 1 / star.z;
        const x = width / 2 + (star.x + pointerX) * scale;
        const y = height / 2 + (star.y + pointerY) * scale;
        if (x < -20 || x > width + 20 || y < -20 || y > height + 20) {
          star.z = 1;
          star.x = (Math.random() - .5) * width * 1.6;
          star.y = (Math.random() - .5) * height * 1.6;
          continue;
        }
        const alpha = Math.min(1, (1 - star.z) * 1.35 + .18);
        const radius = Math.min(2.8, star.size * scale * .36);
        context.beginPath();
        context.fillStyle = star.tint > .84 ? `rgba(255,207,126,${alpha})` : star.tint < .18 ? `rgba(101,225,255,${alpha})` : `rgba(232,247,255,${alpha})`;
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }
      if (!reducedMotion) animationFrame = requestAnimationFrame(draw);
    };
    reset();
    draw();
    window.addEventListener('resize', reset);
    window.addEventListener('pointermove', onPointer, { passive: true });
    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', reset);
      window.removeEventListener('pointermove', onPointer);
    };
  }, []);

  return <canvas ref={canvasRef} className="galaxy-star-canvas" aria-hidden="true"/>;
}

function ObsidianPlanetHero() {
  return <div className="galaxy-planet-stage" aria-hidden="true">
    <div className="galaxy-planet-kicker"><span>DESTINATION</span><b>CAREER ORBIT</b></div>
    <div className="galaxy-obsidian-system">
      <span className="galaxy-planet-aura"/>
      <div className="galaxy-plasma-plane plasma-back">
        <span className="galaxy-plasma-track"/>
        <i className="galaxy-plasma-spark spark-one"/>
        <i className="galaxy-plasma-spark spark-two"/>
        <i className="galaxy-plasma-spark spark-three"/>
      </div>
      <div className="galaxy-rock-orbit rock-orbit-back">
        <span className="galaxy-orbit-ring orbit-ring-wide"/>
        <span className="galaxy-orbit-ring orbit-ring-inner"/>
        <i className="galaxy-orbit-rock rock-one"/>
        <i className="galaxy-orbit-rock rock-two"/>
        <i className="galaxy-orbit-rock rock-three"/>
      </div>
      <Image
        className="galaxy-obsidian-planet"
        src="/assets/planet-obsidian.png"
        alt=""
        width={1254}
        height={1254}
        priority
        sizes="(max-width: 900px) 94vw, 46vw"
      />
      <span className="galaxy-planet-atmosphere"/>
      <span className="galaxy-planet-surface"/>
      <span className="galaxy-planet-aurora"/>
      <span className="galaxy-horizon-glint"/>
      <div className="galaxy-rock-orbit rock-orbit-front">
        <span className="galaxy-orbit-ring orbit-ring-wide"/>
        <span className="galaxy-orbit-ring orbit-ring-inner"/>
        <i className="galaxy-orbit-rock rock-four"/>
        <i className="galaxy-orbit-rock rock-five"/>
        <i className="galaxy-orbit-rock rock-six"/>
      </div>
      <div className="galaxy-plasma-plane plasma-front">
        <span className="galaxy-plasma-track"/>
        <i className="galaxy-plasma-spark spark-four"/>
        <i className="galaxy-plasma-spark spark-five"/>
      </div>
      <span className="galaxy-planet-scan"/>
    </div>
    <div className="galaxy-planet-telemetry"><span>CA-04</span><i/><b>ORBIT LOCKED</b><em>31° 28′ 04″</em></div>
  </div>;
}

export default function LoginPage() {
  return <main className="galaxy-login">
    <GalaxyCanvas/>
    <div className="galaxy-nebula nebula-one" aria-hidden="true"/><div className="galaxy-nebula nebula-two" aria-hidden="true"/>
    <ObsidianPlanetHero/>
    <div className="galaxy-cockpit" aria-hidden="true"><span>CA-04</span><i/><b>ORBITAL ACCESS CHANNEL</b><em>AUTH SIGNAL · ENCRYPTED</em></div>
    <section className="galaxy-login-copy">
      <p>CAREER ATELIER · PERSONAL CAREER OS</p>
      <h1>당신의 경험을<br/><span>다음 궤도</span>로.</h1>
      <div className="galaxy-route"><span>01 경험</span><i/><span>02 조사</span><i/><span>03 작성</span><i/><span>04 면접</span></div>
      <small>개인 AI 에이전트가 기업 조사부터 면접 준비까지<br/>하나의 작전선에서 이어갑니다.</small>
    </section>
    <Suspense fallback={<div className="galaxy-login-card loading"/>}>
      <LoginForm/>
    </Suspense>
    <div className="galaxy-login-footer"><span>SUBSCRIPTION ONLY</span><i/>API OVERAGE LOCKED<i/>PRIVATE WORKSPACE</div>
  </main>;
}

function LoginForm() {
  const searchParams = useSearchParams();
  const linkError = searchParams.get('error');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('sending');
    setErrorMessage('');
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/auth/confirm` } });
    if (error) {
      setStatus('error');
      setErrorMessage(error.message);
      return;
    }
    setStatus('sent');
  }

  return <section className="galaxy-login-card" aria-label="Career Atelier 로그인">
    <div className="galaxy-card-scan" aria-hidden="true"/>
    <header><div className="brand-mark">C<span>A</span><i>04</i></div><div><p>SECURE DOCKING</p><span>개인 작전선 로그인</span></div><em>ONLINE</em></header>
    <div className="galaxy-card-heading"><span>WELCOME, COMMANDER</span><h2>Career Atelier</h2><p>{env.allowedEmail ? `${env.allowedEmail} 계정으로만 도킹할 수 있습니다.` : '등록된 이메일로 일회용 매직링크를 전송합니다.'}</p></div>
    {linkError && <div className="galaxy-auth-message error">{linkErrorMessages[linkError] ?? '로그인에 실패했습니다. 다시 시도해 주세요.'}</div>}
    <form onSubmit={handleSubmit}>
      <label><span>COMMANDER EMAIL</span><div><i>@</i><input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com"/></div></label>
      <button type="submit" disabled={status === 'sending'}><span>{status === 'sending' ? '신호 전송 중…' : '매직링크로 작전선 입장'}</span><i>→</i></button>
    </form>
    {status === 'sent' && <div className="galaxy-auth-message success"><i/>메일함에 도킹 링크를 보냈습니다.</div>}
    {status === 'error' && <div className="galaxy-auth-message error">{errorMessage}</div>}
    <footer><span><i/>SUPABASE AUTH</span><span><i/>ENCRYPTED LINK</span><span><i/>NO PASSWORD</span></footer>
  </section>;
}
