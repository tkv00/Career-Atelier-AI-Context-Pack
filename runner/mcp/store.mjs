import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDate, parseGpa, parseList, parsePeriod } from './parse.mjs';

// 러너와 같은 사용자 세션으로 로그인한다 — service_role 키는 쓰지 않는다
// (§19.2 #2·#3). 그래서 이 서버가 쓸 수 있는 행은 RLS가 허용하는 자기 행뿐이다.
function loadEnv() {
  // URL.pathname을 쓰면 Windows에서 "/C:/..."처럼 앞에 슬래시가 붙어 경로가
  // 깨진다. 이 프로젝트는 Windows 러너를 지원하므로 fileURLToPath를 쓴다.
  const path = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.env');
  const out = {};
  try {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const at = line.indexOf('=');
      if (at > 0 && !line.trimStart().startsWith('#')) out[line.slice(0, at).trim()] = line.slice(at + 1).trim();
    }
  } catch {
    // 없으면 아래에서 process.env로 떨어진다.
  }
  return out;
}

export async function connect() {
  const env = loadEnv();
  const url = env.SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = env.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('runner/.env에 SUPABASE_URL / SUPABASE_ANON_KEY가 없습니다. npm run setup을 먼저 실행하세요.');

  let session;
  try {
    session = JSON.parse(readFileSync(resolve(homedir(), '.career-atelier', 'session.json'), 'utf8'));
  } catch {
    throw new Error('러너 로그인이 없습니다. runner 폴더에서 npm run login을 먼저 실행하세요.');
  }

  const supabase = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (error) throw new Error(`세션이 만료되었습니다(${error.message}). npm run login으로 다시 로그인하세요.`);
  return { supabase, user: data.user };
}

// numeric(4,2)는 최대 99.99다 — 만점 100 표기를 그대로 넣으면 insert가 깨진다.
// 마이그레이션 0020의 주석은 "4.5 / 4.3 / 100 등"이라 적혀 있지만 컬럼 타입이
// 그걸 못 담는다. 여기서 막고 경고로 올린다(docs/MCP-DECISION-LOG.md 참고).
const NUMERIC_4_2_MAX = 99.99;
function safeNumeric(value, warnings, label) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  const num = Number(value);
  if (num > NUMERIC_4_2_MAX) {
    warnings.push(`${label}=${num}은 컬럼 타입 numeric(4,2)의 상한(99.99)을 넘어 저장하지 않았습니다.`);
    return null;
  }
  return num;
}

const text = (value) => (value === undefined || value === null ? '' : String(value).trim());
const nullable = (value) => {
  const v = text(value);
  return v === '' ? null : v;
};

// 종류별 대상 테이블·자연키·행 생성기. 자연키는 재임포트가 중복을 쌓지 않고
// 갱신되게 하려고 둔다(비파괴 원칙 — 지우지 않고 덮어쓴다).
export const TARGETS = {
  experience: {
    table: 'experience_cards',
    key: ['title'],
    build(item, warnings) {
      const f = item.fields;
      const context = text(f.context);
      const problem = text(f.problem);
      return {
        title: item.title,
        context,
        problem,
        // situation/task는 0013 이전부터 있던 컬럼이고 not null이다. 화면 일부가
        // 아직 이쪽을 읽어서 같은 값을 넣어 둔다.
        situation: context,
        task: problem,
        role_scope: text(f.role_scope),
        judgment: text(f.judgment),
        action: text(f.action),
        result: text(f.result),
        trial_error: text(f.trial_error),
        reflection: text(f.reflection),
        metrics: parseList(f.metrics),
        tags: parseList(f.tags),
        updated_at: new Date().toISOString(),
      };
    },
  },
  education: {
    table: 'education_records',
    key: ['school_name', 'school_type'],
    build(item, warnings) {
      const f = item.fields;
      const period = f.period ? parsePeriod(f.period) : { started_on: null, ended_on: null };
      const { gpa, gpa_scale } = parseGpa(f.gpa);
      return {
        school_name: item.title,
        school_type: nullable(f.school_type) ?? '대학교',
        major: nullable(f.major),
        secondary_major: nullable(f.secondary_major),
        secondary_major_type: nullable(f.secondary_major_type),
        gpa: safeNumeric(gpa, warnings, `${item.title} 학점`),
        gpa_scale: safeNumeric(gpa_scale, warnings, `${item.title} 학점 만점`),
        started_on: parseDate(f.started_on) ?? period.started_on,
        ended_on: parseDate(f.ended_on) ?? period.ended_on,
        status: nullable(f.status),
        hanja_name: nullable(f.hanja_name),
        memo: nullable(f.memo),
        updated_at: new Date().toISOString(),
      };
    },
  },
  certification: {
    table: 'certifications',
    key: ['name'],
    build(item) {
      const f = item.fields;
      return {
        name: item.title,
        registration_number: nullable(f.registration_number),
        acquired_on: parseDate(f.acquired_on),
        issuer: nullable(f.issuer),
        grade: nullable(f.grade),
        memo: nullable(f.memo),
        updated_at: new Date().toISOString(),
      };
    },
  },
  activity: {
    table: 'external_activities',
    key: ['name'],
    build(item) {
      const f = item.fields;
      const period = f.period ? parsePeriod(f.period) : { started_on: null, ended_on: null };
      return {
        name: item.title,
        organizer: nullable(f.organizer),
        started_on: parseDate(f.started_on) ?? period.started_on,
        ended_on: parseDate(f.ended_on) ?? period.ended_on,
        role: nullable(f.role),
        detail: nullable(f.detail),
        updated_at: new Date().toISOString(),
      };
    },
  },
  training: {
    table: 'training_programs',
    key: ['name'],
    build(item) {
      const f = item.fields;
      const period = f.period ? parsePeriod(f.period) : { started_on: null, ended_on: null };
      return {
        name: item.title,
        organizer: nullable(f.organizer),
        started_on: parseDate(f.started_on) ?? period.started_on,
        ended_on: parseDate(f.ended_on) ?? period.ended_on,
        detail: nullable(f.detail),
        updated_at: new Date().toISOString(),
      };
    },
  },
  project: {
    table: 'project_records',
    key: ['name'],
    build(item) {
      const f = item.fields;
      const period = f.period ? parsePeriod(f.period) : { started_on: null, ended_on: null };
      return {
        name: item.title,
        organizer: nullable(f.organizer),
        started_on: parseDate(f.started_on) ?? period.started_on,
        ended_on: parseDate(f.ended_on) ?? period.ended_on,
        role: nullable(f.role),
        detail: nullable(f.detail),
        repo_url: nullable(f.repo_url),
        updated_at: new Date().toISOString(),
      };
    },
  },
  work: {
    table: 'work_experiences',
    key: ['company'],
    build(item) {
      const f = item.fields;
      const period = f.period ? parsePeriod(f.period) : { started_on: null, ended_on: null };
      return {
        company: item.title,
        employment_type: nullable(f.employment_type),
        started_on: parseDate(f.started_on) ?? period.started_on,
        ended_on: parseDate(f.ended_on) ?? period.ended_on,
        leave_reason: nullable(f.leave_reason),
        detail: nullable(f.detail),
        updated_at: new Date().toISOString(),
      };
    },
  },
  award: {
    table: 'awards',
    key: ['name'],
    build(item) {
      const f = item.fields;
      return {
        name: item.title,
        awarded_on: parseDate(f.awarded_on),
        issuer: nullable(f.issuer),
        grade: nullable(f.grade),
        detail: nullable(f.detail),
        updated_at: new Date().toISOString(),
      };
    },
  },
  profile: {
    table: 'profiles',
    key: ['owner_id'],
    build(item) {
      const f = item.fields;
      return {
        display_name: nullable(f.display_name) ?? item.title,
        target_roles: parseList(f.target_roles),
        interests: parseList(f.interests),
        summary: text(f.summary),
        updated_at: new Date().toISOString(),
      };
    },
  },
};

// 항목 → 행. 검증 실패는 예외를 던지지 않고 rejected로 모아 돌려준다.
export function buildRows(items) {
  const rows = [];
  const rejected = [];
  const warnings = [];

  for (const item of items) {
    const target = TARGETS[item.kind];
    if (!target) {
      rejected.push({ title: item.title, kind: item.kind, reason: '대상 테이블 없음' });
      continue;
    }
    if (!text(item.title)) {
      rejected.push({ title: '(제목 없음)', kind: item.kind, reason: '제목이 비어 있어 자연키를 만들 수 없음' });
      continue;
    }
    rows.push({ kind: item.kind, table: target.table, key: target.key, data: target.build(item, warnings) });
  }

  return { rows, rejected, warnings };
}

// 자연키로 있으면 update, 없으면 insert. 지우지 않는다.
async function upsertRow(supabase, ownerId, row) {
  const payload = { ...row.data, owner_id: ownerId };

  let query = supabase.from(row.table).select('id').eq('owner_id', ownerId);
  for (const column of row.key) {
    if (column === 'owner_id') continue;
    const value = payload[column];
    query = value === null || value === undefined ? query.is(column, null) : query.eq(column, value);
  }
  const { data: existing, error: selectError } = await query.limit(1).maybeSingle();
  if (selectError) throw new Error(`${row.table} 조회 실패: ${selectError.message}`);

  if (existing) {
    const { error } = await supabase.from(row.table).update(payload).eq('id', existing.id);
    if (error) throw new Error(`${row.table} 갱신 실패: ${error.message}`);
    return { action: 'updated', id: existing.id };
  }

  const { data, error } = await supabase.from(row.table).insert(payload).select('id').single();
  if (error) throw new Error(`${row.table} 저장 실패: ${error.message}`);
  return { action: 'created', id: data.id };
}

export async function writeRows(supabase, ownerId, rows) {
  const results = [];
  for (const row of rows) {
    try {
      const outcome = await upsertRow(supabase, ownerId, row);
      results.push({ table: row.table, title: row.data.title ?? row.data.name ?? row.data.company ?? row.data.school_name ?? row.data.display_name, ...outcome });
    } catch (error) {
      results.push({ table: row.table, title: row.data.title ?? row.data.name ?? row.data.company ?? row.data.school_name, action: 'failed', error: error.message });
    }
  }
  return results;
}

export async function countRows(supabase) {
  const counts = {};
  for (const target of new Set(Object.values(TARGETS).map((t) => t.table))) {
    const { count, error } = await supabase.from(target).select('id', { count: 'exact', head: true });
    counts[target] = error ? `ERR ${error.message}` : (count ?? 0);
  }
  return counts;
}
