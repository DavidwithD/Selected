// Tests for the site list rules. Run: npm test

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cleanHosts,
  cleanSites,
  matchesHost,
  migrateSites,
  parseHosts,
  siteFor,
} from '../lib/settings.js';

const site = (host, select = true, shortcut = true) => ({
  host,
  select,
  shortcut,
});

test('parseHosts cleans the typed input', () => {
  const input = ' Mail.Google.com \n\nwww.my-bank.example\nmail.google.com\n';
  assert.deepEqual(parseHosts(input), ['mail.google.com', 'my-bank.example']);
});

test('parseHosts on an empty box gives an empty list', () => {
  assert.deepEqual(parseHosts('   \n  '), []);
});

test('a listed host matches itself and its subdomains', () => {
  const sites = [site('naver.com')];
  assert.equal(siteFor('naver.com', sites)?.host, 'naver.com');
  assert.equal(siteFor('m.naver.com', sites)?.host, 'naver.com');
  assert.equal(siteFor('a.b.naver.com', sites)?.host, 'naver.com');
});

test('a listed host does not match a lookalike', () => {
  const sites = [site('naver.com')];
  assert.equal(siteFor('notnaver.com', sites), null);
  assert.equal(siteFor('naver.com.evil.example', sites), null);
});

test('a site not on the list gets no entry', () => {
  assert.equal(siteFor('example.com', [site('naver.com')]), null);
});

test('an empty list matches nothing', () => {
  assert.equal(siteFor('naver.com', []), null);
  assert.equal(siteFor('naver.com', undefined), null);
});

test('a host with no name matches nothing', () => {
  assert.equal(siteFor('', [site('naver.com')]), null);
});

// With both listed, the more specific entry uses its own boxes.
test('the longest matching entry decides', () => {
  const sites = [site('naver.com', false, true), site('dict.naver.com', true)];
  assert.equal(siteFor('dict.naver.com', sites)?.select, true);
  assert.equal(siteFor('ko.dict.naver.com', sites)?.select, true);
  assert.equal(siteFor('m.naver.com', sites)?.select, false);
});

test('the longest entry wins whatever the list order', () => {
  const sites = [site('dict.naver.com'), site('naver.com')];
  assert.equal(siteFor('dict.naver.com', sites)?.host, 'dict.naver.com');
});

test('matchesHost covers subdomains', () => {
  assert.equal(matchesHost('a.example', ['example']), true);
  assert.equal(matchesHost('a.example', []), false);
});

// A pasted address bar is the natural thing to type. The list only ever sees
// location.hostname, so an entry that keeps its scheme or path matches nothing.
test('parseHosts reduces a pasted URL to its host', () => {
  assert.deepEqual(parseHosts('https://en.wiktionary.org/wiki/hello'), [
    'en.wiktionary.org',
  ]);
  assert.deepEqual(parseHosts('HTTPS://Naver.com'), ['naver.com']);
  assert.deepEqual(parseHosts('naver.com/'), ['naver.com']);
  assert.deepEqual(parseHosts('//naver.com'), ['naver.com']);
});

test('parseHosts drops a port, so localhost:3000 matches localhost', () => {
  assert.deepEqual(parseHosts('localhost:3000'), ['localhost']);
});

test('parseHosts drops anything before an @', () => {
  assert.deepEqual(parseHosts('user:pw@naver.com'), ['naver.com']);
});

test('one host typed three ways is one entry', () => {
  assert.deepEqual(parseHosts('naver.com\nhttps://www.naver.com/\nNAVER.COM'), [
    'naver.com',
  ]);
});

test('cleanHosts repairs a list already in storage', () => {
  assert.deepEqual(
    cleanHosts(['https://brunch.co.kr/@someone', 'www.NAVER.com/']),
    ['brunch.co.kr', 'naver.com'],
  );
});

test('cleanHosts turns anything but an array into an empty list', () => {
  assert.deepEqual(cleanHosts(undefined), []);
  assert.deepEqual(cleanHosts('naver.com'), []);
});

test('cleanSites reduces a pasted URL to its host', () => {
  assert.deepEqual(cleanSites([site('https://www.Naver.com/search?q=1')]), [
    site('naver.com'),
  ]);
});

test('cleanSites keeps the first entry for a host, sorted by host', () => {
  const list = [site('naver.com', false), site('b.example'), site('NAVER.com')];
  assert.deepEqual(cleanSites(list), [
    site('b.example'),
    site('naver.com', false),
  ]);
});

test('cleanSites drops an entry with no host', () => {
  assert.deepEqual(cleanSites([site(''), { select: true }, null]), []);
});

// A half-written entry still saves.
test('cleanSites reads a missing box as ticked', () => {
  assert.deepEqual(cleanSites([{ host: 'naver.com' }]), [site('naver.com')]);
});

test('cleanSites turns anything but an array into an empty list', () => {
  assert.deepEqual(cleanSites(undefined), []);
  assert.deepEqual(cleanSites('naver.com'), []);
});

test('migrateSites keeps a stored site list', () => {
  const stored = { sites: [site('naver.com', false)], allowedHosts: ['x.com'] };
  assert.deepEqual(migrateSites(stored), [site('naver.com', false)]);
});

test('migrateSites turns an old allow-list into sites', () => {
  const stored = {
    hostMode: 'allow',
    allowedHosts: ['naver.com', 'https://en.wiktionary.org/wiki/a'],
    captureSelection: true,
    captureClipboard: false,
  };
  assert.deepEqual(migrateSites(stored), [
    site('en.wiktionary.org'),
    site('naver.com'),
  ]);
});

// The typed allow-list is kept from a block-mode profile. The blocklist is not.
test('migrateSites keeps the allow-list from a block-mode profile', () => {
  const stored = {
    hostMode: 'block',
    blockedHosts: ['my-bank.example'],
    allowedHosts: ['naver.com'],
  };
  assert.deepEqual(migrateSites(stored), [site('naver.com')]);
});

test('migrateSites carries the old selection switch onto each site', () => {
  const stored = { allowedHosts: ['naver.com'], captureSelection: false };
  assert.deepEqual(migrateSites(stored), [site('naver.com', false, true)]);
});

test('migrateSites on an empty profile gives an empty list', () => {
  assert.deepEqual(migrateSites({}), []);
  assert.deepEqual(migrateSites(undefined), []);
});
