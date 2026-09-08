import { createHash, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { env } from '../../../runner/lib/env.mjs';
import { loadSession } from '../../../runner/lib/session-store.mjs';
import { csv, measureCitationRun, summarizeCitationRuns } from './metrics.mjs';

const requireRunner = createRequire(new URL('../../../runner/package.json', import.meta.url));
const { createClient } = requireRunner('@supabase/supabase-js');

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

function positiveInteger(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1000) throw new Error(`${name}은 1~1000 정수여야 합니다.`);
  return parsed;
}

const limit = positiveInteger(argument('--limit', '100'), '--limit');
const since = argument('--since', null);
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputDir = resolve(argument('--out', resolve('docs/research/writer-citation-utilization/results', stamp)));

if (since && Number.isNaN(Date.parse(since))) throw new Error('--since은 ISO 날짜여야 합니다. 예: 2026-09-01');

const storedSession = await loadSession();
if (!storedSession) throw new Error('저장된 러너 로그인이 없습니다. 먼저 저장소 루트에서 npm run login을 실행하세요.');
let session;
try {
  session = JSON.parse(storedSession);
} catch {
  throw new Error('저장된 러너 세션 형식이 올바르지 않습니다. npm run login으로 다시 로그인하세요.');
}
if (!session.access_token || (session.supabase_url && new URL(session.supabase_url).origin !== new URL(env.supabaseUrl).origin)) {
  throw new Error('저장된 러너 세션과 runner/.env의 Supabase 프로젝트가 일치하지 않습니다.');
}

// 실행 중인 러너와 refresh token을 공유해 회전시키지 않는다. 현재 access token으로
// RLS가 적용된 읽기 요청만 보내며 토큰이 만료됐다면 재로그인을 안내하고 끝낸다.
const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { headers: { Authorization: `Bearer ${session.access_token}` } },
});

let query = supabase
  .from('agent_runs')
  .select('id,provider,status,started_at,finished_at,output')
  .eq('agent_id', 'writer')
  .eq('status', 'completed')
  .order('started_at', { ascending: false })
  .limit(limit);
if (since) query = query.gte('started_at', new Date(since).toISOString());

const { data: runs, error: runsError } = await query;
if (runsError) throw runsError;

const runIds = (runs ?? []).map((run) => run.id);
let events = [];
if (runIds.length) {
  const { data, error } = await supabase
    .from('run_events')
    .select('run_id,payload')
    .eq('kind', 'context_selection')
    .in('run_id', runIds)
    .limit(5000);
  if (error) throw error;
  events = data ?? [];
}

const contextByRun = new Map(events.map((event) => [event.run_id, event.payload]));
const exportSalt = randomBytes(32);
const anonymize = (id) => createHash('sha256').update(exportSalt).update(id).digest('hex').slice(0, 12);
const records = (runs ?? []).map((run) => ({
  run_key: anonymize(run.id),
  date: run.started_at?.slice(0, 10) ?? null,
  provider: run.provider,
  ...measureCitationRun({ manifest: contextByRun.get(run.id), output: run.output }),
}));
const summary = summarizeCitationRuns(records);

mkdirSync(outputDir, { recursive: true });
writeFileSync(resolve(outputDir, 'runs.csv'), csv(records));
writeFileSync(resolve(outputDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
writeFileSync(resolve(outputDir, 'README.md'), [
  '# Writer citation-utilization measurement',
  '',
  `Generated: ${summary.generated_at}`,
  `Completed writer runs found: ${summary.runs_found}`,
  `Runs with both context selection and structured evidence: ${summary.runs_measured}`,
  '',
  'This export contains counts, ratios, provider names, dates, and per-export anonymous run keys.',
  'It does not contain prompts, drafts, quoted facts, card IDs, user IDs, or credentials.',
  '',
  'Interpret citation_utilization as cited provided cards / provided cards, not as a model read rate.',
  'See ../../README.ko.md for the metric contract and limitations.',
  '',
].join('\n'));

console.log(JSON.stringify({ output: outputDir, ...summary }, null, 2));
