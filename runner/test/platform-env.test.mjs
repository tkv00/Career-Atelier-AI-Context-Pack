import test from 'node:test';
import assert from 'node:assert/strict';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { childEnvironment } from '../safety.mjs';

test('child CLI environment derives the current user home without hardcoding a user', () => {
  const environment = childEnvironment({
    PATH: process.env.PATH,
    OPENAI_API_KEY: 'must-be-removed',
  });

  assert.equal(environment.OPENAI_API_KEY, undefined);
  assert.equal(environment.HOME, homedir());
  assert.equal(environment.CODEX_HOME, resolve(homedir(), '.codex'));
  if (process.platform === 'win32') {
    assert.equal(environment.USERPROFILE, homedir());
    assert.equal(environment.HOMEDRIVE, homedir().slice(0, 2));
    assert.equal(environment.HOMEPATH, homedir().slice(2) || '\\');
  }
});
