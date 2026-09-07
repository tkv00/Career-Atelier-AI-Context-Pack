import test from 'node:test';
import assert from 'node:assert/strict';
import { signupOutcome, authErrorMessage } from '../../web/app/login/auth-feedback.ts';

test('signup response without session never means authenticated', () => {
  assert.equal(signupOutcome({ session: null, user: { identities: [{}] } }), 'confirm');
  assert.equal(signupOutcome({ session: null, user: { identities: [] } }), 'existing');
  assert.equal(signupOutcome({ session: {}, user: { identities: [{}] } }), 'ready');
});
test('auth feedback preserves confirmation and server failures instead of reporting wrong password', () => {
  assert.match(authErrorMessage({ code: 'email_not_confirmed', status: 400 }, 'login'), /가입 확인/);
  assert.match(authErrorMessage({ code: 'invalid_credentials', status: 400 }, 'login'), /먼저 계정/);
  assert.match(authErrorMessage({ status: 503 }, 'login'), /서버/);
  assert.match(authErrorMessage({ status: 429 }, 'signup'), /제한/);
});
