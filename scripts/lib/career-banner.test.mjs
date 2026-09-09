import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stripVTControlCharacters } from 'node:util';
import { renderCareerBanner, detectColorDepth, printCareerBanner } from './career-banner.mjs';

const strip = stripVTControlCharacters;
const ONCE = Symbol.for('career-atelier.banner.printed');
const modulePath = fileURLToPath(new URL('./career-banner.mjs', import.meta.url));
beforeEach(() => { delete globalThis[ONCE]; });

function sink(tty = true, columns = 80) {
  return {
    isTTY: tty, columns, data: '', getColorDepth: () => 24,
    write(chunk) { this.data += chunk; return true; },
  };
}
function cleanEnv() {
  const env = { ...process.env };
  for (const key of ['CI', 'NO_COLOR', 'NODE_DISABLE_COLORS', 'FORCE_COLOR',
    'CAREER_ATELIER_BANNER', 'CAREER_ATELIER_ASCII', 'CAREER_ATELIER_COMPACT']) delete env[key];
  return env;
}
function run(args, env = cleanEnv()) {
  return spawnSync(process.execPath, [modulePath, ...args], { encoding: 'utf8', env });
}
function assertFits(options) {
  const text = strip(renderCareerBanner(options));
  const max = Math.max(1, options.columns - 1);
  for (const line of text.split('\n')) {
    assert.ok([...line].length <= max,
      `width=${options.columns}, depth=${options.colorDepth}, line=${JSON.stringify(line)}`);
  }
}

test('monochrome is printable ASCII only', () => {
  const output = renderCareerBanner({ colorDepth: 1, version: '1.2.3' });
  assert.doesNotMatch(output, /[^\x20-\x7e\n]/);
  assert.match(output, /Career Atelier/);
  assert.match(output, /CCCCCCCC/);
  assert.match(output, /v1\.2\.3/);
});

test('truecolor uses half-block artwork and explicit RGB', () => {
  const output = renderCareerBanner({ colorDepth: 24 });
  assert.match(output, /\x1b\[38;2;/);
  assert.match(output, /[▀▄█]/);
  assert.match(strip(output), /PERSONAL CAREER WORKSPACE/);
  assert.match(strip(output), /Your career, in your orbit\./);
});

test('256 colors use palette indexes instead of RGB', () => {
  const output = renderCareerBanner({ colorDepth: 8 });
  assert.match(output, /\x1b\[38;5;/);
  assert.doesNotMatch(output, /\x1b\[(?:38|48);2;/);
});

test('16 colors fall back to ASCII artwork', () => {
  const output = renderCareerBanner({ colorDepth: 4 });
  assert.match(output, /\x1b\[94m/);
  assert.doesNotMatch(strip(output), /[^\x20-\x7e\n]/);
  assert.match(strip(output), /CCCCCCCC/);
});

test('ASCII override works with truecolor text', () => {
  const output = renderCareerBanner({ colorDepth: 24, ascii: true });
  assert.doesNotMatch(strip(output), /[^\x20-\x7e\n]/);
  assert.match(strip(output), /Career Atelier/);
});

test('compact mode is small even on a wide terminal', () => {
  const output = strip(renderCareerBanner({ colorDepth: 24, columns: 140, compact: true }));
  assert.match(output, /\(C\)  Career Atelier/);
  assert.doesNotMatch(output, /[▀▄█]/);
  assert.ok(output.split('\n').length <= 5);
});

test('tiny terminals fit widths 1 through 43', () => {
  for (let columns = 1; columns < 44; columns++) {
    for (const colorDepth of [1, 4, 8, 24]) assertFits({ columns, colorDepth, version: '0.2.0-beta.1' });
  }
});

test('stacked layout fits widths 44 through 79', () => {
  for (let columns = 44; columns < 80; columns++) {
    for (const colorDepth of [1, 4, 8, 24]) assertFits({ columns, colorDepth, version: '0.2.0-beta.1' });
  }
  assert.match(strip(renderCareerBanner({ columns: 60, colorDepth: 24 })), /[▀▄█]/);
  assert.match(strip(renderCareerBanner({ columns: 60, colorDepth: 24 })), /Career Atelier/);
});

test('wide layout fits all launcher modes and color depths', () => {
  for (const columns of [80, 81, 90, 100, 120, 160]) {
    for (const mode of ['all', 'web', 'runner', 'login', 'doctor', 'unusual-very-long-mode']) {
      for (const colorDepth of [1, 4, 8, 24]) assertFits({
        columns, colorDepth, mode, version: '123456789012345678901234567890',
      });
    }
  }
});

test('invalid widths and depths cannot trigger a rendering failure', () => {
  for (const columns of [0, -1, NaN, Infinity, null, '80', undefined]) {
    for (const colorDepth of [0, 7, 25, NaN, undefined]) {
      const output = renderCareerBanner({ columns, colorDepth });
      assert.equal(typeof output, 'string');
      assert.doesNotMatch(output, /\x1b/);
    }
  }
});

test('only SGR styling is emitted: no screen clear, cursor commands or OSC', () => {
  for (const colorDepth of [1, 4, 8, 24]) {
    const output = renderCareerBanner({ colorDepth });
    const withoutSgr = output.replace(/\x1b\[[0-9;]*m/g, '');
    assert.doesNotMatch(withoutSgr, /[\x00-\x09\x0b-\x1f\x7f]/);
  }
});

test('metadata cannot inject CSI, OSC, CR or extra lines', () => {
  const output = renderCareerBanner({
    colorDepth: 1, version: '\x1b[2J\x1b]0;evil\x07\n1.2.3\r',
    mode: '\x1b[1AFake\x00\r\nMode',
  });
  assert.doesNotMatch(output, /\x1b|\r|\x00|evil/);
  assert.match(output, /v1\.2\.3/);
  assert.match(output, /FakeMode/);
});

test('a version already prefixed with v is not double-prefixed', () => {
  const output = renderCareerBanner({ colorDepth: 1, version: 'v1.2.3' });
  assert.match(output, /v1\.2\.3/);
  assert.doesNotMatch(output, /vv1/);
});

test('explicit environment color opt-outs override FORCE_COLOR detection', () => {
  assert.equal(detectColorDepth(sink(), { NO_COLOR: '', FORCE_COLOR: '3' }), 1);
  assert.equal(detectColorDepth(sink(), { NODE_DISABLE_COLORS: '1' }), 1);
  assert.equal(detectColorDepth(sink(), { TERM: 'dumb' }), 1);
  assert.equal(detectColorDepth(sink(), { FORCE_COLOR: '3' }), 24);
  assert.equal(detectColorDepth(sink(), { FORCE_COLOR: '2' }), 8);
  assert.equal(detectColorDepth(sink(), { FORCE_COLOR: '1' }), 4);
  assert.equal(detectColorDepth(sink(), { FORCE_COLOR: '0' }), 1);
});

test('color detection failures safely degrade to monochrome', () => {
  assert.equal(detectColorDepth({}, {}), 1);
  assert.equal(detectColorDepth({ getColorDepth() { throw new Error('unsupported'); } }, {}), 1);
  assert.equal(detectColorDepth({ getColorDepth() { return 9; } }, {}), 1);
});

test('interactive output prints only once per process', () => {
  const stream = sink();
  const options = { stream, outputIsTTY: true, env: {} };
  assert.equal(printCareerBanner(options), true);
  const first = stream.data;
  assert.equal(printCareerBanner(options), false);
  assert.equal(stream.data, first);
});

test('redirected stdout suppresses the banner', () => {
  const stream = sink();
  assert.equal(printCareerBanner({ stream, outputIsTTY: false, env: {} }), false);
  assert.equal(stream.data, '');
});

test('redirected stderr suppresses the banner', () => {
  const stream = sink(false);
  assert.equal(printCareerBanner({ stream, outputIsTTY: true, env: {} }), false);
  assert.equal(stream.data, '');
});

test('CI suppresses automatic output', () => {
  assert.equal(printCareerBanner({ stream: sink(), outputIsTTY: true, env: { CI: 'true' } }), false);
});

test('CI=false does not suppress interactive output', () => {
  assert.equal(printCareerBanner({ stream: sink(), outputIsTTY: true, env: { CI: 'false' } }), true);
});

test('banner opt-out also applies to forced previews', () => {
  const stream = sink();
  assert.equal(printCareerBanner({ stream, force: true, env: { CAREER_ATELIER_BANNER: '0' } }), false);
  assert.equal(stream.data, '');
});

test('ASCII and compact environment switches work', () => {
  let stream = sink();
  printCareerBanner({ stream, outputIsTTY: true, env: { CAREER_ATELIER_ASCII: '1' } });
  assert.doesNotMatch(strip(stream.data), /[^\x20-\x7e\n]/);
  delete globalThis[ONCE];
  stream = sink();
  printCareerBanner({ stream, outputIsTTY: true, env: { CAREER_ATELIER_COMPACT: '1' } });
  assert.match(strip(stream.data), /\(C\)  Career Atelier/);
});

test('importing the module has no output side effects', () => {
  const url = new URL('./career-banner.mjs', import.meta.url).href;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(url)})`], {
    encoding: 'utf8', env: cleanEnv(),
  });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
});

test('standalone execution stays silent in a pipeline without --preview', () => {
  const result = run([]);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
});

test('forced monochrome preview goes only to stderr', () => {
  const result = run(['--preview', '--no-color']);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /Career Atelier/);
  assert.doesNotMatch(result.stderr, /\x1b/);
});

test('forced truecolor preview outputs the large wordmark', () => {
  const result = run(['--preview', '--color=24', '--columns=80']);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /\x1b\[38;2;/);
  assert.match(strip(result.stderr), /PERSONAL CAREER WORKSPACE/);
});

test('invalid CLI flags fail clearly without rendering a banner', () => {
  for (const args of [['--bad-flag'], ['--color=15'], ['--columns=0']]) {
    const result = run(args);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Unknown option/);
    assert.doesNotMatch(result.stderr, /[▀▄█]/);
  }
});

test('--no-color wins over --color regardless of order', () => {
  for (const args of [['--color=24', '--no-color'], ['--no-color', '--color=24']]) {
    const result = run(['--preview', ...args]);
    assert.equal(result.status, 0);
    assert.doesNotMatch(result.stderr, /\x1b/);
  }
});

test('--help prints help without drawing the logo', () => {
  const result = run(['--help']);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Career Atelier \/ terminal logo v2/);
  assert.equal(result.stderr, '');
  assert.doesNotMatch(result.stdout, /[▀▄█]/);
});

test('a failed stream write does not permanently mark the banner as printed', () => {
  const stream = { ...sink(), write() { throw new Error('closed'); } };
  assert.throws(() => printCareerBanner({ stream, outputIsTTY: true, env: {} }), /closed/);
  assert.equal(globalThis[ONCE], undefined);
});
