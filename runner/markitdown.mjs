import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { spawnManaged, terminateManaged } from './lib/managed-process.mjs';

const runnerRoot = fileURLToPath(new URL('.', import.meta.url));
const python = resolve(runnerRoot, '.markitdown-venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const bridge = resolve(runnerRoot, 'markitdown-bridge.py');
export const MARKITDOWN_INPUT_EXTENSIONS = new Set(['.pdf', '.xlsx', '.xls', '.docx', '.pptx', '.csv', '.html', '.htm']);
export const MARKITDOWN_MAX_OUTPUT_BYTES = 1024 * 1024;

export function markitdownPythonPath() {
  return python;
}

export function convertToMarkdown(path, { timeoutMs = 120_000, maxBytes = MARKITDOWN_MAX_OUTPUT_BYTES } = {}) {
  if (!existsSync(python)) throw new Error('MarkItDown이 준비되지 않았습니다. 저장소 루트에서 npm start를 다시 실행하세요.');
  return new Promise((resolveResult, reject) => {
    const child = spawnManaged(python, [bridge, path], { stdio: ['ignore', 'pipe', 'pipe'] });
    const output = [];
    let outputBytes = 0;
    let stderr = '';
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error); else resolveResult(value);
    };
    const timer = setTimeout(() => {
      void terminateManaged(child, 'timeout').finally(() => finish(new Error('MarkItDown 변환 시간이 2분을 넘었습니다. 파일을 나눠 주세요.')));
    }, timeoutMs);
    child.stdout.on('data', chunk => {
      outputBytes += chunk.length;
      if (outputBytes > maxBytes) {
        void terminateManaged(child, 'output_limit').finally(() => finish(new Error('변환된 Markdown이 1 MiB를 넘습니다. 파일을 나눠 주세요.')));
        return;
      }
      output.push(chunk);
    });
    child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-4000); });
    child.once('error', error => finish(new Error(`MarkItDown 실행 실패: ${error.message}`)));
    child.once('close', code => {
      if (settled) return;
      if (code !== 0) return finish(new Error(`MarkItDown 변환 실패: ${stderr.trim() || `종료 코드 ${code}`}`));
      const markdown = Buffer.concat(output).toString('utf8').trim();
      if (!markdown) return finish(new Error('MarkItDown이 읽을 수 있는 텍스트를 찾지 못했습니다. 스캔 이미지 PDF는 텍스트 PDF로 다시 저장해 주세요.'));
      finish(null, markdown);
    });
  });
}
