import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, resolve } from 'node:path';

// 로컬 폴더 자동 백업(사용자 요청, 2026-09-02).
//
// 클라우드 DB 하나만 믿으면 프로젝트 정지·실수 삭제로 자소서와 경험 카드가 통째로
// 사라진다. 러너는 이미 본인 세션으로 로그인해 내 컴퓨터에서 도는 프로세스라
// 파일시스템에 바로 쓸 수 있다 — 브라우저는 임의 폴더에 못 쓰므로 이 일은 러너 몫이다.
//
// RLS가 owner_id = auth.uid()로 이미 걸려 있어, 여기서 owner 필터를 따로 안 걸어도
// 본인 행만 내려온다. 그래도 의도를 드러내려고 owner가 있는 테이블은 명시적으로 건다.

// 백업 대상. run_events는 실행 로그라 양이 크고 유실돼도 재현 가치가 낮아 뺀다.
const OWNED_TABLES = [
  'profiles',
  'experience_cards',
  'job_posts',
  'calendar_events',
  'research_notes',
  'prompt_templates',
  'prompt_versions',
  'harness_configs',
  'essay_projects',
  'essay_questions',
  'essay_versions',
  'essay_autosaves',
  'interview_questions',
  'artifacts',
  'agent_runs',
];

const BACKUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6시간마다 한 번이면 충분하다.

// "~/career-atelier-backups" 같은 물결 경로를 사용자가 그대로 입력할 수 있어야 한다.
export function expandPath(input) {
  const trimmed = (input || '').trim();
  if (!trimmed) return null;
  if (trimmed === '~') return homedir();
  if (trimmed.startsWith('~/') || trimmed.startsWith('~\\')) {
    return resolve(homedir(), trimmed.slice(2));
  }
  if (!isAbsolute(trimmed)) return null; // 상대경로는 러너 실행 위치에 따라 달라져 위험하다.
  return resolve(trimmed);
}

export function shouldBackupNow(lastBackupAt, now = Date.now()) {
  if (!lastBackupAt) return true;
  const last = new Date(lastBackupAt).getTime();
  if (Number.isNaN(last)) return true;
  return now - last >= BACKUP_INTERVAL_MS;
}

export function backupFileName(date = new Date()) {
  // 하루 한 파일. 같은 날 다시 돌면 덮어써서 폴더가 무한히 커지지 않게 한다.
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `career-atelier-backup-${yyyy}-${mm}-${dd}.json`;
}

async function fetchAll(supabase, table) {
  const { data, error } = await supabase.from(table).select('*');
  if (error) throw new Error(`${table}: ${error.message}`);
  return data ?? [];
}

// 성공하면 쓴 파일 경로를, 실패하면 예외를 던진다. 호출부가 runners 행에 결과를 남긴다.
export async function runBackup(supabase, backupDir) {
  const dir = expandPath(backupDir);
  if (!dir) throw new Error('백업 폴더는 절대 경로여야 합니다 (예: ~/career-atelier-backups).');

  const tables = {};
  for (const table of OWNED_TABLES) {
    tables[table] = await fetchAll(supabase, table);
  }

  const payload = {
    product: 'Career Atelier',
    format_version: 1,
    exported_at: new Date().toISOString(),
    tables,
  };

  await mkdir(dir, { recursive: true });
  const filePath = resolve(dir, backupFileName());
  await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');

  const rowCount = Object.values(tables).reduce((sum, rows) => sum + rows.length, 0);
  return { filePath, rowCount };
}
