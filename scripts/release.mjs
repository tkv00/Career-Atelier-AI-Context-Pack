import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const folders = ['', 'web/', 'runner/'];
const pattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(beta|rc)\.(0|[1-9]\d*))?$/;

function parse(version) {
  const match = pattern.exec(version);
  if (!match) throw new Error('Use X.Y.Z, X.Y.Z-beta.N, or X.Y.Z-rc.N (no leading zeros).');
  return [BigInt(match[1]), BigInt(match[2]), BigInt(match[3]), BigInt(match[4] === 'beta' ? 0 : match[4] === 'rc' ? 1 : 2), BigInt(match[5] ?? 0)];
}

export function checkVersions(directory = root) {
  const entries = folders.flatMap(folder => ['package.json', 'package-lock.json'].map(file => {
    const path = resolve(directory, folder, file);
    return { path, file, data: JSON.parse(readFileSync(path, 'utf8')) };
  }));
  const version = entries[0].data.version;
  parse(version);
  if (!/^npm@\d+\.\d+\.\d+$/.test(entries[0].data.packageManager ?? '')) throw new Error('Pin an exact npm packageManager version.');
  for (const { path, file, data } of entries) {
    if (data.version !== version) throw new Error(`Version mismatch: ${path}`);
    if (file === 'package-lock.json' && data.packages?.['']?.version !== version) throw new Error(`Lock root mismatch: ${path}`);
    if (file === 'package.json' && (data.private !== true || data.license !== 'MIT' || data.packageManager !== entries[0].data.packageManager)) throw new Error(`Package policy mismatch: ${path}`);
  }
  return { version, entries };
}

export function prepareVersion(version, directory = root, write = false) {
  const next = parse(version);
  const { version: previous, entries } = checkVersions(directory);
  const current = parse(previous);
  const different = next.findIndex((part, i) => part !== current[i]);
  if (different < 0 || next[different] < current[different]) throw new Error('The next version must be greater than the current version.');
  // 모든 파일을 먼저 검사해 잘못된 버전·잠금 파일 때문에 일부만 갱신되는 일을 막는다.
  const updates = entries.map(({ path, file, data }) => {
    data.version = version;
    if (file === 'package-lock.json') data.packages[''].version = version;
    return { path, content: JSON.stringify(data, null, 2) + '\n' };
  });
  if (write) for (const { path, content } of updates) writeFileSync(path, content);
  return `${previous} -> ${version}: ${updates.length} files (${write ? 'written' : 'dry run; add --write to apply'})`;
}

export function releaseNotes(tag, directory = root) {
  const { version } = checkVersions(directory);
  if (tag !== `v${version}`) throw new Error('Tag must match the package version exactly.');
  const changelog = readFileSync(resolve(directory, 'CHANGELOG.md'), 'utf8');
  const marker = `## [${version}] - `;
  const section = changelog.split('\n').findIndex(line => line.startsWith(marker));
  if (section < 0) throw new Error('Add a dated CHANGELOG section for this release first.');
  const lines = changelog.split('\n').slice(section);
  const date = lines[0].slice(marker.length);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new Error('Use a valid YYYY-MM-DD release date.');
  const end = lines.findIndex((line, i) => i > 0 && line.startsWith('## '));
  const result = lines.slice(0, end < 0 ? undefined : end).join('\n').trim();
  if (!/^[-*] .+/m.test(result)) throw new Error('Release notes must contain at least one change.');
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [command, value, flag] = process.argv.slice(2);
    if (command === 'check' && !value) console.log(`Package versions agree: ${checkVersions().version}`);
    else if (command === 'prepare' && value && (!flag || flag === '--write') && process.argv.length <= 5) console.log(prepareVersion(value, root, flag === '--write'));
    else if (command === 'notes' && value && !flag) console.log(releaseNotes(value));
    else throw new Error('Usage: release.mjs check | prepare X.Y.Z [--write] | notes vX.Y.Z');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
