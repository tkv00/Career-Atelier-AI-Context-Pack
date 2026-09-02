#!/usr/bin/env node
// v1(local SQLite) 백업 JSON → v2 Supabase 이관 (docs/DESIGN-V2-CLOUD.md §15)
//
// 사용법:
//   SUPABASE_URL=https://xxx.supabase.co SUPABASE_ANON_KEY=... \
//     node migrate.mjs /path/to/career-atelier-backup-YYYY-MM-DD.json
//
// 백업 파일은 v1 앱의 "GET /api/export/download" (설정 화면 → 전체 내보내기)로 받는다.
//
// 절대 규칙 (§19.2 #2, #3):
//   - service_role 키를 쓰지 않는다. 이 스크립트는 본인 계정으로 로그인한 뒤,
//     RLS가 그대로 걸린 상태로 자기 자신의 데이터만 insert한다.
//   - 삭제 연산이 없다. 이미 존재하는 v2 데이터를 건드리지 않고 새 행만 추가한다
//     (v1 비파괴 병합 원칙 계승).
//   - settings 테이블은 이관하지 않는다 — v2에는 그 테이블 자체가 없다(§5).

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import process from 'node:process';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`환경변수 ${name}이(가) 필요합니다.`);
    process.exit(1);
  }
  return value;
}

const supabaseUrl = requireEnv('SUPABASE_URL');
const supabaseAnonKey = requireEnv('SUPABASE_ANON_KEY');
const backupPath = process.argv[2];
if (!backupPath) {
  console.error('사용법: node migrate.mjs <백업 JSON 경로>');
  process.exit(1);
}

const backup = JSON.parse(readFileSync(resolve(backupPath), 'utf8'));
if (backup.product && backup.product !== 'Career Atelier') {
  console.error('Career Atelier v1에서 내보낸 백업이 아닙니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function signIn() {
  const preToken = process.env.SUPABASE_ACCESS_TOKEN;
  if (preToken) {
    // 자동화된 재실행/검증용 통로. 대화형 OTP를 대체할 뿐 service_role은 아니다.
    const { data, error } = await supabase.auth.setSession({
      access_token: preToken,
      refresh_token: process.env.SUPABASE_REFRESH_TOKEN || preToken,
    });
    if (error) throw error;
    return data.session;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const email = (await rl.question('Supabase 로그인 이메일: ')).trim();
  const { error: otpError } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  if (otpError) {
    await rl.close();
    throw otpError;
  }
  const code = (await rl.question('이메일로 받은 6자리 코드: ')).trim();
  await rl.close();
  const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
  if (error) throw error;
  return data.session;
}

function nowIso() {
  return new Date().toISOString();
}

async function insertOne(table, row) {
  const { data, error } = await supabase.from(table).insert(row).select().single();
  if (error) throw new Error(`${table} 삽입 실패: ${error.message}\n행: ${JSON.stringify(row)}`);
  return data;
}

async function run() {
  const session = await signIn();
  const ownerId = session.user.id;
  console.log(`로그인 성공: ${session.user.email} (owner_id=${ownerId})`);

  // 기존 문자열 id(v1 시드 데이터는 'job-naver-pm' 같은 비-uuid를 쓴다)를
  // 새 uuid로 매핑하고 매핑표를 보존한다(§15 "매핑표 보존").
  const idMap = { job: new Map(), essay: new Map(), promptTemplate: new Map(), run: new Map(), pipeline: new Map() };
  const stats = {};
  const mapId = (kind, oldId) => {
    if (oldId == null) return null;
    const map = idMap[kind];
    if (!map.has(oldId)) map.set(oldId, randomUUID());
    return map.get(oldId);
  };

  if (backup.profile && typeof backup.profile === 'object') {
    await insertOne('profiles', {
      owner_id: ownerId,
      display_name: backup.profile.display_name || '사용자',
      target_roles: backup.profile.target_roles || [],
      interests: backup.profile.interests || [],
      summary: backup.profile.summary || '',
    });
    stats.profile = 1;
  }

  stats.experiences = 0;
  for (const item of backup.experiences || []) {
    await insertOne('experience_cards', {
      owner_id: ownerId,
      title: item.title || '제목 없는 경험',
      situation: item.situation || '',
      task: item.task || '',
      action: item.action || '',
      result: item.result || '',
      metrics: item.metrics || [],
      tags: item.tags || [],
    });
    stats.experiences += 1;
  }

  stats.jobs = 0;
  for (const item of backup.jobs || []) {
    const inserted = await insertOne('job_posts', {
      owner_id: ownerId,
      company: item.company || '회사 미정',
      role: item.role || '직무 미정',
      url: item.url || '',
      deadline: item.deadline || null,
      status: item.status || 'saved',
      fit_score: Number(item.fit_score || 0),
      description: item.description || '',
      requirements: item.requirements || [],
      source: item.source || '',
    });
    idMap.job.set(item.id, inserted.id);
    stats.jobs += 1;
  }

  stats.research = 0;
  for (const item of backup.research || []) {
    await insertOne('research_notes', {
      owner_id: ownerId,
      job_id: mapId('job', item.job_id),
      kind: item.kind || 'company',
      title: item.title || '제목 없는 조사',
      body: item.body || '',
      sources: item.sources || [],
      provider: item.provider || '',
    });
    stats.research += 1;
  }

  stats.prompts = 0;
  for (const item of backup.prompts || []) {
    if (!item.agent_id || !item.body) continue;
    const inserted = await insertOne('prompt_templates', {
      owner_id: ownerId,
      agent_id: item.agent_id,
      name: item.name || item.agent_id,
      body: item.body,
      variables: item.variables || [],
      version: Number(item.version || 1),
      is_active: item.is_active !== false,
    });
    idMap.promptTemplate.set(item.id, inserted.id);
    await insertOne('prompt_versions', {
      owner_id: ownerId,
      template_id: inserted.id,
      version: Number(item.version || 1),
      body: item.body,
    });
    stats.prompts += 1;
  }

  stats.harnesses = 0;
  for (const item of backup.harnesses || []) {
    await insertOne('harness_configs', {
      owner_id: ownerId,
      name: item.name || '가져온 하네스',
      provider_map: item.provider_map || {},
      config: item.config || {},
    });
    stats.harnesses += 1;
  }

  stats.essays = 0;
  for (const item of backup.essays || []) {
    const inserted = await insertOne('essay_projects', {
      owner_id: ownerId,
      job_id: mapId('job', item.job_id),
      title: item.title || '가져온 자소서',
      question: item.question || '',
      draft: item.draft || '',
      target_chars: Number(item.target_chars || 700),
      status: item.status || 'draft',
    });
    idMap.essay.set(item.id, inserted.id);
    stats.essays += 1;
  }

  stats.versions = 0;
  for (const item of backup.versions || []) {
    const essayId = mapId('essay', item.essay_id);
    if (!essayId) continue;
    const content = String(item.content || '');
    await insertOne('essay_versions', {
      owner_id: ownerId,
      essay_id: essayId,
      version: Number(item.version || 1),
      content,
      chars_with_spaces: content.length,
      chars_without_spaces: content.replace(/\s/g, '').length,
      note: item.note || 'v1에서 이관됨',
    });
    stats.versions += 1;
  }

  stats.runs = 0;
  for (const item of backup.runs || []) {
    const inserted = await insertOne('agent_runs', {
      owner_id: ownerId,
      pipeline_id: item.pipeline_id ? mapId('pipeline', item.pipeline_id) : null,
      agent_id: item.agent_id || 'review',
      provider: item.provider || 'codex',
      status: ['queued', 'running'].includes(item.status) ? 'cancelled' : item.status || 'completed',
      prompt: item.prompt || '',
      output: item.output || '',
      error: ['queued', 'running'].includes(item.status) ? 'v1에서 중단된 채로 이관된 실행입니다.' : item.error || '',
      started_at: item.started_at || null,
      finished_at: item.finished_at || nowIso(),
    });
    idMap.run.set(item.id, inserted.id);
    stats.runs += 1;
  }

  stats.run_events = 0;
  for (const item of backup.run_events || []) {
    const runId = mapId('run', item.run_id);
    if (!runId) continue;
    await insertOne('run_events', {
      owner_id: ownerId,
      run_id: runId,
      sequence: Number(item.sequence),
      kind: item.kind || 'event',
      payload: typeof item.payload === 'string' ? JSON.parse(item.payload) : item.payload || {},
    });
    stats.run_events += 1;
  }

  stats.artifacts = 0;
  for (const item of backup.artifacts || []) {
    await insertOne('artifacts', {
      owner_id: ownerId,
      pipeline_id: item.pipeline_id ? mapId('pipeline', item.pipeline_id) : null,
      run_id: item.run_id ? mapId('run', item.run_id) : null,
      kind: item.kind || 'imported',
      title: item.title || '가져온 문서',
      content: item.content || '',
      metadata: item.metadata || {},
    });
    stats.artifacts += 1;
  }

  const mapDir = resolve(dirname(backupPath), 'v2-migration');
  mkdirSync(mapDir, { recursive: true });
  const mapFile = resolve(mapDir, `id-map-${Date.now()}.json`);
  writeFileSync(
    mapFile,
    JSON.stringify(
      {
        migrated_at: nowIso(),
        owner_id: ownerId,
        id_map: Object.fromEntries(Object.entries(idMap).map(([kind, map]) => [kind, Object.fromEntries(map)])),
      },
      null,
      2,
    ),
  );

  console.log('\n이관 완료:');
  console.table(stats);
  console.log(`id 매핑표 저장: ${mapFile}`);
}

run().catch((error) => {
  console.error('이관 실패:', error.message);
  process.exit(1);
});
