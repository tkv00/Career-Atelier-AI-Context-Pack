#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const releaseRepository = 'tkv00/Career-Atelier-AI-Context-Pack';
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(beta|rc)\.(0|[1-9]\d*))?$/;

function parseVersion(version) {
  const match = versionPattern.exec(version.startsWith('v') ? version.slice(1) : version);
  if (!match) return null;
  const preType = match[4];
  return [
    BigInt(match[1]),
    BigInt(match[2]),
    BigInt(match[3]),
    BigInt(preType === 'beta' ? 0 : preType === 'rc' ? 1 : 2),
    BigInt(match[5] ?? 0),
  ];
}

function compareVersions(left, right) {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] < right[index]) return -1;
    if (left[index] > right[index]) return 1;
  }
  return 0;
}

function parseArgs(argv) {
  const args = { yes: false, deploy: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--yes' || arg === '-y') args.yes = true;
    else if (arg === '--deploy') args.deploy = true;
    else if (arg === '--no-deploy') args.deploy = false;
  }
  return args;
}

function readCurrentVersion(directory = root) {
  const manifest = JSON.parse(readFileSync(resolve(directory, 'package.json'), 'utf8'));
  const currentVersion = parseVersion(manifest.version);
  if (!currentVersion) throw new Error(`package.json version is not valid: ${manifest.version}`);
  return { currentVersion, currentTag: `v${manifest.version}` };
}

async function fetchLatestReleaseTag() {
  const signal = AbortSignal.timeout(3000);
  const response = await fetch(`https://api.github.com/repos/${releaseRepository}/releases/latest`, {
    headers: {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'career-atelier-release-update',
    },
    signal,
  });
  if (!response.ok) return null;
  const data = await response.json();
  return typeof data.tag_name === 'string' ? data.tag_name : null;
}

function runCommand(command, args) {
  const display = [command, ...args].join(' ');
  console.log(`$ ${display}`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status}): ${display}`);
  }
}

const rl = Boolean(process.stdin.isTTY) && createInterface({ input: process.stdin, output: process.stdout });
const ask = async (question) => (rl ? (await rl.question(question)).trim() : '');

async function confirm(question, args) {
  if (args.yes) return true;
  if (!rl) return false;
  const answer = await ask(`${question} [y/N] `);
  return answer.toLowerCase() === 'y';
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const { currentVersion, currentTag } = readCurrentVersion();
  const latestTag = await fetchLatestReleaseTag();
  if (!latestTag) {
    console.log('No latest release tag could be read from GitHub right now. Please try again later.');
    return;
  }
  if (!versionPattern.test(latestTag.replace(/^v/, ''))) {
    console.log(`Latest tag (${latestTag}) is not a supported version pattern.`);
    return;
  }
  const latestVersion = parseVersion(latestTag);
  if (!latestVersion) return;
  if (compareVersions(currentVersion, latestVersion) >= 0) {
    console.log(`Current version is already up to date (${currentTag}).`);
    return;
  }

  console.log(`A newer release is available: ${latestTag}`);
  const shouldRun = await confirm(`Apply update to ${latestTag} and run full migration flow now?`, args);
  if (!shouldRun) {
    console.log('Skipped. You can run: npm run release:update -- --yes --deploy');
    return;
  }

  if (!existsSync(resolve(root, '.git'))) {
    throw new Error('Git repository root is required to perform release update.');
  }

  runCommand('git', ['fetch', '--all', '--tags']);
  runCommand('git', ['checkout', `tags/${latestTag}`]);
  runCommand('npm', ['install']);
  runCommand('node', ['scripts/setup.mjs', '--yes']);

  if (args.deploy || (!args.yes && (await confirm('Run Vercel deploy after migration?', args)))) {
    runCommand('npm', ['run', 'deploy', '--', '--yes']);
  }

  console.log(`Update done for ${latestTag}.`);
  console.log('Supabase migration flow was executed through scripts/setup.mjs --yes.');
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => {
  rl?.close();
});
