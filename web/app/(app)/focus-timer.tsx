'use client';

import { useEffect, useRef, useState } from 'react';

const MIN_CUSTOM_MINUTES = 1;
const MAX_CUSTOM_MINUTES = 180;

export function FocusTimer() {
  const presets = { focus: { label: '집중 항해', minutes: 25 }, short: { label: '짧은 정비', minutes: 5 }, long: { label: '긴 정비', minutes: 15 } } as const;
  type ModeKey = keyof typeof presets | 'custom';
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ModeKey>('focus');
  const [customMinutes, setCustomMinutes] = useState(25);
  const [seconds, setSeconds] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState(0);
  const panelRef = useRef<HTMLElement>(null);
  const [dragPos, setDragPos] = useState<{ top: number; left: number } | null>(null);
  const dragOffset = useRef<{ x: number; y: number } | null>(null);

  function minutesFor(key: ModeKey) {
    return key === 'custom' ? customMinutes : presets[key].minutes;
  }

  useEffect(() => {
    if (!running || seconds <= 0) return;
    const timer = window.setTimeout(() => {
      if (seconds <= 1) { setSeconds(0); setRunning(false); if (mode === 'focus' || mode === 'custom') setSessions((current) => current + 1); }
      else setSeconds(seconds - 1);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [running, seconds, mode]);

  function choose(next: ModeKey) { setMode(next); setSeconds(minutesFor(next) * 60); setRunning(false); }

  function applyCustomMinutes(raw: number) {
    if (!Number.isFinite(raw)) return;
    const clamped = Math.min(MAX_CUSTOM_MINUTES, Math.max(MIN_CUSTOM_MINUTES, Math.round(raw)));
    setCustomMinutes(clamped);
    if (mode === 'custom') { setSeconds(clamped * 60); setRunning(false); }
  }

  // 헤더를 잡고 끌면 패널을 화면 어디로든 옮길 수 있다 — 배경을 막지 않으니
  // 다른 작업 화면과 겹치면 안 보이는 위치로 치워 둘 수 있어야 한다.
  function handleDragStart(event: React.MouseEvent) {
    if (event.button !== 0 || !panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    dragOffset.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', handleDragEnd);
  }

  function handleDragMove(event: MouseEvent) {
    if (!dragOffset.current || !panelRef.current) return;
    const width = panelRef.current.offsetWidth;
    const height = panelRef.current.offsetHeight;
    const left = Math.min(Math.max(0, event.clientX - dragOffset.current.x), window.innerWidth - width);
    const top = Math.min(Math.max(0, event.clientY - dragOffset.current.y), window.innerHeight - height);
    setDragPos({ top, left });
  }

  function handleDragEnd() {
    dragOffset.current = null;
    window.removeEventListener('mousemove', handleDragMove);
    window.removeEventListener('mouseup', handleDragEnd);
  }

  const total = minutesFor(mode) * 60;
  const clock = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <>
      <button className={running ? 'focus-launcher running' : 'focus-launcher'} onClick={() => setOpen((current) => !current)} aria-label="집중 타이머 열기">
        <i/><span>{running ? clock : 'FOCUS'}</span>
      </button>
      {open && (
        <section
          ref={panelRef}
          className="focus-timer-panel"
          role="dialog"
          aria-label="우주 항해 집중 타이머"
          style={dragPos ? { top: dragPos.top, left: dragPos.left, right: 'auto', bottom: 'auto' } : undefined}
        >
          <div className="focus-modal-head" onMouseDown={handleDragStart}>
            <div><p className="eyebrow">ORBITAL FOCUS PROTOCOL</p><h2>집중 항해 타이머</h2></div>
            <button onMouseDown={(event) => event.stopPropagation()} onClick={() => setOpen(false)} aria-label="닫기">×</button>
          </div>
          <div className="focus-mode-tabs">
            {(Object.keys(presets) as (keyof typeof presets)[]).map((key) => (
              <button className={mode === key ? 'active' : ''} key={key} onClick={() => choose(key)}>{presets[key].label}<small>{presets[key].minutes}분</small></button>
            ))}
            <button className={mode === 'custom' ? 'active' : ''} onClick={() => choose('custom')}>직접 설정<small>{customMinutes}분</small></button>
          </div>
          {mode === 'custom' && (
            <div className="focus-custom-input">
              <label htmlFor="focus-custom-minutes">원하는 시간(분)</label>
              <input
                id="focus-custom-minutes"
                type="number"
                min={MIN_CUSTOM_MINUTES}
                max={MAX_CUSTOM_MINUTES}
                value={customMinutes}
                onChange={(event) => applyCustomMinutes(Number(event.target.value))}
              />
            </div>
          )}
          <div className="focus-orbit" style={{ '--focus-progress': `${((total - seconds) / total) * 360}deg` } as React.CSSProperties}><div className="focus-planet"><i/><span>{clock}</span><small>{mode === 'focus' || mode === 'custom' ? '지원서에만 집중' : '다음 항해를 위한 정비'}</small></div></div>
          <div className="focus-session-row"><span>오늘의 완료 궤도</span><div>{Array.from({ length: 4 }, (_, index) => <i className={index < sessions % 4 ? 'filled' : ''} key={index}/>)}</div><b>{sessions}회</b></div>
          <div className="focus-controls"><button onClick={() => { setRunning(false); setSeconds(total); }}>초기화</button><button className="primary" onClick={() => { if (seconds === 0) setSeconds(total); setRunning((current) => !current); }}>{running ? '일시정지' : seconds === 0 ? '다시 시작' : '집중 시작'}</button></div>
          <p className="focus-tip">한 세션에는 JD 분석, 경험 선택, 초안 작성, 검수 중 하나만 선택하세요.</p>
        </section>
      )}
    </>
  );
}
