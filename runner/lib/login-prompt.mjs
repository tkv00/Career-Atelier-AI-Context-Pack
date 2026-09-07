import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';

export async function promptLogin({ input = process.stdin, output = process.stdout } = {}) {
  let muted = false;
  const screen = new Writable({ write(chunk, encoding, done) {
    if (!muted) output.write(chunk, encoding);
    done();
  } });
  const rl = createInterface({ input, output: screen, terminal: Boolean(input.isTTY) });
  const abort = new AbortController();
  rl.on('SIGINT', () => abort.abort());
  rl.on('close', () => abort.abort());
  try {
    const email = await rl.question('Career Atelier에 가입한 이메일: ', { signal: abort.signal });
    const pending = rl.question('웹 가입 시 정한 비밀번호 (입력 내용은 표시되지 않습니다): ', { signal: abort.signal });
    muted = true;
    const password = await pending;
    return { email, password };
  } finally {
    muted = false;
    output.write('\n');
    rl.close();
  }
}
