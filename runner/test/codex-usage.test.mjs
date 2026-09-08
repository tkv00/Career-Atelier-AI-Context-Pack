import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { normalizeCodexRateLimits, readCodexRateLimits } from '../providers/codex-usage.mjs';

function appServerDouble(response, messages) {
  return () => {
    const child = new EventEmitter();
    child.stdin = new PassThrough();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.killed = false;
    child.kill = () => {
      child.killed = true;
      queueMicrotask(() => child.emit('close', 0));
      return true;
    };

    let buffer = '';
    child.stdin.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line) continue;
        const message = JSON.parse(line);
        messages.push(message);
        if (message.method === 'initialize') {
          queueMicrotask(() => child.stdout.write(`${JSON.stringify({ id: 1, result: { userAgent: 'test' } })}\n`));
        }
        if (message.method === 'account/rateLimits/read') {
          queueMicrotask(() => child.stdout.write(`${JSON.stringify({ id: 2, result: response })}\n`));
        }
      }
    });
    return child;
  };
}

test('Codex rate limits retain each reported bucket and window', () => {
  const result = normalizeCodexRateLimits({
    rateLimitsByLimitId: {
      codex: {
        limitName: null,
        primary: { usedPercent: 25, windowDurationMins: 15, resetsAt: 1_730_947_200 },
        secondary: null,
      },
      codex_other: {
        limitName: 'Long window',
        primary: { usedPercent: 42, windowDurationMins: 60, resetsAt: 1_730_950_800 },
        secondary: { usedPercent: 80, windowDurationMins: 10_080, resetsAt: 1_731_551_200 },
      },
    },
  });

  assert.deepEqual(result, {
    rateLimitsByLimitId: {
      codex: {
        limitName: null,
        primary: { usedPercent: 25, windowDurationMins: 15, resetsAt: 1_730_947_200 },
        secondary: null,
      },
      codex_other: {
        limitName: 'Long window',
        primary: { usedPercent: 42, windowDurationMins: 60, resetsAt: 1_730_950_800 },
        secondary: { usedPercent: 80, windowDurationMins: 10_080, resetsAt: 1_731_551_200 },
      },
    },
  });
});

test('Codex rate limits support the legacy single-bucket response and discard invalid values', () => {
  assert.deepEqual(normalizeCodexRateLimits({
    rateLimits: {
      limitId: 'codex',
      primary: { usedPercent: 120, windowDurationMins: -1, resetsAt: 'not-a-time' },
      secondary: { usedPercent: 25 },
    },
  }), {
    rateLimitsByLimitId: {
      codex: {
        limitName: null,
        primary: { usedPercent: 100, windowDurationMins: 0, resetsAt: null },
        secondary: { usedPercent: 25, windowDurationMins: null, resetsAt: null },
      },
    },
  });
  assert.equal(normalizeCodexRateLimits({ rateLimitsByLimitId: { codex: { primary: {} } } }), null);
});

test('Codex App Server initializes before reading rate limits', async () => {
  const response = {
    rateLimitsByLimitId: {
      codex: { limitName: null, primary: { usedPercent: 25, windowDurationMins: 15, resetsAt: 1_730_947_200 }, secondary: null },
    },
  };
  const messages = [];
  const result = await readCodexRateLimits({ spawnProcess: appServerDouble(response, messages) });

  assert.deepEqual(result, normalizeCodexRateLimits(response));
  assert.deepEqual(messages.map((message) => message.method), ['initialize', 'initialized', 'account/rateLimits/read']);
});
