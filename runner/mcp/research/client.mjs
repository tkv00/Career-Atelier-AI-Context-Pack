import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

// 실제 stdio 경계를 사용하므로 직렬화·IPC·응답 크기까지 측정에 포함된다.
export function createResearchClient() {
  const started = performance.now();
  const child = spawn(process.execPath, [fileURLToPath(new URL('../server.mjs', import.meta.url))], {
    stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, CAREER_MCP_METRICS_DISABLED: '1' },
  });
  const pending = new Map();
  let id = 0, stderr = '';
  child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-4000); });
  const lines = createInterface({ input: child.stdout });
  lines.on('line', line => {
    let message;
    try { message = JSON.parse(line); } catch { throw new Error('stdout에 JSON 외의 내용이 있습니다.'); }
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id); clearTimeout(entry.timer);
    entry.resolve({ message, response_bytes: Buffer.byteLength(line + '\n'), response_text: line,
      request_bytes: entry.bytes, request_text: entry.text, elapsed_ms: performance.now() - entry.started });
  });
  child.on('error', error => { for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(error); } pending.clear(); });
  child.on('exit', code => { for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(new Error(`MCP exit ${code}: ${stderr}`)); } pending.clear(); });
  function request(method, params) {
    const requestId = ++id;
    const text = JSON.stringify({ jsonrpc: '2.0', id: requestId, method, ...(params ? { params } : {}) }) + '\n';
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(requestId); reject(new Error('MCP 응답 시간 초과')); child.kill(); }, 30000);
      pending.set(requestId, { resolve, reject, timer, started: performance.now(), bytes: Buffer.byteLength(text), text });
      child.stdin.write(text);
    });
  }
  return { request,
    async initialize() {
      const response = await request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'career-research', version: '1' } });
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
      return { ...response, startup_ms: performance.now() - started };
    },
    async close() { if (child.exitCode !== null) return; await new Promise(resolve => { child.once('exit', resolve); child.stdin.end(); }); lines.close(); },
  };
}
