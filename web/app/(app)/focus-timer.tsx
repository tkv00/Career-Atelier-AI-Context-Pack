'use client';

import { useEffect, useState } from 'react';

export function FocusTimer() {
  const modes = { focus: { label: '집중 항해', minutes: 25 }, short: { label: '짧은 정비', minutes: 5 }, long: { label: '긴 정비', minutes: 15 } } as const;
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<keyof typeof modes>('focus');
  const [seconds, setSeconds] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState(0);
  useEffect(() => {
    if (!running || seconds <= 0) return;
    const timer = window.setTimeout(() => {
      if (seconds <= 1) { setSeconds(0); setRunning(false); if (mode === 'focus') setSessions((current) => current + 1); }
      else setSeconds(seconds - 1);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [running, seconds, mode]);
  function choose(next: keyof typeof modes) { setMode(next); setSeconds(modes[next].minutes * 60); setRunning(false); }
  const total = modes[mode].minutes * 60;
  const clock = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  return <><button className={running ? 'focus-launcher running' : 'focus-launcher'} onClick={() => setOpen(true)} aria-label="집중 타이머 열기"><i/><span>{running ? clock : 'FOCUS'}</span></button>{open && <div className="focus-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><section className="focus-timer-modal" role="dialog" aria-modal="true" aria-label="우주 항해 집중 타이머"><div className="focus-modal-head"><div><p className="eyebrow">ORBITAL FOCUS PROTOCOL</p><h2>집중 항해 타이머</h2></div><button onClick={() => setOpen(false)} aria-label="닫기">×</button></div><div className="focus-mode-tabs">{(Object.keys(modes) as (keyof typeof modes)[]).map((key) => <button className={mode === key ? 'active' : ''} key={key} onClick={() => choose(key)}>{modes[key].label}<small>{modes[key].minutes}분</small></button>)}</div><div className="focus-orbit" style={{ '--focus-progress': `${((total - seconds) / total) * 360}deg` } as React.CSSProperties}><div className="focus-planet"><i/><span>{clock}</span><small>{mode === 'focus' ? '지원서에만 집중' : '다음 항해를 위한 정비'}</small></div></div><div className="focus-session-row"><span>오늘의 완료 궤도</span><div>{Array.from({ length: 4 }, (_, index) => <i className={index < sessions % 4 ? 'filled' : ''} key={index}/>)}</div><b>{sessions}회</b></div><div className="focus-controls"><button onClick={() => { setRunning(false); setSeconds(total); }}>초기화</button><button className="primary" onClick={() => { if (seconds === 0) setSeconds(total); setRunning((current) => !current); }}>{running ? '일시정지' : seconds === 0 ? '다시 시작' : '집중 시작'}</button></div><p className="focus-tip">한 세션에는 JD 분석, 경험 선택, 초안 작성, 검수 중 하나만 선택하세요.</p></section></div>}</>;
}
