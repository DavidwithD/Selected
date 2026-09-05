// Tests for the storage layer. Run: npm test
// fake-indexeddb gives us indexedDB outside a browser.

import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test from 'node:test';

const {
  addSelection,
  query,
  queryAll,
  deleteIds,
  deleteOlderThan,
  clearAll,
  countAll,
  listHosts,
  newestText,
} = await import('../lib/db.js');

const DAY = 24 * 60 * 60 * 1000;
const T0 = Date.UTC(2026, 0, 10, 12, 0, 0);

async function seed() {
  await clearAll();
  await addSelection({
    text: 'the quick brown fox',
    url: 'https://a.test/one',
    title: 'One',
    ts: T0,
  });
  await addSelection({
    text: 'lazy dog',
    url: 'https://b.test/two',
    title: 'Two',
    ts: T0 + DAY,
  });
  await addSelection({
    text: 'Quick note',
    url: 'https://b.test/three',
    title: 'Three',
    ts: T0 + 2 * DAY,
  });
}

test('stores records and counts them', async () => {
  await seed();
  assert.equal(await countAll(), 3);
});

test('returns newest first, oldest first on demand', async () => {
  await seed();
  const newest = await query({});
  assert.deepEqual(
    newest.rows.map((r) => r.text),
    ['Quick note', 'lazy dog', 'the quick brown fox'],
  );
  const oldest = await query({ order: 'asc' });
  assert.equal(oldest.rows[0].text, 'the quick brown fox');
});

test('search ignores case', async () => {
  await seed();
  const { rows, total } = await query({ text: 'QUICK' });
  assert.equal(total, 2);
  assert.deepEqual(
    rows.map((r) => r.text),
    ['Quick note', 'the quick brown fox'],
  );
});

test('filters by host', async () => {
  await seed();
  const { total } = await query({ host: 'b.test' });
  assert.equal(total, 2);
});

test('filters by date range', async () => {
  await seed();
  const { rows } = await query({ from: T0 + DAY, to: T0 + DAY + 1000 });
  assert.deepEqual(
    rows.map((r) => r.text),
    ['lazy dog'],
  );
});

test('paging keeps the total of all matches', async () => {
  await seed();
  const first = await query({ limit: 2 });
  assert.equal(first.rows.length, 2);
  assert.equal(first.total, 3);
  const second = await query({ limit: 2, offset: 2 });
  assert.equal(second.rows.length, 1);
  assert.equal(second.total, 3);
});

test('a wider selection replaces the narrow one', async () => {
  await clearAll();
  const first = await addSelection({
    text: 'brown fox',
    url: 'https://a.test/one',
    title: 'One',
    ts: T0,
  });
  const second = await addSelection({
    text: 'the quick brown fox jumps',
    url: 'https://a.test/one',
    title: 'One',
    ts: T0 + 1000,
  });
  assert.equal(second.superseded, true);
  assert.equal(second.id, first.id);
  assert.equal(await countAll(), 1);
  const { rows } = await query({});
  assert.equal(rows[0].text, 'the quick brown fox jumps');
});

test('a wider selection later, or on another page, is a new record', async () => {
  await clearAll();
  await addSelection({
    text: 'brown fox',
    url: 'https://a.test/one',
    title: 'One',
    ts: T0,
  });
  const late = await addSelection({
    text: 'the quick brown fox',
    url: 'https://a.test/one',
    title: 'One',
    ts: T0 + 60000,
  });
  assert.equal(late.superseded, false);
  const other = await addSelection({
    text: 'the quick brown fox jumps',
    url: 'https://b.test/two',
    title: 'Two',
    ts: T0 + 60500,
  });
  assert.equal(other.superseded, false);
  assert.equal(await countAll(), 3);
});

test('a clipboard record has no page and lands under the clipboard host', async () => {
  await clearAll();
  await addSelection({
    text: 'copied from a popup',
    url: '',
    title: '',
    ts: T0,
    source: 'clipboard',
  });
  const { rows, total } = await query({ host: 'clipboard' });
  assert.equal(total, 1);
  assert.equal(rows[0].url, '');
  assert.equal(rows[0].source, 'clipboard');
});

test('one clipboard record never replaces another', async () => {
  await clearAll();
  await addSelection({
    text: 'brown fox',
    url: '',
    title: '',
    ts: T0,
    source: 'clipboard',
  });
  const second = await addSelection({
    text: 'the quick brown fox',
    url: '',
    title: '',
    ts: T0 + 1000,
    source: 'clipboard',
  });
  assert.equal(second.superseded, false);
  assert.equal(await countAll(), 2);
});

test('newestText reads the newest record, or nothing', async () => {
  await clearAll();
  assert.equal(await newestText(), '');
  await seed();
  assert.equal(await newestText(), 'Quick note');
});

test('lists distinct hosts', async () => {
  await seed();
  assert.deepEqual(await listHosts(), ['a.test', 'b.test']);
});

test('deletes by id and clears everything', async () => {
  await seed();
  const { rows } = await query({});
  await deleteIds([rows[0].id]);
  assert.equal(await countAll(), 2);
  await clearAll();
  assert.equal(await countAll(), 0);
});

test('retention drops records older than the cutoff', async () => {
  await seed();
  const deleted = await deleteOlderThan(T0 + DAY);
  assert.equal(deleted, 1);
  const { rows } = await query({});
  assert.deepEqual(
    rows.map((r) => r.text),
    ['Quick note', 'lazy dog'],
  );
});

test('retention keeps everything when the cutoff is older than all records', async () => {
  await seed();
  assert.equal(await deleteOlderThan(T0 - DAY), 0);
  assert.equal(await countAll(), 3);
});

test('queryAll returns every match, not one page', async () => {
  await seed();
  const rows = await queryAll({ text: 'quick' });
  assert.equal(rows.length, 2);
});
