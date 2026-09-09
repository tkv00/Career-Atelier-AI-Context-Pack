// 기여 규칙을 사람이 읽는 문서가 아니라 실행 가능한 검사로 정의한다.
// AGENTS.md와 CONTRIBUTING.md에 적힌 규약은 에이전트가 "읽었다"고 주장해도
// 지켰는지 확인할 방법이 없었다. 여기서는 규칙 하나가 곧 함수 하나이고,
// docs/AGENT-RULES.md는 이 배열에서 생성되므로 설명과 검사가 어긋날 수 없다.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const skipDirectories = new Set(['.git', 'node_modules', '.next', '.vercel', 'dist', 'coverage']);
const textExtensions = new Set(['.md', '.mjs', '.js', '.cjs', '.ts', '.tsx', '.json', '.sql', '.yml', '.yaml', '.css', '.txt', '.py', '.ps1', '.sh', '.html']);
// 유출 검사만은 확장자 허용 목록을 쓰지 않는다. 실제로 커밋되는 키 파일은
// id_rsa, .env, credentials처럼 확장자가 없는 경우가 대부분이라 그물을 빠져나간다.
const binaryExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.zip', '.gz', '.woff', '.woff2', '.ttf', '.otf', '.mp4', '.mov', '.xlsx', '.node']);
// web/은 클라우드 면이라 자격증명 이름 자체가 등장하면 안 된다. 유일한 예외는
// 그 이름들을 막기 위해 나열하는 가드 파일이다 (web/lib/env.ts).
const forbiddenCredentials = ['SUPABASE_SERVICE_ROLE_KEY', 'SERVICE_ROLE_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'GEMINI_API_KEY', 'GOOGLE_API_KEY'];
const credentialGuardFile = 'web/lib/env.ts';
const llmCallMarkers = ['api.openai.com', 'api.anthropic.com', 'generativelanguage.googleapis.com', "from 'openai'", 'from "openai"', '@anthropic-ai/', '@google/generative-ai', '@google/genai'];
const secretPatterns = [
  ['Anthropic API key', /sk-ant-[A-Za-z0-9_-]{20,}/],
  ['OpenAI API key', /sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}/],
  ['Supabase secret key', /sb_secret_[A-Za-z0-9_-]{16,}/],
  ['Google API key', /AIza[0-9A-Za-z_-]{35}/],
  ['GitHub token', /gh[pousr]_[A-Za-z0-9]{36,}/],
  ['private key block', /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/],
];
// 과거형·현재형 제목은 CONTRIBUTING.md가 명시적으로 금지한다("Added…", "Adds…").
const nonImperativeSubjects = /^(Added|Adds|Adding|Fixed|Fixes|Fixing|Updated|Updates|Updating|Removed|Removes|Removing|Changed|Changes|Changing|Created|Creates|Creating|Implemented|Implements|Implementing|Refactored|Refactors|Refactoring|Improved|Improves|Improving|Moved|Moves|Moving|Renamed|Renames|Renaming)\b/;

function extensionOf(path) {
  const dot = path.lastIndexOf('.'), slash = path.lastIndexOf('/');
  return dot > slash ? path.slice(dot) : '';
}

function walk(root, prefix = '') {
  const entries = [];
  for (const name of readdirSync(join(root, prefix))) {
    if (skipDirectories.has(name)) continue;
    const path = prefix ? `${prefix}/${name}` : name;
    if (statSync(join(root, path)).isDirectory()) entries.push(...walk(root, path));
    else entries.push(path);
  }
  return entries;
}

export function createContext({ root, files, changed = null, commits = null, base = null, baseRead = () => null, strict = false }) {
  const cache = new Map();
  const tracked = files ?? walk(root);
  const read = path => {
    if (!cache.has(path)) cache.set(path, existsSync(join(root, path)) && statSync(join(root, path)).isFile() ? readFileSync(join(root, path), 'utf8') : null);
    return cache.get(path);
  };
  return {
    root, base, changed, commits, strict, baseRead, read,
    files: tracked,
    exists: path => read(path) !== null,
    under: prefix => tracked.filter(path => path.startsWith(prefix)),
    text: () => tracked.filter(path => !binaryExtensions.has(extensionOf(path))),
    // 변경 경로만 빠르게 묻기 위한 헬퍼. base가 없으면 diff 규칙 자체가 건너뛰어진다.
    changedPaths: (statuses = null) => (changed ?? []).filter(entry => !statuses || statuses.includes(entry.status)).map(entry => entry.path),
  };
}

// SQL 주석과 문자열을 걷어내고 문장 단위로 자른다. 정규식 하나로 여러 줄을
// 가로지르면 `alter table a ... enable row level security`가 엉뚱한 테이블에
// 붙는 오탐이 생겨서, 세미콜론 단위로 먼저 쪼갠 뒤 문장별로 판정한다.
export function sqlStatements(sql) {
  return sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split(';')
    .map(statement => statement.replace(/\s+/g, ' ').trim().toLowerCase())
    .filter(Boolean);
}

// Windows 체크아웃은 core.autocrlf 때문에 CRLF로 떨어진다. 내용 비교 규칙이
// 줄바꿈 차이로 실패하면 모든 Windows 기여자에게 오탐이 되므로 먼저 정규화한다.
function normalize(text) {
  return text === null ? null : text.replace(/\r\n/g, '\n');
}

function tableName(raw) {
  return raw.replace(/"/g, '').replace(/^public\./, '');
}

export function migrationTables(sources) {
  const created = new Map(), secured = new Set(), policed = new Set(), dropped = new Set();
  for (const { path, sql } of sources) {
    for (const statement of sqlStatements(sql)) {
      const create = /^create table (?:if not exists )?("?[\w.]+"?)/.exec(statement);
      if (create) { const name = tableName(create[1]); if (!created.has(name)) created.set(name, path); }
      const secure = /^alter table (?:if exists )?("?[\w.]+"?) enable row level security$/.exec(statement);
      if (secure) secured.add(tableName(secure[1]));
      const policy = /^create policy (?:if not exists )?(?:"[^"]+"|[\w]+) on ("?[\w.]+"?)/.exec(statement);
      if (policy) policed.add(tableName(policy[1]));
      const drop = /^drop table (?:if exists )?("?[\w.]+"?)/.exec(statement);
      if (drop) dropped.add(tableName(drop[1]));
    }
  }
  return { created, secured, policed, dropped };
}

// 파일명 길이가 제각각이라 고정 오프셋으로 자르면 번호 대신 이름 조각이 나온다.
function migrationNumber(path) {
  return /(?:^|\/)(\d{4})_/.exec(path)?.[1] ?? null;
}

function migrationSources(context) {
  return context.under('supabase/migrations/').filter(path => path.endsWith('.sql')).sort().map(path => ({ path, sql: context.read(path) ?? '' }));
}

function dependencyNames(manifest) {
  if (!manifest) return null;
  let data;
  try { data = JSON.parse(manifest); } catch { return null; }
  return new Set([...Object.keys(data.dependencies ?? {}), ...Object.keys(data.devDependencies ?? {})]);
}

const manifests = ['package.json', 'web/package.json', 'runner/package.json'];

export const rules = [
  {
    id: 'CA001',
    title: 'Migrations are append-only',
    needs: 'diff',
    what: 'No SQL file already committed under supabase/migrations/ may be modified, renamed, or deleted.',
    why: 'Other contributors and every deployed instance have already run those files. Editing one silently produces divergent schemas that no migration can reconcile.',
    fix: 'Revert the edit and add a new supabase/migrations/00NN_name.sql that alters the schema forward.',
    check: context => context.changed
      .filter(entry => entry.path.startsWith('supabase/migrations/') && entry.path.endsWith('.sql') && entry.status !== 'A')
      .map(entry => ({ file: entry.path, message: `migration was ${entry.status === 'D' ? 'deleted' : entry.status === 'R' ? 'renamed' : 'modified'}; add a new migration instead` })),
  },
  {
    id: 'CA002',
    title: 'Migration filenames are numbered and ordered',
    what: 'Every migration is named 00NN_snake_case.sql, numbers are unique, and a newly added migration takes a number higher than every existing one.',
    why: 'Supabase applies migrations in filename order. A duplicate or lower number reorders the schema on a fresh install but not on an existing one, so the two stop matching.',
    fix: 'Rename your file to one past the highest number currently in supabase/migrations/.',
    check: context => {
      const violations = [], numbers = new Map();
      const sources = migrationSources(context);
      for (const { path } of sources) {
        const name = path.slice(path.lastIndexOf('/') + 1);
        const match = /^(\d{4})_[a-z0-9]+(?:_[a-z0-9]+)*\.sql$/.exec(name);
        if (!match) { violations.push({ file: path, message: 'name must match 00NN_snake_case.sql' }); continue; }
        if (numbers.has(match[1])) violations.push({ file: path, message: `number ${match[1]} is already used by ${numbers.get(match[1])}` });
        else numbers.set(match[1], path);
      }
      const added = new Set(context.changed ? context.changedPaths(['A']) : []);
      const highest = sources.filter(source => !added.has(source.path)).reduce((max, source) => {
        const number = migrationNumber(source.path);
        return number && number > max ? number : max;
      }, '0000');
      for (const path of added) {
        if (!path.startsWith('supabase/migrations/') || !path.endsWith('.sql')) continue;
        const number = migrationNumber(path);
        if (number && number <= highest) violations.push({ file: path, message: `number ${number} is not above the highest existing migration ${highest}` });
      }
      return violations;
    },
  },
  {
    id: 'CA003',
    title: 'Every table has RLS and an owner policy',
    what: 'Each table created in supabase/migrations/ is later given `enable row level security` and at least one `create policy`.',
    why: 'The anon key ships inside the client bundle by design, so row level security is the only boundary. A table without it is world-readable by anyone who opens devtools.',
    fix: 'Add `alter table <name> enable row level security;` and an owner policy matching supabase/migrations/0003_rls_policies.sql.',
    check: context => {
      const { created, secured, policed, dropped } = migrationTables(migrationSources(context));
      const violations = [];
      for (const [name, path] of created) {
        if (dropped.has(name)) continue;
        if (!secured.has(name)) violations.push({ file: path, message: `table "${name}" never gets "enable row level security"` });
        else if (!policed.has(name)) violations.push({ file: path, message: `table "${name}" has RLS enabled but no policy, so every read is denied` });
      }
      return violations;
    },
  },
  {
    id: 'CA004',
    title: 'web/ holds no AI or service-role credentials',
    what: `web/ may not mention ${forbiddenCredentials.join(', ')} anywhere except the guard list in ${credentialGuardFile}, which must keep listing them.`,
    why: 'web/ is the cloud plane. A provider key placed there is deployed to Vercel and billed per token, which is the exact arrangement this project exists to avoid.',
    fix: 'Move the credential to runner/, which runs on the contributor\'s own machine, and read it from runner/.env there.',
    check: context => {
      const violations = [];
      for (const path of context.under('web/')) {
        if (path === credentialGuardFile || !textExtensions.has(extensionOf(path))) continue;
        const content = context.read(path);
        if (!content) continue;
        for (const name of forbiddenCredentials) if (content.includes(name)) violations.push({ file: path, message: `references ${name}; credentials belong in runner/, not web/` });
      }
      const guard = context.read(credentialGuardFile);
      if (guard === null) violations.push({ file: credentialGuardFile, message: 'the build-time credential guard is missing' });
      else for (const name of ['SUPABASE_SERVICE_ROLE_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY']) {
        if (!guard.includes(name)) violations.push({ file: credentialGuardFile, message: `the guard no longer rejects ${name}` });
      }
      return violations;
    },
  },
  {
    id: 'CA005',
    title: 'web/ never calls a model',
    what: 'No file under web/ may reference a provider API host or import a provider SDK.',
    why: 'The two-plane split is what keeps the app free to run: web/ queues a job row, and the local runner spends the contributor\'s own subscription. A direct call from web/ reintroduces metered billing.',
    fix: 'Insert a row into the jobs table and let runner/index.mjs claim it.',
    check: context => {
      const violations = [];
      for (const path of context.under('web/')) {
        if (!textExtensions.has(extensionOf(path))) continue;
        const content = context.read(path);
        if (!content) continue;
        for (const marker of llmCallMarkers) if (content.includes(marker)) violations.push({ file: path, message: `contains "${marker}"; web/ must queue a job instead of calling a model` });
      }
      return violations;
    },
  },
  {
    id: 'CA006',
    title: 'README editions stay synchronized',
    what: 'README.md and README.ko.md are byte-identical, and README.en.md carries the same number of headings.',
    why: 'README.ko.md exists so older links keep working; it is the same document. An English edition that lags behind sends contributors setup steps that no longer exist.',
    fix: 'Apply the change to all three editions in the same commit.',
    check: context => {
      const violations = [];
      const [korean, mirror, english] = ['README.md', 'README.ko.md', 'README.en.md'].map(path => normalize(context.read(path)));
      for (const [path, content] of [['README.md', korean], ['README.ko.md', mirror], ['README.en.md', english]]) if (content === null) violations.push({ file: path, message: 'edition is missing' });
      if (korean !== null && mirror !== null && korean !== mirror) violations.push({ file: 'README.ko.md', message: 'does not match README.md byte for byte' });
      const headings = content => (content.match(/^#{1,6} /gm) ?? []).length;
      if (korean !== null && english !== null && headings(korean) !== headings(english)) {
        violations.push({ file: 'README.en.md', message: `has ${headings(english)} headings but README.md has ${headings(korean)}; one edition is ahead of the other` });
      }
      return violations;
    },
  },
  // CA007은 비워 둔다. README 이모지 금지 규칙을 두려다가, 소개 사이트 CTA에
  // 이모지를 의도적으로 쓰기로 하면서 뺐다. 관행과 어긋난 규칙은 결국 무시당하고,
  // 그러면 진짜 실패까지 같이 무시된다. 번호는 뜻이 바뀌지 않도록 재사용하지 않는다.
  {
    id: 'CA008',
    title: 'No new dependencies without a stated reason',
    severity: 'warn',
    needs: 'base',
    what: 'A dependency added to any package.json is reported for human review.',
    why: 'Every dependency is code that runs on a contributor\'s machine with their CLI subscriptions signed in. The bar is a need the standard library cannot meet, and that judgement is a person\'s to make.',
    fix: 'Say in the pull request why the standard library or an installed package cannot do it. If it can, remove the dependency.',
    check: context => {
      const violations = [];
      for (const path of manifests) {
        const before = dependencyNames(context.baseRead(path)), after = dependencyNames(context.read(path));
        if (!before || !after) continue;
        for (const name of after) if (!before.has(name)) violations.push({ file: path, message: `adds dependency "${name}"; justify it in the pull request description` });
      }
      return violations;
    },
  },
  {
    id: 'CA009',
    title: 'Schema changes regenerate the TypeScript types',
    needs: 'diff',
    what: 'If supabase/migrations/ gains a file, web/lib/supabase/database.types.ts changes too.',
    why: 'The generated types are what makes a wrong column name a build error. Left stale, they describe a database that no longer exists and every check still passes.',
    fix: 'Run `supabase gen types typescript --linked > web/lib/supabase/database.types.ts` and commit the result.',
    check: context => {
      const touched = context.changedPaths().filter(path => path.startsWith('supabase/migrations/') && path.endsWith('.sql'));
      if (!touched.length || context.changedPaths().includes('web/lib/supabase/database.types.ts')) return [];
      return [{ file: touched[0], message: 'migrations changed but web/lib/supabase/database.types.ts was not regenerated' }];
    },
  },
  {
    id: 'CA010',
    title: 'No credentials are committed',
    what: 'Tracked text files contain no API key, token, or private key matching a known provider format.',
    why: 'A key pushed to a public repository is compromised the moment it lands, and rewriting history does not un-publish it.',
    fix: 'Remove the value, rotate the key at the provider, and read it from an untracked .env file instead.',
    check: context => {
      const violations = [];
      for (const path of context.text()) {
        if (path.endsWith('package-lock.json')) continue;
        const content = context.read(path);
        if (!content || content.includes('\u0000')) continue;
        for (const [label, pattern] of secretPatterns) {
          const match = pattern.exec(content);
          if (match) violations.push({ file: path, line: content.slice(0, match.index).split('\n').length, message: `looks like a committed ${label}` });
        }
      }
      return violations;
    },
  },
  {
    id: 'CA011',
    title: 'Agent context files stay wired together',
    what: 'AGENTS.md exists and states the verification commands, CLAUDE.md delegates to it, and every MCP server named in .mcp.json points at a file that exists.',
    why: 'AGENTS.md is the single source so instructions cannot drift between Claude Code, Codex, Cursor, and Copilot. A dangling pointer means one agent silently works without the rules.',
    fix: 'Keep the guidance in AGENTS.md and leave the other files as pointers to it.',
    check: context => {
      const violations = [];
      const agents = context.read('AGENTS.md'), claude = context.read('CLAUDE.md');
      if (agents === null) violations.push({ file: 'AGENTS.md', message: 'is missing; it is the single source of agent instructions' });
      else for (const command of ['npm run verify', 'npx tsc --noEmit']) if (!agents.includes(command)) violations.push({ file: 'AGENTS.md', message: `no longer tells agents to run \`${command}\`` });
      if (claude === null) violations.push({ file: 'CLAUDE.md', message: 'is missing' });
      else if (!claude.includes('AGENTS.md')) violations.push({ file: 'CLAUDE.md', message: 'does not point at AGENTS.md, so the two can drift' });
      const config = context.read('.mcp.json');
      if (config) {
        let servers = {};
        try { servers = JSON.parse(config).mcpServers ?? {}; } catch { violations.push({ file: '.mcp.json', message: 'is not valid JSON' }); }
        for (const [name, server] of Object.entries(servers)) {
          const entry = (server.args ?? []).find(argument => typeof argument === 'string' && argument.endsWith('.mjs'));
          if (entry && !context.exists(entry)) violations.push({ file: '.mcp.json', message: `server "${name}" runs ${entry}, which does not exist` });
        }
      }
      return violations;
    },
  },
  {
    id: 'CA012',
    title: 'The rule document matches the rules',
    what: 'docs/AGENT-RULES.md is exactly what `npm run rules -- --docs` produces.',
    why: 'The document is generated from this file. Regenerating it in CI is what guarantees an agent reading the document is reading the checks that will actually run.',
    fix: 'Run `npm run rules:docs` and commit the result.',
    check: context => (normalize(context.read(rulesDocumentPath)) === rulesDocument() ? [] : [{ file: rulesDocumentPath, message: 'is out of date; run `npm run rules:docs`' }]),
  },
  {
    id: 'CA013',
    title: 'Commit subjects are English and imperative',
    needs: 'commits',
    what: 'Each subject is ASCII, at most 72 characters, starts with a capital, has no trailing period, and uses "Add" rather than "Added" or "Adds".',
    why: 'Git itself writes this way ("Merge branch..."), so the log reads as one voice. The 72-character limit is what keeps `git log --oneline` from wrapping.',
    fix: 'Rewrite the subject, for example "Add per-stage outcome tracking to the calendar".',
    check: context => {
      const violations = [];
      for (const { sha, subject } of context.commits) {
        if (subject.startsWith('Merge ') || subject.startsWith('Revert ')) continue;
        const where = { file: `commit ${sha.slice(0, 8)}` };
        if (subject.length > 72) violations.push({ ...where, message: `subject is ${subject.length} characters; keep it under 72` });
        if (/[^\x20-\x7E]/.test(subject)) violations.push({ ...where, message: 'subject must be English ASCII; keep Korean for code comments' });
        if (subject.endsWith('.')) violations.push({ ...where, message: 'subject must not end with a period' });
        if (!/^[A-Z]/.test(subject)) violations.push({ ...where, message: 'subject must start with a capital letter' });
        const tense = nonImperativeSubjects.exec(subject);
        if (tense) violations.push({ ...where, message: `"${tense[1]}" is not imperative; write the command form` });
      }
      return violations;
    },
  },
  {
    id: 'CA014',
    title: 'The Node toolchain is pinned consistently',
    what: 'All three package.json files declare the same engines.node, and .nvmrc and .node-version agree with it.',
    why: 'The runner spawns CLI subprocesses and the web app builds on Vercel. When the pinned versions disagree, a contributor reproduces a bug on a Node the maintainer never runs.',
    fix: 'Set the same range in every manifest and the same major in both version files.',
    check: context => {
      const violations = [];
      const engines = manifests.map(path => {
        const content = context.read(path);
        try { return { path, node: JSON.parse(content).engines?.node ?? null }; } catch { return { path, node: null }; }
      });
      const expected = engines[0].node;
      if (!expected) violations.push({ file: manifests[0], message: 'declares no engines.node' });
      for (const { path, node } of engines.slice(1)) if (node !== expected) violations.push({ file: path, message: `engines.node is ${node ?? 'missing'} but the root declares ${expected}` });
      const nvmrc = (context.read('.nvmrc') ?? '').trim(), nodeVersion = (context.read('.node-version') ?? '').trim();
      if (nvmrc !== nodeVersion) violations.push({ file: '.nvmrc', message: `is "${nvmrc}" but .node-version is "${nodeVersion}"` });
      const major = /(\d+)/.exec(expected ?? '')?.[1];
      if (major && nvmrc && !nvmrc.startsWith(major)) violations.push({ file: '.nvmrc', message: `pins Node ${nvmrc} but engines.node requires ${expected}` });
      return violations;
    },
  },
  {
    id: 'CA015',
    title: 'Every allowed provider is fully wired',
    what: 'Each provider slug accepted by runner/safety.mjs has a runner/providers/<slug>.mjs and is imported by runner/execute.mjs.',
    why: 'Adding a provider takes four edits across three files (docs/HARNESS-ENGINEERING.md section 7). Miss one and the failure only appears when a user picks that model in the prompt screen.',
    fix: 'Add the harness file, register the login check in runner/safety.mjs, and map the process in runner/execute.mjs.',
    check: context => {
      const safety = context.read('runner/safety.mjs'), execute = context.read('runner/execute.mjs');
      if (!safety || !execute) return [{ file: 'runner/safety.mjs', message: 'the runner harness files are missing' }];
      const allowlist = /\[([^\]]*)\]\s*\.includes\(\s*provider\s*\)/.exec(safety);
      if (!allowlist) return [{ file: 'runner/safety.mjs', message: 'no provider allowlist found; assertProvider must reject unknown providers' }];
      const violations = [];
      for (const slug of allowlist[1].match(/'([a-z0-9-]+)'/g)?.map(value => value.slice(1, -1)) ?? []) {
        if (!context.exists(`runner/providers/${slug}.mjs`)) violations.push({ file: 'runner/safety.mjs', message: `provider "${slug}" is allowed but runner/providers/${slug}.mjs does not exist` });
        if (!execute.includes(`./providers/${slug}.mjs`)) violations.push({ file: 'runner/execute.mjs', message: `provider "${slug}" is allowed but never imported here` });
      }
      return violations;
    },
  },
];

export const rulesDocumentPath = 'docs/AGENT-RULES.md';

export function runRules(context, only = null) {
  const selected = only?.length ? rules.filter(rule => only.includes(rule.id)) : rules;
  const results = selected.map(rule => {
    const missing = (rule.needs === 'diff' && !context.changed) || (rule.needs === 'commits' && !context.commits) || (rule.needs === 'base' && !context.base);
    if (missing) return { rule, skipped: `needs a base revision; pass --base <ref>`, violations: [] };
    let violations = [];
    try { violations = rule.check(context) ?? []; } catch (error) { violations = [{ file: 'scripts/lib/rules.mjs', message: `check threw: ${error.message}` }]; }
    const severity = context.strict ? 'error' : rule.severity ?? 'error';
    return { rule, severity, violations };
  });
  const count = severity => results.filter(result => result.severity === severity).reduce((total, result) => total + result.violations.length, 0);
  return { results, errors: count('error'), warnings: count('warn'), skipped: results.filter(result => result.skipped).length };
}

export function rulesDocument() {
  const lines = [
    '# Agent rules',
    '',
    '<!-- Generated by `npm run rules:docs`. Edit scripts/lib/rules.mjs, not this file. -->',
    '',
    'Every convention this project enforces mechanically, one section per check.',
    'These are the same functions `npm run rules` runs, so a rule described here is a',
    'rule that will fail your pull request, and a rule missing here is not enforced.',
    '',
    'Run them yourself before opening a pull request:',
    '',
    '```bash',
    'npm run rules                     # everything checkable from the working tree',
    'npm run rules -- --base origin/main   # adds the history-aware checks CI runs',
    '```',
    '',
    '| Rule | Severity | Checks |',
    '|---|---|---|',
    ...rules.map(rule => `| [${rule.id}](#${rule.id.toLowerCase()}-${rule.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}) | ${rule.severity ?? 'error'} | ${rule.title} |`),
    '',
  ];
  for (const rule of rules) {
    lines.push(`## ${rule.id} ${rule.title}`, '');
    if (rule.severity === 'warn') lines.push('Reported for review; does not fail the build on its own.', '');
    if (rule.needs) lines.push(`Runs only with a base revision (\`--base <ref>\`); CI supplies one on every pull request.`, '');
    lines.push(`**Checks.** ${rule.what}`, '', `**Why.** ${rule.why}`, '', `**If it fails.** ${rule.fix}`, '');
  }
  return lines.join('\n');
}
