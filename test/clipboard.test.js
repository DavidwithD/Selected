// Tests for the clipboard dedupe rule. Run: npm test

import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_LENGTH, shouldSaveClipboard } from '../lib/clipboard.js';

test('saves a text the extension has not seen', () => {
  assert.equal(shouldSaveClipboard('hello there'), true);
});

test('skips a text under two characters', () => {
  assert.equal(shouldSaveClipboard('a'), false);
  assert.equal(shouldSaveClipboard('   '), false);
  assert.equal(shouldSaveClipboard(''), false);
});

test('skips a text over the maximum length', () => {
  assert.equal(shouldSaveClipboard('x'.repeat(MAX_LENGTH)), true);
  assert.equal(shouldSaveClipboard('x'.repeat(MAX_LENGTH + 1)), false);
});

test('skips the text read on the previous focus', () => {
  assert.equal(shouldSaveClipboard('hello', { lastClipboard: 'hello' }), false);
  assert.equal(
    shouldSaveClipboard('  hello  ', { lastClipboard: 'hello' }),
    false,
  );
  assert.equal(shouldSaveClipboard('hello', { lastClipboard: 'other' }), true);
});

test('skips a text already saved as a selection', () => {
  assert.equal(shouldSaveClipboard('hello', { newestText: 'hello' }), false);
  assert.equal(shouldSaveClipboard('hello', { newestText: 'hell' }), true);
});

test('skips anything that is not a string', () => {
  assert.equal(shouldSaveClipboard(undefined), false);
  assert.equal(shouldSaveClipboard(null), false);
  assert.equal(shouldSaveClipboard(42), false);
});
