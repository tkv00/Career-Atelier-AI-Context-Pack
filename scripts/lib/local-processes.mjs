import { spawn } from 'node:child_process';

// 셸의 &, start, .cmd 인용 규칙을 거치지 않고 Node 진입점을 직접 실행한다.
// 종료 대상도 이 실행기가 만든 프로세스 트리로 제한한다.
export function createProcessGroup({ platform = process.platform } = {}) {
  const children = new Set();
  let stopping = false;
  let stopPromise;
  const controller = new AbortController();

  function start(args, options = {}) {
    if (stopping) throw new Error('실행을 종료하고 있습니다.');
    const child = spawn(process.execPath, args, {
      stdio: 'inherit', detached: platform !== 'win32', windowsHide: true, ...options,
    });
    children.add(child);
    const done = new Promise(resolve => {
      child.once('error', error => resolve({ code: 1, error }));
      child.once('exit', (code, signal) => resolve({ code: code ?? 1, signal }));
    });
    // POSIX에서는 부모가 종료돼도 손자 프로세스가 남을 수 있어 그룹을 유지한다.
    return { child, done };
  }

  async function run(args, options) {
    const service = start(args, options);
    const result = await service.done;
    // 설치가 끝난 PID를 장시간 보관하면 운영체제가 재사용한 다른 프로세스를 종료할 수 있다.
    children.delete(service.child);
    if (result.code !== 0) throw result.error ?? new Error(`명령 실행에 실패했습니다 (종료 코드 ${result.code}). 위의 오류를 확인한 뒤 npm start를 다시 실행하세요.`);
  }

  function stop() {
    if (stopPromise) return stopPromise;
    stopping = true;
    controller.abort();
    stopPromise = Promise.all([...children].map(async child => {
      if (!child.pid) return;
      if (platform === 'win32') {
        if (child.exitCode !== null || child.signalCode !== null) return;
        // Windows는 음수 PID 그룹 신호가 없어 자신이 띄운 트리에만 taskkill을 쓴다.
        await new Promise(resolve => {
          const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
          killer.once('error', resolve);
          killer.once('exit', resolve);
        });
      } else {
        try { process.kill(-child.pid, 'SIGTERM'); } catch { return; }
        await new Promise(resolve => setTimeout(resolve, 500));
        try { process.kill(-child.pid, 'SIGKILL'); } catch { /* 이미 종료된 그룹은 그대로 둔다. */ }
      }
    }));
    return stopPromise;
  }

  return { start, run, stop, signal: controller.signal };
}
