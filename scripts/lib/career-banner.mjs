/**
 * Career Atelier CLI mark v2. Original terminal-grid artwork, not an image resize.
 * No npm dependencies. Compatible with Node.js 22.13+.
 * Import is side-effect free. Call printCareerBanner() in the parent launcher only.
 * SPDX-License-Identifier: MIT
 */
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { stripVTControlCharacters } from 'node:util';

const RESET = '\x1b[0m';
const ONCE_KEY = Symbol.for('career-atelier.banner.printed');
const ART_WIDTH = 38;
const PIXEL_GRID = `
......................................
......................................
....r...........eeeee.................
...rer.......eeedddbbeee..............
....r.......eeddddddbbbee.............
..........eedddwwwwwwwbbbbb...........
..........eddwwwwwwwwwwwbbb......sss..
.........eddwwwwwwwwwwwwwbnbrrrrssscc.
........eddwwwwwwwwwwwwwwbnnb...ssccp.
........eddwwwwwwbbbbwwwbbnnb...sccpp.
.......eddiiiiidbbbbbbibbbnnnb...cpp..
.......eddiiiibbbbbbbbbbbnnnnb..sc....
.......eddiiiibbbbbbbbbbnnnnnb.ss.....
.......ebbiiiibbbbbbbbbnnnnnnss.......
......rebbiiiibbbbbbbbbnnnnsss........
....rr.ebbvvvvbbbbbbbnnnnssnnb........
...rr..ebbvvvvbbbbbbnnsssnnnnb........
..r....ebbvvvvvbbbbssssnnnnnnb........
.rr.....ebbvvvvvssssnvvvnnnnb.........
.ss.....ebbsssssvvvvvvvvvnnnb.........
..sssssssssspppppppppppppnnb..........
..........ennpppppppppppnnb...........
..........eennnpppppppnnnbb...........
............bbnnnnnnnnnbb.......e.....
.............bbbnnnnnbbb..............
................bbbbb.................
......................................
......................................
`.trim().split('\n');

// Each dot is transparent: no rectangular background is printed behind the mark.
const PALETTE = {"n": [30, 39, 78], "b": [48, 67, 128], "d": [69, 92, 158], "e": [114, 157, 230], "w": [225, 240, 255], "i": [188, 202, 255], "v": [158, 148, 249], "p": [164, 119, 243], "r": [100, 112, 190], "c": [90, 210, 246], "s": [179, 247, 255]};
const INK = {
  title: [225, 240, 255], accent: [150, 162, 255],
  body: [183, 195, 218], muted: [139, 153, 178],
};

// A small pixel alphabet specifically for a 3-terminal-row wordmark.
const FONT = {
  A: ['.##.', '#..#', '####', '#..#', '#..#'],
  C: ['.###', '#...', '#...', '#...', '.###'],
  E: ['####', '#...', '###.', '#...', '####'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  L: ['#...', '#...', '#...', '#...', '####'],
  R: ['###.', '#..#', '###.', '#.#.', '#..#'],
  T: ['####', '.#..', '.#..', '.#..', '.#..'],
};

const ASCII_LOGO = [
  '             .-==========-.',
  "         .-'                '-.",
  "       .'      CCCCCCCC        '.    o",
  "      /      CCC      CC         \\.-'",
  "     |      CCC              _..-'",
  "     |      CCC          _.-'     |",
  "     |      CCC      _.-'         |",
  "  .--+--------CC--.-'             /",
  " (    '-.      CCCCCCCC         .'",
  "  '---.______              _.-'",
  "             '----------'",
];

const MODE_LABELS = new Map([
  ['all', 'Web + Runner'], ['web', 'Web'], ['runner', 'Runner'],
  ['login', 'Login'], ['doctor', 'Doctor'],
]);

function clean(value, limit = 40) {
  return stripVTControlCharacters(String(value ?? ''))
    .replace(/[^\x20-\x7e]/g, '').trim().slice(0, limit);
}

function flag(value) {
  return value !== undefined && !['', '0', 'false', 'off'].includes(String(value).toLowerCase());
}

function validDepth(value) {
  return [4, 8, 24].includes(value) ? value : 1;
}

function terminalWidth(value) {
  return Number.isFinite(value) ? Math.max(1, Math.min(500, Math.floor(value))) : 80;
}

function paletteIndex(rgb) {
  const steps = [0, 95, 135, 175, 215, 255];
  const nearest = value => steps.reduce((best, candidate, i) =>
    Math.abs(candidate - value) < Math.abs(steps[best] - value) ? i : best, 0);
  const [r, g, b] = rgb;
  const [ri, gi, bi] = rgb.map(nearest);
  const error = (r - steps[ri]) ** 2 + (g - steps[gi]) ** 2 + (b - steps[bi]) ** 2;
  const gray = Math.max(0, Math.min(23, Math.round(((r + g + b) / 3 - 8) / 10)));
  const gv = 8 + gray * 10;
  const grayError = (r - gv) ** 2 + (g - gv) ** 2 + (b - gv) ** 2;
  return grayError < error ? 232 + gray : 16 + 36 * ri + 6 * gi + bi;
}

function sgr(rgb, depth, background = false) {
  if (!rgb) return `\x1b[${background ? 49 : 39}m`;
  const channel = background ? 48 : 38;
  if (depth >= 24) return `\x1b[${channel};2;${rgb.join(';')}m`;
  if (depth >= 8) return `\x1b[${channel};5;${paletteIndex(rgb)}m`;
  return `\x1b[${background ? 104 : 94}m`;
}

function color(text, rgb, depth, bold = false) {
  if (!text || depth < 4) return text;
  return `${bold ? '\x1b[1m' : ''}${sgr(rgb, depth)}${text}${RESET}`;
}

function sameRgb(a, b) {
  return Boolean(a && b && a.every((v, i) => v === b[i]));
}

/** One character cell represents two vertical pixels; null stays transparent. */
function pixelRows(grid, pixel, depth) {
  const rows = [];
  for (let y = 0; y < grid.length; y += 2) {
    let row = '';
    for (let x = 0; x < grid[0].length; x++) {
      const top = pixel(x, y);
      const bottom = y + 1 < grid.length ? pixel(x, y + 1) : null;
      if (sameRgb(top, bottom)) row += sgr(top, depth) + '\x1b[49m█';
      else if (top && bottom) row += sgr(top, depth) + sgr(bottom, depth, true) + '▀';
      else if (top) row += sgr(top, depth) + '\x1b[49m▀';
      else if (bottom) row += sgr(bottom, depth) + '\x1b[49m▄';
      else row += '\x1b[39;49m ';
    }
    rows.push(row + RESET);
  }
  return rows;
}

function orbitLines(depth) {
  return pixelRows(PIXEL_GRID, (x, y) => PALETTE[PIXEL_GRID[y][x]] ?? null, depth);
}

function titleLines(text, depth, gradient = false) {
  const grid = Array.from({ length: 6 }, (_, y) =>
    [...text].map(letter => FONT[letter][y] ?? '.'.repeat(FONT[letter][0].length)).join('.'));
  const left = [126, 219, 247];
  const right = [179, 139, 246];
  return pixelRows(grid, (x, y) => {
    if (grid[y][x] !== '#') return null;
    if (!gradient) return INK.title;
    const t = x / (grid[0].length - 1);
    return left.map((n, i) => Math.round(n + (right[i] - n) * t));
  }, depth);
}

/**
 * Pure renderer. No stream writes or environment reads.
 * @param {object} [options]
 * @param {string} [options.version] Version read from the caller's package.json.
 * @param {string} [options.mode='all'] Launcher mode, e.g. all/web/runner.
 * @param {number} [options.columns=80] Terminal width in character cells.
 * @param {1|4|8|24} [options.colorDepth=1] ANSI color depth; 1 is plain ASCII.
 * @param {boolean} [options.ascii=false] Force ASCII-only artwork.
 * @param {boolean} [options.compact=false] Use the small text-only layout.
 * @returns {string}
 */
export function renderCareerBanner({
  version = '', mode = 'all', columns = 80, colorDepth = 1,
  ascii = false, compact = false,
} = {}) {
  const width = terminalWidth(columns);
  // Leave the last column unused to avoid an automatic wrap in some terminals.
  const limit = Math.max(1, width - 1);
  const depth = validDepth(colorDepth);
  const safeVersion = clean(version, 20).replace(/^v/, '');
  const label = MODE_LABELS.get(mode) ?? clean(mode, 18);
  const metadata = [safeVersion && `v${safeVersion}`, label].filter(Boolean).join(' / ');

  if (compact || width < 44) {
    const title = width >= 25 ? '(C)  Career Atelier' : 'Career Atelier';
    return '\n' + color(title.slice(0, limit), INK.accent, depth, true) + '\n'
      + (metadata ? color(metadata.slice(0, limit), INK.muted, depth) + '\n' : '') + '\n';
  }

  const isPixel = !ascii && depth >= 8;
  const logo = isPixel ? orbitLines(depth) : ASCII_LOGO;
  if (width < 80) {
    // Retain the emblem in a vertical layout instead of losing it on a split pane.
    const indent = ' '.repeat(Math.max(0, Math.floor((limit - ART_WIDTH) / 2)));
    const center = text => {
      const clipped = text.slice(0, limit);
      return ' '.repeat(Math.max(0, Math.floor((limit - clipped.length) / 2))) + clipped;
    };
    const rows = [
      ...logo.map(row => indent + (isPixel ? row : color(row, INK.accent, depth))),
      '', color(center('Career Atelier'), INK.title, depth, true),
      color(center('Your career, in your orbit.'), INK.body, depth),
      color(center(metadata), INK.muted, depth),
    ];
    return '\n' + rows.join('\n') + '\n\n';
  }

  const margin = '  ';
  const gap = '   ';
  const labelWidth = limit - margin.length - ART_WIDTH - gap.length;
  const labels = new Map();
  const set = (row, text, rgb = INK.body, bold = false) =>
    labels.set(row, color(text.slice(0, labelWidth), rgb, depth, bold));

  if (isPixel) {
    set(0, 'PERSONAL CAREER WORKSPACE', INK.muted);
    titleLines('CAREER', depth).forEach((line, i) => labels.set(2 + i, line));
    titleLines('ATELIER', depth, true).forEach((line, i) => labels.set(6 + i, line));
    set(10, 'Your career, in your orbit.');
    set(12, metadata, INK.body);
    set(13, 'OPEN SOURCE / LOCAL AI', INK.muted);
  } else {
    set(2, 'Career Atelier', INK.title, true);
    set(4, 'Your career, in your orbit.');
    set(6, metadata);
    set(8, 'OPEN SOURCE / LOCAL AI', INK.muted);
  }
  const rows = logo.map((line, i) => {
    const art = isPixel ? line : color(line.padEnd(ART_WIDTH), INK.accent, depth);
    return margin + art + gap + (labels.get(i) ?? '');
  });
  return '\n' + rows.join('\n') + '\n\n';
}

/** Explicit opt-outs win over FORCE_COLOR; matches the previous package's policy. */
export function detectColorDepth(stream, env = process.env) {
  if ('NO_COLOR' in env || 'NODE_DISABLE_COLORS' in env || env.TERM === 'dumb') return 1;
  if ('FORCE_COLOR' in env) {
    return new Map([
      ['0', 1], ['false', 1], ['1', 4], ['2', 8], ['3', 24], ['', 4], ['true', 4],
    ]).get(String(env.FORCE_COLOR)) ?? 4;
  }
  try {
    if (typeof stream?.getColorDepth === 'function') return validDepth(stream.getColorDepth(env));
  } catch { /* An optional branding feature must not prevent startup. */ }
  return 1;
}

/**
 * Print once, on stderr by default. Silent in CI or when either stream is redirected.
 * force bypasses the TTY/CI checks but never CAREER_ATELIER_BANNER=0.
 * Options from the previous CLI package remain supported.
 * @returns {boolean} Whether the banner was written.
 */
export function printCareerBanner({
  stream = process.stderr, outputIsTTY = Boolean(process.stdout.isTTY),
  env = process.env, force = false, ...options
} = {}) {
  if (env.CAREER_ATELIER_BANNER === '0') return false;
  if (!force && (!stream.isTTY || !outputIsTTY || flag(env.CI))) return false;
  if (globalThis[ONCE_KEY]) return false;
  const output = renderCareerBanner({
    columns: stream.columns || 80,
    colorDepth: detectColorDepth(stream, env),
    ascii: flag(env.CAREER_ATELIER_ASCII),
    compact: flag(env.CAREER_ATELIER_COMPACT),
    ...options,
  });
  stream.write(output);
  globalThis[ONCE_KEY] = true;
  return true;
}

function isDirectRun() {
  try {
    return Boolean(process.argv[1])
      && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch { return false; }
}

function parseArgs(args) {
  const parsed = {};
  for (const arg of args) {
    if (arg === '--help' || arg === '-h') parsed.help = true;
    else if (arg === '--preview') parsed.force = true;
    else if (arg === '--ascii') parsed.ascii = true;
    else if (arg === '--compact') parsed.compact = true;
    else if (arg === '--no-color') parsed.colorDepth = 1;
    else if (/^--color=(1|4|8|24)$/.test(arg)) parsed.colorDepth = Number(arg.split('=')[1]);
    else if (/^--columns=[1-9]\d{0,2}$/.test(arg)) parsed.columns = Number(arg.split('=')[1]);
    else throw new Error(`Unknown option: ${clean(arg)}. Use --help.`);
  }
  // Explicit no-color is stronger than a --color flag, regardless of order.
  if (args.includes('--no-color')) parsed.colorDepth = 1;
  return parsed;
}

if (isDirectRun()) {
  try {
    const { help, ...options } = parseArgs(process.argv.slice(2));
    if (help) {
      console.log([
        'Career Atelier / terminal logo v2',
        'node career-banner.mjs [--preview] [--ascii] [--compact] [--no-color]',
        '                       [--color=1|4|8|24] [--columns=N]',
        '',
        '--preview       Allow output even outside an interactive terminal.',
        '--color=24      Explicit truecolor override for preview/debugging.',
        '--ascii         Draw with ASCII characters only.',
        '--compact       Small text-only layout.',
        '--columns=80    Override terminal width for a preview.',
        '',
        'Environment: CAREER_ATELIER_BANNER=0, CAREER_ATELIER_ASCII=1,',
        '             CAREER_ATELIER_COMPACT=1, NO_COLOR, FORCE_COLOR.',
      ].join('\n'));
    } else printCareerBanner(options);
  } catch (error) {
    console.error(clean(error.message, 140));
    process.exitCode = 1;
  }
}
