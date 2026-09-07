# Architecture

What each part holds, and the constraints they are built under. Why any of it
was chosen is in [decisions/](decisions/). How to drive the extension is the
[README](../README.md).

## The flow

A selection travels through three processes.

1. `content.js` runs in every frame of every page. It reads the selection after
   a mouse-up, a double-click or a shift-select, waits 250 ms, then sends the
   text to the service worker.
2. `background.js` decides whether to keep it, and writes it. It is the only
   writer.
3. `page/` reads the database directly and shows it. It deletes, and never
   writes a record.

The content script also keeps a local copy of the site rule. That copy only
saves a message per selection on a page that will not record. The service worker
decides again, with the real rule, before anything is written.

## Files

| File                     | Job                                            |
| ------------------------ | ---------------------------------------------- |
| `manifest.json`          | MV3 manifest. Content script on `<all_urls>`.  |
| `content.js`             | Reads the selection, debounces, sends it.      |
| `background.js`          | Writes records. Badge, icon click, cleanup.    |
| `lib/db.js`              | IndexedDB open, add, query, delete, retention. |
| `lib/settings.js`        | Defaults, the site rules, host parsing.        |
| `lib/clipboard.js`       | The clipboard dedupe rule.                     |
| `lib/format.js`          | JSON, CSV and TXT builders. The field list.    |
| `page/page.html/css/js`  | Manager page.                                  |
| `scripts/make-icons.cjs` | Draws the three PNG icons.                     |
| `test/*.test.js`         | The suite. `npm test`.                         |

## The record

```js
{
  (id, text, ts, url, title, host, source);
}
```

`source` is `selection` or `clipboard`, and each source has its own switch. A
clipboard record carries no `url` and no `title`, and its `host` is the literal
string `clipboard`.

`id` never leaves the database. It is an autoincrement key, it means nothing in
another profile, and no export offers it.

## Storage

Records live in IndexedDB, with indexes on `ts` and `host`.
`chrome.storage.local` holds the settings and nothing else.

An IndexedDB transaction commits as soon as the microtask queue drains with no
request pending. Nothing inside a transaction may await a promise that is not an
IndexedDB request.

## Constraints

These are assumptions the code is built on. Correct any that stop being true.

1. Plain MV3. No bundler, no framework, no TypeScript.
2. Selections grow without limit and need indexed queries, so they are in
   IndexedDB rather than `chrome.storage`.
3. The service worker is the only writer.
4. Capture triggers on mouse-up, double-click and shift-select. It does not
   trigger on `selectionchange`, so a slow drag does not save partial text.
5. Widening a selection updates the previous record instead of adding a second
   one. The window is 4 seconds and the same URL.
6. The manager page is a full tab, opened by the toolbar icon. There is no
   popup, so the switches live on that page.
7. Data stays on this machine. Nothing is sent anywhere, and there is no sync.
8. A content script cannot reach another extension's pages. Chrome forbids the
   injection. The clipboard is the only channel to that text.
9. The extension asks for no `tabs` permission, so the service worker cannot
   read a tab's URL. Anything it needs about a page comes from the content
   script.
