// Turn records into the file formats the manager page can download.

function pad(n) {
  return String(n).padStart(2, '0');
}

/** Local time, readable and sortable. */
export function stamp(date = new Date()) {
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}`
  );
}

export function formatTime(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/**
 * The fields a file can carry, in the order every format writes them.
 *
 * `id` is left out. It is the database's own key. It means nothing in another
 * program, and nothing reads it back yet.
 */
export const FIELDS = ['text', 'url', 'title', 'host', 'source', 'savedAt'];

/** The name each field takes on screen. */
export const FIELD_LABELS = {
  text: 'text',
  url: 'url',
  title: 'title',
  host: 'host',
  source: 'source',
  savedAt: 'date',
};

/** The name each field takes in a CSV header row. */
const CSV_HEADS = {
  text: 'text',
  url: 'url',
  title: 'title',
  host: 'host',
  source: 'source',
  savedAt: 'saved_at',
};

/**
 * The chosen fields, in FIELDS order.
 *
 * The caller passes whatever the boxes gave it. Sorting here means one set of
 * boxes always writes one order of columns.
 */
function chosen(fields) {
  if (!Array.isArray(fields)) return FIELDS;
  const want = new Set(fields);
  return FIELDS.filter((field) => want.has(field));
}

/** One record's value for one field. */
function valueOf(row, field) {
  if (field === 'savedAt') return new Date(row.ts).toISOString();
  if (field === 'source') return row.source || 'selection';
  return row[field];
}

export function toJson(rows, fields) {
  const kept = chosen(fields);
  const items = rows.map((row) => {
    const item = {};
    for (const field of kept) item[field] = valueOf(row, field);
    return item;
  });
  return JSON.stringify(items, null, 2);
}

function csvCell(value) {
  const s = String(value ?? '');
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(rows, fields) {
  const kept = chosen(fields);
  const lines = [kept.map((field) => CSV_HEADS[field]).join(',')];
  for (const row of rows) {
    lines.push(kept.map((field) => csvCell(valueOf(row, field))).join(','));
  }
  return lines.join('\r\n');
}

/**
 * The fields that share the one meta line under the text, in the order they
 * appear on it. `text` is the body above it and `url` is the line below.
 */
const META = ['title', 'host', 'source', 'savedAt'];

export function toTxt(rows, fields) {
  const kept = new Set(chosen(fields));
  return rows
    .map((row) => {
      const lines = [];
      if (kept.has('text')) lines.push(row.text);
      // The date reads as a local time here. The other two formats write it as
      // ISO, because a machine reads those.
      const meta = META.filter((field) => kept.has(field)).map((field) =>
        field === 'savedAt' ? formatTime(row.ts) : valueOf(row, field),
      );
      if (meta.length) lines.push(`— ${meta.join(' · ')}`);
      if (kept.has('url')) lines.push(row.url);
      return lines.join('\n');
    })
    .join('\n\n----\n\n');
}

export const FORMATS = {
  json: { ext: 'json', mime: 'application/json', build: toJson },
  csv: { ext: 'csv', mime: 'text/csv', build: toCsv },
  txt: { ext: 'txt', mime: 'text/plain', build: toTxt },
};
