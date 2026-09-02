import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

// 매일 15시 자동 채용 탐색(§12). node-cron 없이 기존 폴링 주기 위에 얹는다 —
// "당일 안이면 실행, 날짜가 넘어갔으면 건너뛴다"는 매 체크마다 "오늘 KST
// 날짜"와 "마지막으로 자동 실행한 날짜"를 비교하는 것만으로 자연스럽게
// 충족된다(노트북이 15시에 꺼져 있었어도 그날 안에 켜지면 실행되고, 하루가
// 넘어가면 어제 몫을 소급 실행하지 않는다).
const stateDir = resolve(homedir(), '.career-atelier');
const statePath = resolve(stateDir, 'scheduler-state.json');
const TRIGGER_HOUR_KST = 15;

function todayKstDateString(now = new Date()) {
  // Asia/Seoul은 DST가 없어 UTC+9 고정 오프셋으로 계산해도 안전하다.
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function currentKstHour(now = new Date()) {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.getUTCHours();
}

function readState() {
  try {
    return JSON.parse(readFileSync(statePath, 'utf8'));
  } catch {
    return { lastAutoSearchDate: null };
  }
}

function writeState(state) {
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(statePath, JSON.stringify(state, null, 2));
}

// 매 하트비트마다 불러도 되는 가벼운 체크 — 조건 안 맞으면 즉시 false 반환.
export function shouldRunDailySearch(now = new Date()) {
  if (currentKstHour(now) < TRIGGER_HOUR_KST) return false;
  const state = readState();
  return state.lastAutoSearchDate !== todayKstDateString(now);
}

export function markDailySearchRan(now = new Date()) {
  writeState({ lastAutoSearchDate: todayKstDateString(now) });
}
