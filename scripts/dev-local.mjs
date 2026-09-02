import { spawn } from 'node:child_process';

const processes = [
  spawn(process.execPath, ['server/index.mjs'], { stdio: 'inherit' }),
  spawn('npm', ['run', 'dev:web'], { stdio: 'inherit' }),
];

let closing = false;
function close(code = 0) {
  if (closing) return;
  closing = true;
  for (const processItem of processes) processItem.kill('SIGTERM');
  setTimeout(() => process.exit(code), 300);
}

for (const processItem of processes) {
  processItem.on('exit', (code, signal) => {
    if (!closing && code && !signal) close(code);
  });
}

process.on('SIGINT', () => close(0));
process.on('SIGTERM', () => close(0));

