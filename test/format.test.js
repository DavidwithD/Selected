// Tests for the export builders and the field choice. Run: npm test

import assert from 'node:assert/strict';
import test from 'node:test';
import { FIELDS, toCsv, toJson, toTxt } from '../lib/format.js';

// A fixed local time, so the TXT meta line is the same on every run.
const TS = new Date(2026, 0, 2, 15, 4).getTime();

const rows = [
  {
    id: 1,
    text: 'a saved line',
    url: 'https://example.com/page',
    title: 'A Page',
    host: 'example.com',
    source: 'selection',
    ts: TS,
  },
];

test('every builder carries all six fields when none is named', () => {
  const item = JSON.parse(toJson(rows))[0];
  assert.deepEqual(Object.keys(item), FIELDS);
  assert.equal(
    toCsv(rows).split('\r\n')[0],
    'text,url,title,host,source,saved_at',
  );
});

test('JSON keeps only the chosen keys, in FIELDS order', () => {
  const item = JSON.parse(toJson(rows, ['host', 'text']))[0];
  assert.deepEqual(Object.keys(item), ['text', 'host']);
  assert.equal(item.text, 'a saved line');
});

test('CSV writes one column per chosen field, header and row together', () => {
  const lines = toCsv(rows, ['savedAt', 'text']).split('\r\n');
  assert.equal(lines[0], 'text,saved_at');
  assert.equal(lines[1], `"a saved line","${new Date(TS).toISOString()}"`);
});

test('CSV still escapes a quote inside a chosen cell', () => {
  const quoted = [{ ...rows[0], text: 'he said "no"' }];
  assert.equal(toCsv(quoted, ['text']).split('\r\n')[1], '"he said ""no"""');
});

test('TXT drops the body, the meta line and the link on their own', () => {
  assert.equal(toTxt(rows, ['text']), 'a saved line');
  assert.equal(toTxt(rows, ['url']), 'https://example.com/page');
  assert.equal(toTxt(rows, ['host']), '— example.com');
});

test('TXT with host and date alone is what it wrote before the choice existed', () => {
  assert.equal(
    toTxt(rows, ['text', 'host', 'savedAt', 'url']),
    'a saved line\n— example.com · 2026-01-02 15:04\nhttps://example.com/page',
  );
});

test('TXT puts the title and the source on the same meta line', () => {
  assert.equal(
    toTxt(rows, FIELDS),
    'a saved line\n— A Page · example.com · selection · 2026-01-02 15:04\n' +
      'https://example.com/page',
  );
});

test('a record with no source reads as a selection', () => {
  const bare = [{ ...rows[0], source: undefined }];
  assert.equal(JSON.parse(toJson(bare, ['source']))[0].source, 'selection');
});

test('a field the builders do not know is ignored', () => {
  const item = JSON.parse(toJson(rows, ['text', 'id', 'nonsense']))[0];
  assert.deepEqual(Object.keys(item), ['text']);
});

// The page refuses an empty choice, so this is what the builders do rather than
// what anyone sees. It matters that none of them throws.
test('no chosen field writes empty records, not an error', () => {
  assert.equal(toCsv(rows, []), '\r\n');
  assert.equal(toTxt(rows, []), '');
  assert.deepEqual(JSON.parse(toJson(rows, [])), [{}]);
});

test('two records keep the separator between them', () => {
  const two = [rows[0], { ...rows[0], id: 2, text: 'second' }];
  assert.equal(toTxt(two, ['text']), 'a saved line\n\n----\n\nsecond');
});
