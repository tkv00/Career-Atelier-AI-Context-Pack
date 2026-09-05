'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import styles from './login.module.css';
import { createCosmicRenderer, type CosmicRenderer } from './cosmic-renderer';

function subscribeMotion(callback: () => void) {
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  preference.addEventListener('change', callback);
  return () => preference.removeEventListener('change', callback);
}

function subscribeVisibility(callback: () => void) {
  document.addEventListener('visibilitychange', callback);
  return () => document.removeEventListener('visibilitychange', callback);
}

function VolumetricSpace({ still }: { still: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CosmicRenderer | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const renderer = createCosmicRenderer(canvasRef.current);
    rendererRef.current = renderer;
    return () => { renderer.dispose(); rendererRef.current = null; };
  }, []);

  useEffect(() => { rendererRef.current?.setPaused(still); }, [still]);

  return <canvas ref={canvasRef} className={styles.spaceCanvas} aria-hidden="true" />;
}

export function CosmicScene() {
  const [paused, setPaused] = useState(false);
  const reducedMotion = useSyncExternalStore(subscribeMotion,
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches, () => true);
  const visible = useSyncExternalStore(subscribeVisibility,
    () => document.visibilityState === 'visible', () => true);
  const still = paused || reducedMotion || !visible;

  return <>
    <div className={styles.cosmos} data-still={still} aria-hidden="true">
      <div className={styles.galaxyImage}>
        {/* GPU를 쓸 수 없거나 컨텍스트를 잃어도 로그인 배경이 비지 않도록 원본을 남긴다. */}
        <Image src="/assets/login-galaxy.webp" alt="" fill priority unoptimized />
      </div>
      <VolumetricSpace still={still} />
      <div className={styles.scrim} />
    </div>
    <button className={styles.motionToggle} type="button" aria-pressed={paused || reducedMotion}
      disabled={reducedMotion} onClick={() => setPaused((value) => !value)}>
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
        {paused || reducedMotion ? <path d="m6 3 6 5-6 5V3Z" stroke="currentColor" /> : <path d="M5.5 3v10M10.5 3v10" stroke="currentColor" strokeWidth="1.5" />}
      </svg>
      {reducedMotion ? '모션 줄이기 적용 중' : paused ? '배경 모션 재생' : '배경 모션 일시정지'}
    </button>
  </>;
}
