import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const runner = resolve(root, 'runner');
const requirements = resolve(runner, 'requirements-markitdown.txt');
const environment = resolve(runner, '.markitdown-venv');
const venvPython = resolve(environment, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const marker = resolve(environment, '.career-atelier-markitdown');
const fingerprint = createHash('sha256').update(readFileSync(requirements)).update(process.platform).update(process.arch).digest('hex');

function run(command, args, capture = false) {
  const result = spawnSync(command, args, { encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit', windowsHide: true });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr?.trim() || `${command} 실행 실패`);
  return result.stdout?.trim() || '';
}

function findPython() {
  const choices = process.platform === 'win32' ? [['py', ['-3']], ['python', []]] : [['python3', []], ['python', []]];
  for (const [command, prefix] of choices) {
    try {
      const version = run(command, [...prefix, '-c', 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")'], true);
      const [major, minor] = version.split('.').map(Number);
      if (major > 3 || (major === 3 && minor >= 10)) return { command, prefix };
    } catch { /* 다음 Python 후보를 확인한다. */ }
  }
  throw new Error('MarkItDown에는 Python 3.10 이상이 필요합니다. https://www.python.org/downloads/ 에서 설치한 뒤 npm start를 다시 실행하세요.');
}

if (existsSync(venvPython) && existsSync(marker) && readFileSync(marker, 'utf8') === fingerprint) process.exit(0);
const found = findPython();
console.log('\n문서 토큰 절감을 위한 Microsoft MarkItDown을 로컬 가상환경에 준비합니다.');
mkdirSync(environment, { recursive: true });
if (!existsSync(venvPython)) run(found.command, [...found.prefix, '-m', 'venv', environment]);
run(venvPython, ['-m', 'pip', 'install', '--disable-pip-version-check', '--no-input', '-r', requirements]);
writeFileSync(marker, fingerprint);
console.log('MarkItDown 준비 완료.');
