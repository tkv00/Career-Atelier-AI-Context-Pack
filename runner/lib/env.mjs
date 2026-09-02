import { readFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const runnerDir = dirname(dirname(fileURLToPath(import.meta.url)));

function loadDotEnv(path) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return;
  }
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotEnv(resolve(runnerDir, '.env'));

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`환경변수 ${name}이(가) 없습니다. runner/.env.example을 참고해 runner/.env를 만드세요.`);
  }
  return value;
}

export const env = {
  supabaseUrl: required('SUPABASE_URL'),
  supabaseAnonKey: required('SUPABASE_ANON_KEY'),
  deviceName: process.env.RUNNER_DEVICE_NAME || hostname(),
};
