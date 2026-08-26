// Tests for the blocklist rules. Run: npm test

import assert from 'node:assert/strict';
import test from 'node:test';
import { isBlocked, parseHosts } from '../lib/settings.js';

test('parseHosts cleans the textarea input', () => {
  const input = ' Mail.Google.com \n\nwww.my-bank.example\nmail.google.com\n';
  assert.deepEqual(parseHosts(input), ['mail.google.com', 'my-bank.example']);
});

test('parseHosts on an empty box gives an empty list', () => {
  assert.deepEqual(parseHosts('   \n  '), []);
});

test('a blocked host blocks its subdomains', () => {
  const list = ['my-bank.example'];
  assert.equal(isBlocked('my-bank.example', list), true);
  assert.equal(isBlocked('www.my-bank.example', list), true);
  assert.equal(isBlocked('login.eu.my-bank.example', list), true);
});

test('a blocked host does not block a lookalike', () => {
  const list = ['bank.example'];
  assert.equal(isBlocked('notbank.example', list), false);
  assert.equal(isBlocked('bank.example.com', list), false);
});

test('an empty list blocks nothing', () => {
  assert.equal(isBlocked('a.test', []), false);
  assert.equal(isBlocked('', ['a.test']), false);
});
