import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { migrationFiles } from './setup-migrations.mjs';

const MARKER = '.career-atelier-migrations.json';

export function databaseFingerprint(root) {
  const hash = createHash('sha256');
  for (const migration of migrationFiles(root)) {
    hash.update(migration.file).update('\0').update(migration.sql).update('\0');
  }
  return hash.digest('hex');
}

export function projectRefFromUrl(value) {
  let hostname;
  try { hostname = new URL(value).hostname; }
  catch { throw new Error('Supabase URL 형식이 올바르지 않습니다. npm run setup으로 연결을 다시 확인하세요.'); }
  const match = /^([a-z]{20})\.supabase\.co$/.exec(hostname);
  if (!match) throw new Error('기존 Supabase 프로젝트 ref를 URL에서 확인할 수 없습니다. npm run setup으로 연결을 다시 확인하세요.');
  return match[1];
}

export function databaseIsCurrent(root, projectRef) {
  const path = resolve(root, MARKER);
  if (!existsSync(path)) return false;
  try {
    const marker = JSON.parse(readFileSync(path, 'utf8'));
    return marker.project_ref === projectRef && marker.fingerprint === databaseFingerprint(root);
  } catch {
    return false;
  }
}

export function markDatabaseCurrent(root, projectRef) {
  writeFileSync(resolve(root, MARKER), `${JSON.stringify({
    project_ref: projectRef,
    fingerprint: databaseFingerprint(root),
  }, null, 2)}\n`, { mode: 0o600 });
}
