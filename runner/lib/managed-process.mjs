import spawn from 'cross-spawn';
import { spawn as spawnNative, spawnSync } from 'node:child_process';

const active = new Set();
const stopping = new Set();
const terminations = new WeakMap();
const GRACE_MS = 200;

export function spawnManaged(command, args, options = {}) {
  const child = spawn(command, args, { ...options, detached: process.platform !== 'win32', windowsHide: true });
  active.add(child);
  child.once('close', () => active.delete(child));
  return child;
}

export function terminationReason(child) {
  return terminations.get(child)?.reason;
}

export function terminateManaged(child, reason = 'cancelled') {
  const previous = terminations.get(child);
  if (previous) return previous.done;
  if (!child.pid || !active.has(child)) return Promise.resolve();
  const done = (async () => {
    if (process.platform === 'win32') {
      await new Promise((resolve, reject) => {
        const killer = spawnNative('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore', timeout: 5000 });
        killer.once('error', reject);
        killer.once('exit', code => {
          if (code !== 0 && child.exitCode === null && child.signalCode === null) reject(new Error('CLI 프로세스 트리를 종료하지 못했습니다.'));
          else resolve();
        });
      });
    } else {
      // CLI가 만든 손자 프로세스도 같은 그룹에서 종료한다. 이름으로 전체 프로세스를 찾지 않는다.
      try { process.kill(-child.pid, 'SIGTERM'); } catch (error) { if (error.code === 'ESRCH') return; throw error; }
      await new Promise(resolve => setTimeout(resolve, GRACE_MS));
      try { process.kill(-child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
    }
  })();
  terminations.set(child, { reason, done });
  stopping.add(done);
  void done.then(() => stopping.delete(done), () => stopping.delete(done));
  return done;
}

export async function stopManagedProcesses() {
  await Promise.all([...active].map(child => terminateManaged(child, 'shutdown')).concat([...stopping]));
}

// 예상치 못한 정상 exit 경로에서도 분리한 CLI가 혼자 남지 않게 한다.
process.once('exit', () => {
  for (const child of active) {
    if (!child.pid) continue;
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore', timeout: 2000 });
    } else {
      try { process.kill(-child.pid, 'SIGKILL'); } catch { /* 이미 종료된 그룹은 건드리지 않는다. */ }
    }
  }
});
