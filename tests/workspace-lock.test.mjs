import test from 'node:test';
import assert from 'node:assert/strict';
import { allowed } from '../server/security.mjs';

test('locked workspace write gate helper semantics via allowed roles still apply', () => {
  assert.equal(allowed('assistant', 'write'), true);
  assert.equal(allowed('viewer', 'write'), false);
  assert.equal(allowed('owner', 'owner'), true);
});

test('requireActive message contract is Vietnamese lock copy', () => {
  const message = 'Không gian đang tạm khóa. Chỉ xem được thông tin; không thể ghi dữ liệu.';
  assert.match(message, /tạm khóa/);
});
