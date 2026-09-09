import { spawnManaged as spawn } from '../lib/managed-process.mjs';
import { childEnvironment } from '../safety.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function buildGeminiArgs({ contextDir, model, effort, schemaPath, mode = 'accept-edits' }) {
  // agy의 일반 text 모드는 stdin을 읽지 않는다. 본문은 전용 NDJSON 형식으로 전송한다.
  const args = ['--print=', '--input-format', 'stream-json', '--output-format', 'stream-json'];
  if (contextDir) args.push('--add-dir', contextDir);
  if (model) args.push('--model', model);
  if (effort) args.push('--effort', effort);
  // plan은 확인 입력을 기다리므로 비대화형 실행에서는 사용하지 않는다.
  args.push('--mode', mode, '--sandbox');
  if (schemaPath) args.push('--json-schema', schemaPath);
  if (args.some(value => /[\r\n]/.test(value))) throw new Error('Gemini 실행 옵션에는 줄바꿈을 사용할 수 없습니다.');
  return args;
}

export function encodeGeminiInput(prompt) {
  return JSON.stringify({ event: 'user', message: { role: 'user', content: [{ type: 'text', text: prompt }] } }) + '\n';
}

export function spawnGemini({ workspace, contextDir, prompt, model, effort, jsonSchema, mode = 'accept-edits' }) {
  let schemaPath;
  if (jsonSchema) {
    // 스키마도 Windows 명령행 길이 제한을 넘을 수 있다. agy는 파일 경로를 지원한다.
    mkdirSync(resolve(workspace, 'schema'), { recursive: true });
    schemaPath = resolve(workspace, 'schema', 'gemini-output.json');
    writeFileSync(schemaPath, jsonSchema, { encoding: 'utf8', mode: 0o600 });
  }
  const args = buildGeminiArgs({ contextDir, model, effort, schemaPath, mode });
  const child = spawn('agy', args, { cwd: workspace, env: childEnvironment(), stdio: ['pipe', 'pipe', 'pipe'] });
  child.stdin.on('error', () => {});
  child.stdin.end(encodeGeminiInput(prompt), 'utf8');
  return child;
}

export function geminiResult(parsed) {
  return parsed?.event === 'result' ? parsed.result : parsed;
}

export function extractOutput(parsed, fallback) {
  const result = geminiResult(parsed);
  if (result?.status && result.status !== 'SUCCESS') return fallback;
  if (result?.structured_output && typeof result.structured_output === 'object') return result.structured_output;
  if (typeof result?.response === 'string' && result.response) return result.response;
  return fallback;
}
