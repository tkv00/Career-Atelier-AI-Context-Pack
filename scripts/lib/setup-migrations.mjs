import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const HISTORY = 'supabase_migrations.schema_migrations';
const HISTORY_SQL = `create schema if not exists supabase_migrations;
create table if not exists ${HISTORY} (version text primary key, statements text[], name text);
revoke all on schema supabase_migrations from public, anon, authenticated;
revoke all on ${HISTORY} from public, anon, authenticated;`;

function literal(value) {
  return "E'" + value.replaceAll('\\', '\\\\').replaceAll("'", "''") + "'";
}

export function migrationFiles(root) {
  const directory = resolve(root, 'supabase/migrations');
  const versions = new Set();
  return readdirSync(directory).filter((file) => file.endsWith('.sql')).sort().map((file) => {
    const match = /^(\d+)_(.+)\.sql$/.exec(file);
    if (!match || versions.has(match[1])) throw new Error(`마이그레이션 파일명 또는 중복 버전을 확인하세요: ${file}`);
    versions.add(match[1]);
    return { file, version: match[1], name: match[2], sql: readFileSync(resolve(directory, file), 'utf8') };
  });
}

export function migrationTransaction(migration) {
  const { version, name, sql } = migration;
  let suffix = '';
  while (sql.includes(`$career_atelier${suffix}$`) || name.includes(`$career_atelier${suffix}$`)) suffix += 'x';
  const tag = `$career_atelier${suffix}$`;
  // 잠금 획득 후 이력을 다시 검사하므로 동시에 실행한 두 설치기가 같은 SQL을 적용하지 않는다.
  return `begin;
set local statement_timeout = '50s';
set local lock_timeout = '5s';
set local search_path = public, extensions;
select pg_advisory_xact_lock(1935763796, 1);
${HISTORY_SQL}
do ${tag}
begin
  if not exists (select 1 from ${HISTORY} where version = ${literal(version)}) then
    ${version === '0001' ? `if exists (select 1 from pg_tables where schemaname = 'public') then
      raise exception '기존 public 테이블이 있지만 0001 적용 이력이 없습니다. 스키마와 마이그레이션 이력을 대조하세요. 자동 초기화하지 않습니다.';
    end if;` : ''}
    execute ${literal(sql)};
    insert into ${HISTORY} (version, name, statements)
      values (${literal(version)}, ${literal(name)}, array[${literal(sql)}]);
  end if;
end
${tag};
commit;`;
}

export async function inspectMigrations({ root, query }) {
  const files = migrationFiles(root);
  if (!files.length) throw new Error('마이그레이션 파일이 없습니다. 저장소를 확인하세요.');
  const state = await query(`select to_regclass('${HISTORY}') is not null as history_exists,
    exists(select 1 from pg_tables where schemaname = 'public') as has_tables`, { readOnly: true });
  if (!Array.isArray(state) || typeof state[0]?.history_exists !== 'boolean' || typeof state[0]?.has_tables !== 'boolean') {
    throw new Error('Management API의 DB 상태 응답 형식을 확인할 수 없습니다.');
  }
  const history = state[0].history_exists
    ? await query(`select version, name from ${HISTORY} order by version`, { readOnly: true }) : [];
  if (!Array.isArray(history) || history.some((row) => typeof row?.version !== 'string')) {
    throw new Error('마이그레이션 이력 응답 형식이 올바르지 않습니다.');
  }
  // 다른 프로젝트나 중간 이력 유실을 정상 설치로 오인해 시딩/DDL을 반복하지 않는다.
  for (let index = 0; index < history.length; index++) {
    const row = history[index];
    if (!files.some((file) => file.version === row.version)) {
      throw new Error(`원격 DB에만 있는 마이그레이션 이력: ${row.version}${row.name ? `_${row.name}` : ''}. 해당 파일이 포함된 저장소 버전을 먼저 확보하세요. 원격 이력을 삭제하거나 전체 SQL을 재실행하지 마세요.`);
    }
    if (row.version !== files[index]?.version || (row.name && row.name !== files[index].name)) {
      throw new Error(`마이그레이션 이력이 로컬 파일 순서와 다릅니다: ${row.version}. 프로젝트와 적용 이력을 대조하세요. 자동 복구하지 않습니다.`);
    }
  }
  if (state[0].has_tables && !history.length) {
    throw new Error('기존 public 테이블(예: profiles)이 있지만 적용 이력이 없습니다. 기존 스키마·RLS·함수를 마이그레이션과 대조한 뒤 이력을 복구해야 합니다. 전체 SQL 재실행이나 --skip-migrations로 넘어가지 마세요.');
  }
  if (history.length && !state[0].has_tables) throw new Error('적용 이력은 있지만 public 테이블이 없습니다. DB 상태를 확인하세요.');
  return { files, history };
}

export async function applyMigrations({ root, query, onProgress = () => {} }) {
  const { files, history } = await inspectMigrations({ root, query });
  for (const file of files.slice(0, history.length)) onProgress(`${file.file} 이미 적용됨`);
  for (const file of files.slice(history.length)) {
    try { await query(migrationTransaction(file)); }
    catch (error) { throw new Error(`${file.file} 적용 확인 실패: ${error.message}`); }
    onProgress(`${file.file} 적용 완료`);
  }
  const verified = await query(`select version from ${HISTORY} order by version`, { readOnly: true });
  if (!Array.isArray(verified) || verified.length !== files.length || verified.some((row, index) => row?.version !== files[index].version)) {
    throw new Error('적용 후 마이그레이션 이력 검증에 실패했습니다. 설치를 완료 처리하지 않습니다.');
  }
  return { applied: files.length - history.length, skipped: history.length };
}
