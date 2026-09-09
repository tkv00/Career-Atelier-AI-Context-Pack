import assert from 'node:assert/strict';
import test from 'node:test';
import { safeRedirect } from '../../web/lib/safe-redirect.ts';

test('confirmation redirect accepts local paths only', () => {
  for (const value of ['https://evil.invalid', '//evil.invalid', '/\\evil.invalid', '/\nevil.invalid', null, 'dashboard']) assert.equal(safeRedirect(value), '/dashboard');
  assert.equal(safeRedirect('/essays/abc?tab=review'), '/essays/abc?tab=review');
});
