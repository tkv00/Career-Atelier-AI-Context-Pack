// 규칙 검사 실행기. 규칙 자체는 scripts/lib/rules.mjs에 있고 여기서는 git과
// 파일 시스템에서 사실을 모아 넘기기만 한다. 이렇게 갈라 둔 이유는, 검사 로직이
// git 없이도 임시 폴더만으로 테스트되어야 하기 때문이다(scripts/test/rules.test.mjs).

import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rules, runRules, createContext, rulesDocument, rulesDocumentPath } from './lib/rules.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function git(args, { cwd = root, allowFailure = false } = {}) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0 || result.error) {
    if (allowFailure) return null;
    throw new Error(`git ${args.join(' ')} failed: ${(result.stderr || result.error?.message || '').trim()}`);
  }
  return result.stdout;
}

// 얕은 클론(actions/checkout 기본값)에서는 base 커밋이 없을 수 있다. 그때는
// 규칙을 조용히 통과시키는 대신 건너뛴 사실을 보고서에 남긴다.
function resolveBase(base) {
  if (!base) return null;
  const merged = git(['merge-base', base, 'HEAD'], { allowFailure: true })?.trim();
  return merged || git(['rev-parse', '--verify', base], { allowFailure: true })?.trim() || null;
}

function collectChanges(base) {
  const output = git(['diff', '--name-status', '--no-renames', `${base}..HEAD`], { allowFailure: true });
  if (output === null) return null;
  const staged = git(['diff', '--name-status', '--no-renames', base], { allowFailure: true }) ?? '';
  const entries = new Map();
  for (const line of `${output}\n${staged}`.split('\n')) {
    const [status, path] = line.split('\t');
    if (status && path) entries.set(path, { status: status[0], path });
  }
  return [...entries.values()];
}

function collectCommits(base) {
  const output = git(['log', '--format=%H%x00%s', `${base}..HEAD`], { allowFailure: true });
  if (output === null) return null;
  return output.split('\n').filter(Boolean).map(line => {
    const [sha, subject] = line.split('\0');
    return { sha, subject };
  });
}

function trackedFiles() {
  const output = git(['ls-files', '-z'], { allowFailure: true });
  // git이 없거나 저장소가 아니면 파일 시스템 탐색으로 물러난다(createContext 기본 동작).
  return output === null ? undefined : output.split('\0').filter(Boolean);
}

export function report(outcome, { github = false } = {}) {
  const lines = [];
  for (const { rule, severity, violations, skipped } of outcome.results) {
    if (skipped) { lines.push(`  skip  ${rule.id}  ${rule.title} — ${skipped}`); continue; }
    if (!violations.length) { lines.push(`  pass  ${rule.id}  ${rule.title}`); continue; }
    lines.push(`  ${severity === 'warn' ? 'WARN' : 'FAIL'}  ${rule.id}  ${rule.title}`);
    for (const violation of violations) {
      lines.push(`        ${violation.file}${violation.line ? `:${violation.line}` : ''} — ${violation.message}`);
      if (github) lines.push(`::${severity === 'warn' ? 'warning' : 'error'} file=${violation.file}${violation.line ? `,line=${violation.line}` : ''},title=${rule.id} ${rule.title}::${violation.message}`);
    }
    lines.push(`        fix: ${rule.fix}`);
  }
  return lines.join('\n');
}

// GitHub 작업 요약에는 통과한 규칙까지 늘어놓지 않는다. 기여자가 봐야 하는 건
// 무엇을 고쳐야 하는지와, 검사가 실제로 돌긴 했는지 두 가지뿐이다.
export function summary(outcome, base) {
  const failing = outcome.results.filter(result => result.violations.length);
  const lines = ['## Agent rules', '', `${outcome.results.length - outcome.skipped} rules checked${base ? ` against \`${base}\`` : ''}, ${outcome.skipped} skipped, ${outcome.errors} failing, ${outcome.warnings} to review.`, ''];
  if (!failing.length) return [...lines, 'Everything the project enforces mechanically passes.', ''].join('\n');
  lines.push('| Rule | Where | What to do |', '|---|---|---|');
  for (const { rule, severity, violations } of failing) {
    for (const violation of violations) lines.push(`| ${severity === 'warn' ? 'warn' : 'fail'} ${rule.id} | \`${violation.file}${violation.line ? `:${violation.line}` : ''}\` | ${violation.message} |`);
    lines.push(`| | | **${rule.id} fix:** ${rule.fix} |`);
  }
  return [...lines, '', `Full descriptions: [docs/AGENT-RULES.md](${rulesDocumentPath}).`, ''].join('\n');
}

function main(argv) {
  const options = { only: [], base: null, strict: false, github: false, docs: false, list: false, summaryPath: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--base') options.base = argv[++index];
    else if (argument.startsWith('--base=')) options.base = argument.slice(7);
    else if (argument === '--rule') options.only.push(argv[++index]);
    else if (argument === '--strict') options.strict = true;
    else if (argument === '--github') options.github = true;
    else if (argument === '--docs') options.docs = true;
    else if (argument === '--list') options.list = true;
    // 경로 없이 --summary만 주면 GitHub이 넘겨준 요약 파일에 쓴다. 뒤 인자가
    // 또 다른 옵션이면 삼키지 않는다 — 인자 순서 때문에 조용히 어긋나는 걸 막는다.
    else if (argument === '--summary') options.summaryPath = (argv[index + 1] && !argv[index + 1].startsWith('--') ? argv[++index] : process.env.GITHUB_STEP_SUMMARY) ?? null;
    else if (argument === '--help' || argument === '-h') options.help = true;
    else throw new Error(`Unknown option: ${argument}`);
  }

  if (options.help) {
    console.log('Usage: node scripts/verify-rules.mjs [--base <ref>] [--rule CA001] [--strict] [--github] [--summary <file>] [--docs] [--list]');
    console.log('\n  --base    compare against a revision so the history-aware rules run');
    console.log('  --strict  treat warnings as failures');
    console.log('  --github  emit ::error annotations alongside the report');
    console.log('  --docs    rewrite docs/AGENT-RULES.md from the rule definitions');
    return 0;
  }
  if (options.list) {
    for (const rule of rules) console.log(`${rule.id}  ${(rule.severity ?? 'error').padEnd(5)} ${rule.title}`);
    return 0;
  }
  if (options.docs) {
    writeFileSync(resolve(root, rulesDocumentPath), rulesDocument());
    console.log(`Wrote ${rulesDocumentPath} from ${rules.length} rules.`);
    return 0;
  }

  const base = resolveBase(options.base);
  if (options.base && !base) console.warn(`warning: cannot resolve "${options.base}"; history-aware rules will be skipped (fetch-depth: 0 fixes this in CI)`);
  const context = createContext({
    root,
    files: trackedFiles(),
    base,
    changed: base ? collectChanges(base) : null,
    commits: base ? collectCommits(base) : null,
    baseRead: path => git(['show', `${base}:${path}`], { allowFailure: true }),
    strict: options.strict,
  });

  const outcome = runRules(context, options.only);
  console.log(report(outcome, { github: options.github }));
  console.log(`\n${outcome.results.length - outcome.skipped} checked, ${outcome.skipped} skipped, ${outcome.errors} failing, ${outcome.warnings} to review.`);
  if (options.summaryPath) writeFileSync(options.summaryPath, summary(outcome, options.base), { flag: 'a' });
  if (outcome.errors) console.log(`\nEach rule is explained in ${rulesDocumentPath}.`);
  return outcome.errors ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 2; }
}
