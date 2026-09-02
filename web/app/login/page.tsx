'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { env } from '@/lib/env';
import { BrandIcon } from '../brand-icon';

const linkErrorMessages: Record<string, string> = {
  invalid_link: '로그인 링크가 만료됐거나 이미 사용됐습니다. 다시 요청해 주세요.',
};

type Star = { x: number; y: number; depth: number; size: number; tint: number; phase: number };

type GalaxyParticle = {
  radius: number;
  angle: number;
  thickness: number;
  size: number;
  color: string;
  alpha: number;
};

function StarfieldCanvas() {
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
    let smoothX = 0;
    let smoothY = 0;
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
      stars = Array.from({ length: Math.min(380, Math.floor((width * height) / 4500)) }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        depth: Math.random() * .8 + .2,
        size: Math.random() * 1.45 + .35,
        tint: Math.random(),
        phase: Math.random() * Math.PI * 2,
      }));
    };
    const onPointer = (event: PointerEvent) => {
      pointerX = (event.clientX / Math.max(width, 1) - .5) * 16;
      pointerY = (event.clientY / Math.max(height, 1) - .5) * 12;
    };
    const draw = (time = 0) => {
      context.clearRect(0, 0, width, height);
      smoothX += (pointerX - smoothX) * .025;
      smoothY += (pointerY - smoothY) * .025;
      for (const star of stars) {
        const x = star.x + smoothX * star.depth;
        const y = star.y + smoothY * star.depth;
        const alpha = reducedMotion ? .56 : .36 + Math.sin(time * .0007 + star.phase) * .18;
        context.beginPath();
        context.fillStyle = star.tint > .86 ? `rgba(255,199,124,${alpha})` : star.tint < .17 ? `rgba(104,217,255,${alpha})` : `rgba(224,239,255,${alpha})`;
        context.arc(x, y, star.size * star.depth, 0, Math.PI * 2);
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

function SpiralGalaxyHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    let width = 0;
    let height = 0;
    let animationFrame = 0;
    let particles: GalaxyParticle[] = [];
    let pointerX = Number.POSITIVE_INFINITY;
    let pointerY = Number.POSITIVE_INFINITY;
    let smoothPointerX = pointerX;
    let smoothPointerY = pointerY;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const reset = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      const bounds = canvas.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);

      const count = window.innerWidth < 600 ? 2200 : 4800;
      particles = Array.from({ length: count }, (_, index) => {
        const radius = Math.pow(Math.random(), .72);
        const branch = (index % 5) / 5 * Math.PI * 2;
        const scatter = (Math.random() - .5) * (.18 + radius * .74);
        const angle = branch + radius * 5.4 + scatter;
        const color = radius < .24
          ? '255,145,67'
          : radius < .62
            ? '151,102,255'
            : Math.random() > .52 ? '72,146,255' : '87,217,238';
        return {
          radius,
          angle,
          thickness: (Math.random() - .5) * (1 - radius * .68),
          size: Math.random() * 1.45 + .42,
          color,
          alpha: Math.random() * .58 + .24,
        };
      });
    };

    const onPointerMove = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      pointerX = event.clientX - bounds.left;
      pointerY = event.clientY - bounds.top;
    };
    const onPointerLeave = () => {
      pointerX = Number.POSITIVE_INFINITY;
      pointerY = Number.POSITIVE_INFINITY;
      smoothPointerX = pointerX;
      smoothPointerY = pointerY;
    };

    const draw = (time = 0) => {
      context.clearRect(0, 0, width, height);
      const centerX = width * .5;
      const centerY = height * .5;
      const scale = Math.min(width, height) * .45;
      const rotation = reducedMotion ? -.18 : time * .000032 - .18;
      const cosRotation = Math.cos(rotation);
      const sinRotation = Math.sin(rotation);

      if (Number.isFinite(pointerX)) {
        if (!Number.isFinite(smoothPointerX)) {
          smoothPointerX = pointerX;
          smoothPointerY = pointerY;
        } else {
          smoothPointerX += (pointerX - smoothPointerX) * .09;
          smoothPointerY += (pointerY - smoothPointerY) * .09;
        }
      }

      const halo = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, scale * 1.08);
      halo.addColorStop(0, 'rgba(255,151,71,.22)');
      halo.addColorStop(.24, 'rgba(143,83,255,.12)');
      halo.addColorStop(.66, 'rgba(39,111,213,.045)');
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      context.fillStyle = halo;
      context.fillRect(0, 0, width, height);

      context.globalCompositeOperation = 'lighter';
      for (const particle of particles) {
        const localX = Math.cos(particle.angle) * particle.radius;
        const localY = Math.sin(particle.angle) * particle.radius;
        let x = centerX + (localX * cosRotation - localY * sinRotation) * scale;
        let y = centerY + ((localX * sinRotation + localY * cosRotation) * .42 + particle.thickness * .13) * scale;

        const dx = x - smoothPointerX;
        const dy = y - smoothPointerY;
        const distance = Math.hypot(dx, dy);
        if (distance < 92 && distance > 0) {
          const force = Math.pow(1 - distance / 92, 2) * 23;
          x += dx / distance * force - dy / distance * force * .34;
          y += dy / distance * force + dx / distance * force * .34;
        }

        const pulse = reducedMotion ? 1 : .88 + Math.sin(time * .0011 + particle.angle * 3) * .12;
        context.fillStyle = `rgba(${particle.color},${particle.alpha * pulse})`;
        const size = particle.size * (.72 + (1 - particle.radius) * .5);
        context.fillRect(x, y, size, size);
      }

      const core = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, scale * .19);
      core.addColorStop(0, 'rgba(255,244,220,.98)');
      core.addColorStop(.12, 'rgba(255,178,91,.78)');
      core.addColorStop(.46, 'rgba(255,105,48,.22)');
      core.addColorStop(1, 'rgba(255,92,35,0)');
      context.fillStyle = core;
      context.fillRect(centerX - scale * .22, centerY - scale * .22, scale * .44, scale * .44);
      context.globalCompositeOperation = 'source-over';

      if (!reducedMotion) animationFrame = requestAnimationFrame(draw);
    };

    reset();
    draw();
    window.addEventListener('resize', reset);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.documentElement.addEventListener('mouseleave', onPointerLeave);
    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', reset);
      window.removeEventListener('pointermove', onPointerMove);
      document.documentElement.removeEventListener('mouseleave', onPointerLeave);
    };
  }, []);

  return (
    <div className="galaxy-spiral-stage" aria-hidden="true">
      <canvas ref={canvasRef} className="galaxy-spiral-canvas" />
    </div>
  );
}

export default function LoginPage() {
  return <main className="galaxy-login">
    <StarfieldCanvas/>
    <div className="galaxy-nebula nebula-one" aria-hidden="true"/><div className="galaxy-nebula nebula-two" aria-hidden="true"/>
    <section className="galaxy-login-copy">
      <p>CAREER ATELIER</p>
      <h1>당신의 경험을 <span>다음 궤도로.</span></h1>
    </section>
    <SpiralGalaxyHero/>
    <Suspense fallback={<div className="galaxy-login-card loading"/>}>
      <LoginForm/>
    </Suspense>
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
    <header><BrandIcon priority/><div><h2>Career Atelier</h2><p>{env.allowedEmail ? `${env.allowedEmail} 계정으로만 로그인할 수 있습니다.` : '이메일로 일회용 매직링크를 보내드립니다.'}</p></div></header>
    {linkError && <div className="galaxy-auth-message error">{linkErrorMessages[linkError] ?? '로그인에 실패했습니다. 다시 시도해 주세요.'}</div>}
    <form onSubmit={handleSubmit}>
      <label><span>이메일</span><div><i>@</i><input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com"/></div></label>
      <button type="submit" disabled={status === 'sending'}><span>{status === 'sending' ? '전송 중…' : '매직링크 받기'}</span><i>→</i></button>
    </form>
    {status === 'sent' && <div className="galaxy-auth-message success"><i/>메일함에 도킹 링크를 보냈습니다.</div>}
    {status === 'error' && <div className="galaxy-auth-message error">{errorMessage}</div>}
  </section>;
}
