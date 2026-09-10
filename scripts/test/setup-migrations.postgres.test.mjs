import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { applyMigrations, migrationFiles, migrationTransaction } from '../lib/setup-migrations.mjs';

const bin = process.env.CA_TEST_POSTGRES_BIN;
const root = fileURLToPath(new URL('../../', import.meta.url));

test('isolated PostgreSQL migration execution', { skip: !bin, timeout: 120_000 }, async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'career-atelier-pg-test-'));
  const data = join(directory, 'data');
  const executable = (name) => join(bin, name + (process.platform === 'win32' ? '.exe' : ''));
  const command = (name, args, input) => {
    const result = spawnSync(executable(name), args, { input, encoding: 'utf8', windowsHide: true, timeout: 30_000 });
    if (result.status !== 0) throw new Error(`${name}: ${result.stderr || result.error?.message || result.stdout}`);
    return result.stdout.trim();
  };
  let started = false;
  t.after(() => {
    if (started) command('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop']);
    // 이번 테스트가 만든 임시 클러스터만 삭제한다. 사용자 DB 경로는 받지 않는다.
    const target = resolve(directory);
    assert.equal(dirname(target), resolve(tmpdir()));
    assert.ok(basename(target).startsWith('career-atelier-pg-test-'));
    rmSync(target, { recursive: true, force: true });
  });
  const server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  command('initdb', ['-D', data, '-U', 'postgres', '--auth=trust', '--no-locale', '--encoding=UTF8']);
  const serverLog = join(directory, 'server.log');
  try {
    // 배포판 기본 소켓 폴더는 일반 CI 사용자에게 쓰기 권한이 없을 수 있다.
    command('pg_ctl', ['-D', data, '-l', serverLog, '-o', `-h 127.0.0.1 -k ${directory} -p ${port} -F`, '-w', 'start']);
  } catch (error) {
    // pg_ctl의 짧은 안내 대신 서버 원인을 CI 로그에 남겨 재현 없이도 진단한다.
    const detail = existsSync(serverLog) ? readFileSync(serverLog, 'utf8').trim() : 'server.log가 생성되지 않았습니다.';
    throw new Error(`${error.message}\n${detail}`);
  }
  started = true;
  const args = ['-X', '--no-password', '-h', '127.0.0.1', '-p', String(port), '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-Atq'];
  const sql = (input) => command('psql', args, input);
  const rows = (input) => JSON.parse(sql(`select coalesce(json_agg(row_to_json(t)), '[]'::json) from (${input}) t;`));
  const concurrentSql = (input) => new Promise((resolve, reject) => {
    const child = spawn(executable('psql'), args, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let error = '';
    child.stdout.resume();
    child.stderr.on('data', (chunk) => { error += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(error)));
    child.stdin.end(input);
  });
  // Supabase 서비스 자체 대신 마이그레이션이 참조하는 최소 카탈로그만 제공한다.
  sql(`create role anon; create role authenticated; create role supabase_auth_admin;
    create schema auth; create schema storage; create schema extensions;
    create table auth.users(id uuid primary key, email text);
    create function auth.uid() returns uuid language sql as 'select null::uuid';
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint);
    create table storage.objects(id uuid primary key, bucket_id text, name text);
    create function storage.foldername(text) returns text[] language sql as 'select string_to_array($1, ''/'')';
    insert into auth.users(id,email) values
      ('00000000-0000-4000-8000-000000000001','migration-test@example.invalid'),
      ('00000000-0000-4000-8000-000000000002','other@example.invalid');`);
  const query = async (input, options) => options?.readOnly ? rows(input) : (sql(input), []);
  const files = migrationFiles(root);

  await t.test('all repository migrations execute with atomic history', async () => {
    assert.deepEqual(await applyMigrations({ root, query }), { applied: files.length, skipped: 0 });
    assert.equal(rows('select count(*)::int as count from supabase_migrations.schema_migrations')[0].count, files.length);
    assert.equal(rows("select count(*)::int as count from pg_tables where schemaname = 'public' and not rowsecurity")[0].count, 0);
  });
  await t.test('rerun preserves seeded user data and skips all migrations', async () => {
    const before = rows('select * from public.prompt_templates order by id');
    assert.ok(before.length > 0);
    assert.deepEqual(await applyMigrations({ root, query }), { applied: 0, skipped: files.length });
    assert.deepEqual(rows('select * from public.prompt_templates order by id'), before);
  });
  await t.test('source import owner boundary, atomic receipt, replay and stale update', () => {
    const owner='00000000-0000-4000-8000-000000000001';
    const other='00000000-0000-4000-8000-000000000002';
    const batch='00000000-0000-4000-8000-000000000003';
    sql(`create or replace function auth.uid() returns uuid language sql as 'select nullif(current_setting(''test.uid'',true),'''')::uuid';
      grant usage on schema public,auth to authenticated; grant all on all tables in schema public to authenticated;
      insert into source_imports(id,owner_id,name,source_type,status,revision,candidates) values('${batch}','${owner}','fixture','text','committing',1,'[{"kind":"experience","title":"합성 경험"},{"kind":"experience","title":"합성 경험"}]');`);
    const asUser=(id,statement)=>sql(`set role authenticated;set test.uid='${id}';${statement}`);
    assert.equal(asUser(other,`select count(*) from source_imports where id='${batch}';`),'0');
    assert.throws(()=>asUser(other,`select commit_import_candidate('${batch}',1,0,'experience_cards','{"title":"합성 경험"}');`));
    const call=`select commit_import_candidate('${batch}',1,0,'experience_cards','{"title":"합성 경험"}');`;
    const first=JSON.parse(asUser(owner,call));
    assert.equal(JSON.parse(asUser(owner,call)).id,first.id);
    assert.equal(asUser(owner,"select count(*) from experience_cards where title='합성 경험';"),'1');
    assert.throws(()=>asUser(owner,`select commit_import_candidate('${batch}',1,1,'experience_cards','{"title":"바뀜"}','${first.id}','2000-01-01');`),/기존 기록/);
    assert.equal(asUser(owner,`select receipts ? '1' from source_imports where id='${batch}';`),'f');
    assert.throws(()=>asUser(owner,`select commit_import_candidate('${batch}',1,1,'experience_cards','{"owner_id":"${other}"}');`),/허용되지/);
    assert.throws(()=>asUser(owner,`select commit_import_candidate('${batch}',2,1,'experience_cards','{"title":"합성 경험"}');`),/버전/);
  });
  await t.test('queue functions enforce owner and approval and seed helpers are private', () => {
    const owner = '00000000-0000-4000-8000-000000000001';
    const other = '00000000-0000-4000-8000-000000000002';
    const runner = '00000000-0000-4000-8000-000000000044';
    const job = '00000000-0000-4000-8000-000000000045';
    sql(`insert into runners(id,owner_id,device_name,fingerprint,approved,last_seen_at) values('${runner}','${owner}','test','queue-test',false,now()-interval '10 minutes');
      insert into jobs(id,owner_id,kind,payload,harness_snapshot) values('${job}','${owner}','writer','{}','{}');`);
    const asUser = (id, query) => sql(`set role authenticated; set test.uid='${id}'; ${query}`);
    assert.throws(() => asUser(owner, `select claim_next_job('${runner}');`), /승인/);
    sql(`update runners set approved=true where id='${runner}';`);
    assert.throws(() => asUser(other, `select claim_next_job('${runner}');`), /승인/);
    assert.equal(asUser(owner, `select (claim_next_job('${runner}')).status;`), 'running');
    asUser(other, 'select reap_stale_jobs();');
    assert.equal(sql(`select status from jobs where id='${job}';`), 'running');
    asUser(owner, 'select reap_stale_jobs();');
    assert.equal(sql(`select status from jobs where id='${job}';`), 'queued');
    assert.equal(sql("select has_function_privilege('anon','public.seed_default_prompts(uuid)','execute');"), 'f');
    assert.equal(sql("select has_function_privilege('anon','public.reap_stale_jobs()','execute');"), 'f');
    assert.equal(sql("select 100::numeric(5,2);"), '100.00');
    assert.equal(sql("select numeric_precision from information_schema.columns where table_name='education_records' and column_name='gpa_scale';"), '5');
  });
  await t.test('DDL rolls back when a later SQL statement fails', () => {
    assert.throws(() => sql(migrationTransaction({ version: '9001', name: 'broken', sql: 'create table public.must_rollback(id int); select 1/0;' })), /division by zero/);
    assert.equal(rows("select to_regclass('public.must_rollback') is null as absent")[0].absent, true);
    assert.equal(rows("select count(*)::int as count from supabase_migrations.schema_migrations where version='9001'")[0].count, 0);
  });
  await t.test('DDL rolls back when history insertion fails', () => {
    sql("alter table supabase_migrations.schema_migrations add constraint test_reject_version check (version <> '9002');");
    assert.throws(() => sql(migrationTransaction({ version: '9002', name: 'history_failure', sql: 'create table public.history_must_rollback(id int);' })), /test_reject_version/);
    assert.equal(rows("select to_regclass('public.history_must_rollback') is null as absent")[0].absent, true);
  });
  await t.test('two concurrent installers execute one migration once', async () => {
    const transaction = migrationTransaction({ version: '9003', name: 'concurrent', sql: 'create table public.once_only(id int); insert into public.once_only values (1); select pg_sleep(0.2);' });
    await Promise.all([concurrentSql(transaction), concurrentSql(transaction)]);
    assert.equal(rows('select count(*)::int as count from public.once_only')[0].count, 1);
  });
  await t.test('quotes, backslashes, nested dollar tags survive SQL transport', () => {
    const migration = { version: '9004', name: 'quoted', sql: "create table public.quoted(value text); insert into public.quoted values ($value$한글 ' \\ $career_atelier$ $career_atelierx$ $value$);" };
    sql(migrationTransaction(migration));
    assert.equal(rows("select statements[1] as sql from supabase_migrations.schema_migrations where version='9004'")[0].sql, migration.sql);
    assert.match(rows('select value from public.quoted')[0].value, /한글/);
  });
  await t.test('existing owners cannot be replaced through signup or the private guard', () => {
    assert.equal(sql('select count(*) from auth.users;'), '2');
    assert.throws(() => sql("insert into auth.users(id,email) values ('00000000-0000-4000-8000-000000000099','third@example.invalid');"), /이미 소유자/);
    assert.equal(sql("select has_schema_privilege('authenticated','career_atelier_private','usage');"), 'f');
    assert.equal(sql("select has_table_privilege('authenticated','career_atelier_private.instance_owner','insert');"), 'f');
  });
  await t.test('first signup is atomic across concurrent transactions and rolls back cleanly', async () => {
    // 사용자 DB가 아닌 이번 테스트의 임시 클러스터에서만 첫 가입 상태를 만든다.
    sql('truncate auth.users cascade; truncate career_atelier_private.instance_owner;');
    const first = '00000000-0000-4000-8000-000000000091';
    const second = '00000000-0000-4000-8000-000000000092';
    const results = await Promise.allSettled([first, second].map(id => concurrentSql(`begin; insert into auth.users(id,email) values ('${id}','${id}@example.invalid'); select pg_sleep(0.2); commit;`)));
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter(result => result.status === 'rejected').length, 1);
    assert.equal(sql('select count(*) from auth.users;'), '1');
    assert.equal(sql('select count(*) from career_atelier_private.instance_owner g join auth.users u on g.owner_id=u.id;'), '1');
    sql('truncate auth.users cascade; truncate career_atelier_private.instance_owner;');
    sql(`begin; insert into auth.users(id,email) values ('${first}','rollback@example.invalid'); rollback;`);
    assert.equal(sql('select count(*) from career_atelier_private.instance_owner;'), '0');
    sql(`insert into auth.users(id,email) values ('${second}','success@example.invalid');`);
    assert.equal(sql('select owner_id from career_atelier_private.instance_owner;'), second);
  });
});
