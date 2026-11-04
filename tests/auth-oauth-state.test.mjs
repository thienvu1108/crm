import test from 'node:test';
import assert from 'node:assert/strict';
import { hash, randomToken, sameSecret } from '../server/security.mjs';

test('oauth state tokens hash deterministically and stay opaque', () => {
  const state = randomToken();
  const a = hash(state);
  const b = hash(state);
  assert.equal(a, b);
  assert.notEqual(a, state);
  assert.equal(a.length, 64);
});

test('session-like secrets reject length mismatches', () => {
  assert.equal(sameSecret('abc', 'abcd'), false);
  assert.equal(sameSecret('same', 'same'), true);
});
