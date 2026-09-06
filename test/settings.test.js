// Tests for the blocklist rules. Run: npm test

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hostRecords,
  isBlocked,
  matchesHost,
  parseHosts,
} from '../lib/settings.js';

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

// The mode decides which list is asked. Both lists use the same subdomain rule.
const block = (blockedHosts) => ({ hostMode: 'block', blockedHosts });
const allow = (allowedHosts) => ({ hostMode: 'allow', allowedHosts });

test('block mode records everywhere but the blocklist', () => {
  const settings = block(['my-bank.example']);
  assert.equal(hostRecords('example.com', settings), true);
  assert.equal(hostRecords('my-bank.example', settings), false);
  assert.equal(hostRecords('login.my-bank.example', settings), false);
});

test('an empty blocklist records everywhere', () => {
  assert.equal(hostRecords('example.com', block([])), true);
});

test('allow mode records nowhere but the allow-list', () => {
  const settings = allow(['en.wiktionary.org']);
  assert.equal(hostRecords('en.wiktionary.org', settings), true);
  assert.equal(hostRecords('example.com', settings), false);
});

test('an allowed host also allows its subdomains', () => {
  assert.equal(hostRecords('ko.naver.com', allow(['naver.com'])), true);
});

test('an allowed host does not allow a lookalike', () => {
  assert.equal(hostRecords('notnaver.com', allow(['naver.com'])), false);
});

// The silent setting. It is valid, and the page says so when it is saved.
test('an empty allow-list records nothing', () => {
  assert.equal(hostRecords('example.com', allow([])), false);
});

test('a host with no name records in block mode and not in allow mode', () => {
  assert.equal(hostRecords('', block(['my-bank.example'])), true);
  assert.equal(hostRecords('', allow(['naver.com'])), false);
});

test('an unknown mode is read as block, so a bad value records', () => {
  const settings = { hostMode: 'nonsense', blockedHosts: ['my-bank.example'] };
  assert.equal(hostRecords('example.com', settings), true);
  assert.equal(hostRecords('my-bank.example', settings), false);
});

test('matchesHost and isBlocked answer the same question', () => {
  assert.equal(matchesHost('a.example', ['example']), true);
  assert.equal(isBlocked('a.example', ['example']), true);
  assert.equal(matchesHost('a.example', []), false);
});
