'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { PROVIDER_META, isProvider } from '@/lib/agent-providers';
import { getPilotState, PILOTS, type PendingPilotJob, type PilotId, type PilotRun } from './pilot-state';
import styles from './pilot-bridge.module.css';

function subscribeMotion(callback: () => void) {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}
function subscribeVisibility(callback: () => void) {
  document.addEventListener('visibilitychange', callback);
  return () => document.removeEventListener('visibilitychange', callback);
}
const readMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const readVisibility = () => document.visibilityState === 'visible';
const serverTrue = () => true;

function starUnit(index: number, salt: number) {
  let value = Math.imul(index + 1, 1_103_515_245) + Math.imul(salt + 1, 12_345);
  value = Math.imul(value ^ (value >>> 16), 2_246_822_519);
  return (value >>> 0) / 4_294_967_296;
}

// 무작위 값은 서버와 브라우저가 다른 별 지도를 만들 수 있어, 고정 시드로 만든다.
const STARS = Array.from({ length: 420 }, (_, index) => {
  const depth = starUnit(index, 2);
  const size = .55 + depth * 2.35;
  return {
    x: `${starUnit(index, 3) * 100}%`,
    y: `${3 + starUnit(index, 4) * 88}%`,
    size: `${size}px`,
    glow: `${3 + size * 3}px`,
    opacity: `${.26 + depth * .67}`,
    duration: `${2.4 + starUnit(index, 5) * 4.6}s`,
    delay: `${-starUnit(index, 6) * 6}s`,
    color: ['#dceeff', '#ffe0b1', '#9ecfff'][index % 3],
  };
});

function Starfield() {
  return <div className={styles.space} aria-hidden="true">
    <div className={styles.starfield} data-starfield>
      {STARS.map((star, index) => <i key={index} className={styles.star} data-star style={{
        '--x': star.x, '--y': star.y, '--size': star.size, '--glow': star.glow,
        '--opacity': star.opacity, '--duration': star.duration, '--delay': star.delay, '--star-color': star.color,
      } as CSSProperties}/>) }
    </div>
  </div>;
}

function Instrument({ kind }: { kind: string }) {
  return <div className={styles.instrument} data-kind={kind} aria-hidden="true">
    <div className={styles.radar}><i/><b/><span/></div>
    <div className={styles.wave}>{Array.from({ length: 11 }, (_, i) => <i key={i} style={{ '--bar': `${22 + (i * 31) % 65}%`, '--beat': `${i * -.17}s` } as CSSProperties}/>)}</div>
    <div className={styles.document}>{Array.from({ length: 5 }, (_, i) => <i key={i} style={{ '--line': `${90 - (i * 17) % 45}%`, '--beat': `${i * -.35}s` } as CSSProperties}/>)}</div>
    <div className={styles.scan}/>
  </div>;
}

export function PilotBridge({ runs, runnerOnline, providers = {}, pending = {}, actions = {} }: {
  runs: PilotRun[];
  runnerOnline: boolean;
  providers?: Partial<Record<PilotId, string>>;
  pending?: Partial<Record<PilotId, PendingPilotJob>>;
  actions?: Partial<Record<PilotId, ReactNode>>;
}) {
  const root = useRef<HTMLElement>(null);
  const [selectedId, setSelectedId] = useState<PilotId | null>(null);
  const [paused, setPaused] = useState(false);
  const [inView, setInView] = useState(true);
  const reduced = useSyncExternalStore(subscribeMotion, readMotion, serverTrue);
  const visible = useSyncExternalStore(subscribeVisibility, readVisibility, serverTrue);
  const still = paused || reduced || !visible || !inView;
  const crew = PILOTS.map(pilot => ({ ...pilot, ...getPilotState(pilot.id, runs, runnerOnline, pending[pilot.id]) }));
  const working = crew.filter(pilot => pilot.state === 'working');
  const queued = crew.filter(pilot => pilot.state === 'queued');
  const selected = crew.find(pilot => pilot.id === selectedId) ?? working[0] ?? crew[0]!;
  const provider = providers[selected.id];

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry?.isIntersecting ?? false), { threshold: 0 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return <section ref={root} className={styles.bridge} aria-label="파일럿 관제실" data-motion={still ? 'paused' : 'playing'}>
    <div className={styles.heading}>
      <div><span className={styles.eyebrow}>YOUR CREW, YOUR NEXT CHAPTER</span><h2>당신의 다음 여정을 함께 비행합니다.</h2></div>
      <span className={styles.connection} data-online={runnerOnline}><i/>{runnerOnline ? '러너 연결됨' : '러너 연결 대기'}</span>
    </div>
    <div className={styles.command}>
      <div className={styles.scene} onPointerMove={event => {
        if (still || event.pointerType !== 'mouse') return;
        const bounds = event.currentTarget.getBoundingClientRect();
        event.currentTarget.style.setProperty('--look-x', `${(event.clientX - bounds.left) / bounds.width * 2 - 1}`);
        event.currentTarget.style.setProperty('--look-y', `${(event.clientY - bounds.top) / bounds.height * 2 - 1}`);
      }} onPointerLeave={event => { event.currentTarget.style.setProperty('--look-x', '0'); event.currentTarget.style.setProperty('--look-y', '0'); }}>
        <Starfield/>
        <div className={styles.viewportFrame} aria-hidden="true"><i/><i/></div>
        <div className={styles.planet} aria-hidden="true"><i/></div>
        <div className={styles.windowTitle}><span>FLIGHT DECK</span><p>{working.length ? `${working.length}명의 파일럿이 임무를 수행하고 있습니다` : runnerOnline ? '다음 임무를 위한 준비가 끝났습니다' : '파일럿들이 연결을 기다리고 있습니다'}</p></div>
        <div className={styles.floor} aria-hidden="true"/>
        <div className={styles.hologram} data-active={working.length > 0} aria-hidden="true"><i/><i/><b/><span/></div>
        <div className={styles.holoLabel}><span>MISSION LINK</span><strong>{working.length ? `${working.length}개 임무 진행 중` : '임무 대기'}</strong></div>
        <svg className={styles.transmissions} viewBox="0 0 1000 650" preserveAspectRatio="none" aria-hidden="true">
          {crew.map((pilot, i) => <path key={pilot.id} data-working={pilot.state === 'working'} style={{ '--pilot-color': pilot.color, '--delay': `${i * -.38}s` } as CSSProperties}
            d={`M ${80 + i * 140} ${[420, 460, 500, 515, 500, 460, 420][i]} Q ${80 + i * 140} 300 500 305`}/>)}
        </svg>
        <div className={styles.stations}>
          {crew.map((pilot, i) => <button type="button" key={pilot.id} className={styles.station} data-pilot={pilot.id} data-state={pilot.state}
            aria-label={`${pilot.name} · ${pilot.role} · ${pilot.label}`} aria-pressed={selected.id === pilot.id} onClick={() => setSelectedId(pilot.id)}
            style={{ '--pilot-color': pilot.color, '--x': `${8 + i * 14}%`, '--y': `${[348, 390, 428, 444, 428, 390, 348][i]}px`, '--angle': `${(3 - i) * 5}deg`, '--delay': `${i * -1.17}s`, '--mobile-x': `${[14, 38, 62, 86, 23, 50, 77][i]}%`, '--mobile-y': `${[320, 320, 320, 320, 450, 465, 450][i]}px` } as CSSProperties}>
            <div className={styles.stationHalo}/>
            <div className={styles.holoScreen}><Instrument kind={pilot.instrument}/><span>{pilot.station}</span></div>
            <div className={styles.pilotRig}><div className={`${styles.sprite} cloud-space-agent frame-${pilot.frame}`}/><i className={styles.handLeft}/><i className={styles.handRight}/></div>
            <div className={styles.console}><i/><i/><i/><b/></div>
            <div className={styles.nameplate}><strong>{pilot.name}</strong><span><i/>{pilot.label}</span></div>
          </button>)}
        </div>
        <div className={styles.sceneFooter}><span>파일럿을 눌러 임무 확인</span><button type="button" disabled={reduced} aria-pressed={paused || reduced} onClick={() => setPaused(value => !value)}>{reduced ? '동작 줄이기 적용됨' : paused ? '▷ 관제실 모션 재생' : 'Ⅱ 관제실 모션 정지'}</button></div>
      </div>

      <aside className={styles.inspector} aria-label="선택한 파일럿 임무" style={{ '--pilot-color': selected.color } as CSSProperties} data-state={selected.state}>
        <div className={styles.pilotProfile}><div className={`${styles.portrait} cloud-space-agent frame-${selected.frame}`} aria-hidden="true"/><div><span>{selected.station} 파일럿</span><h3>{selected.name}<small>{selected.role}</small></h3></div></div>
        <div className={styles.stateLabel}><i/>{selected.label}</div>
        <p className={styles.message}>{selected.message}</p>
        <div className={styles.detailInstrument}><Instrument kind={selected.instrument}/><span>{selected.state === 'working' ? '임무 수행 중' : selected.state === 'offline' ? '러너 신호 없음' : '작업 상태'}</span></div>
        <dl className={styles.details}><div><dt>담당 모델</dt><dd>{provider && isProvider(provider) ? PROVIDER_META[provider].label : '미설정'}</dd></div><div><dt>역할</dt><dd>{selected.role}</dd></div>
          {selected.createdAt && <div><dt>최근 실행 기록</dt><dd><time dateTime={selected.createdAt}>{new Date(selected.createdAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}</time></dd></div>}</dl>
        <div className={styles.actions}>{actions[selected.id] ?? <Link href={selected.href}>{selected.id === 'interview' ? '면접 준비 열기' : '채용공고에서 임무 시작'} <span aria-hidden="true">↗</span></Link>}
          <Link href="/activity">실행 기록 확인 <span aria-hidden="true">↗</span></Link></div>
        <div className={styles.fleetSummary}><span><b>{working.length}</b> 수행 중</span><span><b>{queued.length}</b> 출발 대기</span><span><b>7</b> 파일럿</span></div>
      </aside>
    </div>
    <div className={styles.roster} aria-label="파일럿 선택">
      {crew.map(pilot => <button type="button" key={pilot.id} aria-pressed={selected.id === pilot.id} data-state={pilot.state} onClick={() => setSelectedId(pilot.id)} style={{ '--pilot-color': pilot.color } as CSSProperties}>
        <i/><strong>{pilot.name}</strong><span>{pilot.role}</span><small>{pilot.label}</small>
      </button>)}
    </div>
  </section>;
}
