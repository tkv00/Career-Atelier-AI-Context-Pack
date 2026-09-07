import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough, Writable } from 'node:stream';
import { authenticateRunner } from '../lib/auth-login.mjs';
import { promptLogin } from '../lib/login-prompt.mjs';
import { assertSameAuthProject } from '../../scripts/lib/auth-target.mjs';

test('runner preserves password whitespace and waits for session persistence', async () => {
  const session = { access_token: 'test-only' };
  let saved = false;
  const user = await authenticateRunner({ auth: { async signInWithPassword(value) {
    assert.deepEqual(value, { email: 'owner@example.com', password: ' secret  ' });
    return { data: { user: { id: 'owner' }, session }, error: null };
  } } }, ' owner@example.com ', ' secret  ', async value => {
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(value, session); saved = true;
  });
  assert.equal(saved, true); assert.equal(user.id, 'owner');
});

test('runner distinguishes invalid credentials, confirmation, throttling and connection failures', async () => {
  for (const [error, pattern] of [
    [{ code: 'invalid_credentials' }, /DB 비밀번호/],
    [{ code: 'email_not_confirmed' }, /이메일 확인/],
    [{ status: 429 }, /요청이 너무/],
  ]) {
    await assert.rejects(authenticateRunner({ auth: { signInWithPassword: async () => ({ error }) } }, 'owner@example.com', 'password', () => assert.fail('must not save')), pattern);
  }
  await assert.rejects(authenticateRunner({ auth: { signInWithPassword: async () => { throw Error('network'); } } }, 'owner@example.com', 'password', () => {}), /연결하지 못했습니다/);
  await assert.rejects(authenticateRunner({}, 'owner@example.com', 'http://localhost:3000/login', () => {}), /웹 주소/);
});

test('runner rejects a different web project without exposing credentials', () => {
  assert.doesNotThrow(() => assertSameAuthProject('https://one.supabase.co/', 'https://one.supabase.co'));
  assert.throws(() => assertSameAuthProject('https://one.supabase.co', 'https://two.supabase.co'), /서로 다른/);
});

test('interactive prompt keeps password intact without echoing it', async () => {
  const input = new PassThrough();
  let text = '';
  const output = new Writable({ write(chunk, _encoding, done) { text += chunk; done(); } });
  const pending = promptLogin({ input, output });
  input.write('owner@example.com\n');
  await new Promise(resolve => setImmediate(resolve));
  input.write(' secret with spaces  \n');
  const credentials = await pending;
  assert.equal(credentials.password, ' secret with spaces  ');
  assert.ok(!text.includes('secret with spaces'));
  input.end();
});
