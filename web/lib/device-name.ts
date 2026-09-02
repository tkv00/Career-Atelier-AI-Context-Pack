'use client';

// Presence 표시("다른 기기에서도 열려 있음")와 essay_autosaves.device_name에 쓰는
// 기기 식별자. 브라우저별로 한 번 생성해 localStorage에 고정한다.
const STORAGE_KEY = 'career-atelier:device-name';

function detectPlatform(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Macintosh/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows';
  return 'Device';
}

export function getDeviceName(): string {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored) return stored;
  const generated = `${detectPlatform()}-${Math.random().toString(36).slice(2, 6)}`;
  window.localStorage.setItem(STORAGE_KEY, generated);
  return generated;
}
