import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkVersions, prepareVersion, releaseNotes } from '../release.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'career-release-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const dir of ['', 'web', 'runner']) {
    mkdirSync(join(root, dir), { recursive: true });
    writeFileSync(join(root, dir, 'package.json'), JSON.stringify({ version: '0.1.0', private: true, license: 'MIT', packageManager: 'npm@10.9.2' }));
    writeFileSync(join(root, dir, 'package-lock.json'), JSON.stringify({ version: '0.1.0', packages: { '': { version: '0.1.0' }, 'node_modules/example': { version: '9.8.7' } } }));
  }
  return root;
}

test('release dry run preserves files; write synchronizes all manifests without changing dependency versions', t => {
  const root = fixture(t);
  prepareVersion('0.2.0-beta.1', root);
  assert.equal(checkVersions(root).version, '0.1.0');
  prepareVersion('0.2.0-beta.1', root, true);
  assert.equal(checkVersions(root).version, '0.2.0-beta.1');
  assert.equal(JSON.parse(readFileSync(join(root, 'runner/package-lock.json'))).packages['node_modules/example'].version, '9.8.7');
  prepareVersion('0.2.0-rc.1', root, true);
  prepareVersion('0.2.0', root, true);
});

test('invalid or backward versions and inconsistent locks stop preparation', t => {
  const root = fixture(t);
  for (const version of ['v0.2.0', '0.2.0-beta.01', '0.0.9', '0.1.0', '0.1.0-rc.1']) assert.throws(() => prepareVersion(version, root, true));
  writeFileSync(join(root, 'web/package-lock.json'), JSON.stringify({ version: '0.1.0', packages: { '': { version: '0.0.1' } } }));
  assert.throws(() => prepareVersion('0.2.0', root, true), /Lock root mismatch/);
  assert.equal(JSON.parse(readFileSync(join(root, 'package.json'))).version, '0.1.0');
});

test('release requires a matching tag and nonempty version-specific notes', t => {
  const root = fixture(t);
  writeFileSync(join(root, 'CHANGELOG.md'), '# Changelog\n\n## [Unreleased]\n- Future work\n');
  assert.throws(() => releaseNotes('v0.1.0', root), /dated/);
  writeFileSync(join(root, 'CHANGELOG.md'), '## [0.1.0] - 2026-02-31\n- Invalid date\n');
  assert.throws(() => releaseNotes('v0.1.0', root), /valid YYYY/);
  writeFileSync(join(root, 'CHANGELOG.md'), '## [0.1.0] - 2026-09-07\n');
  assert.throws(() => releaseNotes('v0.1.0', root), /at least one/);
  writeFileSync(join(root, 'CHANGELOG.md'), '# Changelog\n\n## [0.1.0] - 2026-09-07\n- Initial release\n\n## [0.0.1] - 2026-01-01\n- Older\n');
  assert.throws(() => releaseNotes('v0.2.0', root), /Tag/);
  assert.match(releaseNotes('v0.1.0', root), /Initial release/);
  assert.doesNotMatch(releaseNotes('v0.1.0', root), /Older/);
});
