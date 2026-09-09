const { spawn } = require('node:child_process');
process.on('SIGTERM', () => {});
if (process.argv[2] === 'grandchild') {
  process.stdout.write(JSON.stringify({ ready: true, pid: process.pid }) + '\n');
} else {
  const grandchild = spawn(process.execPath, [__filename, 'grandchild'], { stdio: ['ignore', 'pipe', 'inherit'] });
  grandchild.stdout.on('data', chunk => process.stdout.write(chunk));
}
setInterval(() => {}, 1000);
