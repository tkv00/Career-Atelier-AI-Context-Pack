import { mkdir, writeFile, rename, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { isAbsolute, resolve } from 'node:path';

// 본인 세션과 RLS로 읽은 업무 데이터를 로컬에 보관한다. 인증 정보는 내보내지 않는다.

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
  'source_imports',
  'education_records',
  'education_courses',
  'certifications',
  'external_activities',
  'training_programs',
  'project_records',
  'work_experiences',
  'awards',
  'record_attachments',
  'company_research_attachments',
  'essay_revision_requests',
  'essay_suggestions',
];

const BACKUP_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2시간마다 한 번.

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
  const rows = [];
  // ID順のページングでAPIの行数上限による黙った切り捨てを避ける。
  for (;;) {
    const { data, error } = await supabase.from(table).select('*').order('id').range(rows.length, rows.length + 499);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data?.length) return rows;
    rows.push(...data);
  }
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
    format_version: 2,
    exclusions: ['authentication', 'storage_binaries', 'jobs', 'runners', 'run_events', 'import_chunk_cache'],
    exported_at: new Date().toISOString(),
    tables,
  };

  await mkdir(dir, { recursive: true });
  const filePath = resolve(dir, backupFileName());
  const temporary = `${filePath}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(payload, null, 2), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    await rename(temporary, filePath);
  } finally {
    await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }

  const rowCount = Object.values(tables).reduce((sum, rows) => sum + rows.length, 0);
  return { filePath, rowCount };
}
