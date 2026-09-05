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

export function toJson(rows) {
  const items = rows.map((r) => ({
    text: r.text,
    url: r.url,
    title: r.title,
    host: r.host,
    source: r.source || 'selection',
    savedAt: new Date(r.ts).toISOString(),
  }));
  return JSON.stringify(items, null, 2);
}

function csvCell(value) {
  const s = String(value ?? '');
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(rows) {
  const head = ['text', 'url', 'title', 'host', 'source', 'saved_at'];
  const lines = [head.join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.text,
        r.url,
        r.title,
        r.host,
        r.source || 'selection',
        new Date(r.ts).toISOString(),
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return lines.join('\r\n');
}

export function toTxt(rows) {
  return rows
    .map((r) => `${r.text}\n— ${r.host} · ${formatTime(r.ts)}\n${r.url}`)
    .join('\n\n----\n\n');
}

export const FORMATS = {
  json: { ext: 'json', mime: 'application/json', build: toJson },
  csv: { ext: 'csv', mime: 'text/csv', build: toCsv },
  txt: { ext: 'txt', mime: 'text/plain', build: toTxt },
};
