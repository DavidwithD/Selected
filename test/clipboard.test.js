// Tests for the shortcut dedupe rule. Run: npm test

import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_LENGTH, shouldSaveOnShortcut } from '../lib/clipboard.js';

test('saves a text the extension has not seen', () => {
  assert.equal(shouldSaveOnShortcut('hello there'), true);
});

test('skips a text under two characters', () => {
  assert.equal(shouldSaveOnShortcut('a'), false);
  assert.equal(shouldSaveOnShortcut('   '), false);
  assert.equal(shouldSaveOnShortcut(''), false);
});

test('skips a text over the maximum length', () => {
  assert.equal(shouldSaveOnShortcut('x'.repeat(MAX_LENGTH)), true);
  assert.equal(shouldSaveOnShortcut('x'.repeat(MAX_LENGTH + 1)), false);
});

test('skips a text already saved', () => {
  assert.equal(shouldSaveOnShortcut('hello', { newestText: 'hello' }), false);
  assert.equal(
    shouldSaveOnShortcut('  hello  ', { newestText: 'hello' }),
    false,
  );
  assert.equal(shouldSaveOnShortcut('hello', { newestText: 'hell' }), true);
});

test('skips anything that is not a string', () => {
  assert.equal(shouldSaveOnShortcut(undefined), false);
  assert.equal(shouldSaveOnShortcut(null), false);
  assert.equal(shouldSaveOnShortcut(42), false);
});
