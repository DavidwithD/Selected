# Selected — plan

Status: phase 1 and clipboard capture are built and loadable. `npm test`
passes, 27 tests.

## Premises

These are the assumptions behind the code. Correct any that are wrong.

1. Plain MV3 extension. No bundler, no framework, no TypeScript. Same style as
   `shadowTranslator` and `Vocabulary`.
2. Storage is IndexedDB, not `chrome.storage`. Selections grow without limit and
   need indexed queries. `chrome.storage.local` holds only the settings.
3. The service worker is the only writer. The manager page only reads and
   deletes.
4. Capture triggers on mouse-up, double-click and shift-select. It does not
   trigger on `selectionchange`, so a slow drag does not save partial text.
5. Widening a selection updates the previous record instead of adding a second
   one. The window is 4 seconds and the same URL.
6. The manager page is a full tab, opened by the toolbar icon. There is no
   popup. The switches live on that page.
7. Data stays on this machine. Nothing is sent anywhere. There is no sync.
8. A content script cannot reach an extension popup. Chrome forbids injection
   into another extension's pages. The clipboard is the only channel to that
   text, and it is off by default.

## Decisions

Answered on 2026-08-21.

| Question   | Answer                                                       |
| ---------- | ------------------------------------------------------------ |
| Retention  | Keep the last N days. Default 90. Editable on the page.      |
| Duplicates | Keep every capture. The same text twice is two records.      |
| Pause      | The switch on the page is enough. No popup, no context menu. |
| Exclusions | Site blocklist, no incognito windows, no form fields at all. |

## Files

| File                     | Job                                            |
| ------------------------ | ---------------------------------------------- |
| `manifest.json`          | MV3 manifest. Content script on `<all_urls>`.  |
| `content.js`             | Reads the selection, debounces, sends it.      |
| `background.js`          | Writes records. Badge, icon click, cleanup.    |
| `lib/db.js`              | IndexedDB open, add, query, delete, retention. |
| `lib/settings.js`        | Defaults, blocklist rules, host parsing.       |
| `lib/clipboard.js`       | The clipboard dedupe rule.                     |
| `lib/format.js`          | JSON, CSV and TXT builders. Time formatting.   |
| `page/page.html/css/js`  | Manager page.                                  |
| `scripts/make-icons.cjs` | Draws the three PNG icons.                     |
| `test/*.test.js`         | Storage and blocklist tests. `npm test`.       |

## Phase 1 — base (done)

Capture:

- Selections on any page, in any frame.
- Skipped: form fields, blocked hosts, incognito windows, text under 2
  characters or over 20000, the same text twice within 4 seconds.
- A wider selection replaces the narrower one it contains.

Storage:

- IndexedDB, indexes on `ts` and `host`.
- A cleanup runs on install, on browser start, and every 6 hours. It drops
  records older than the retention window. 0 days keeps everything.

Manager page:

- List, newest first, with the source link and the time.
- Text search with the match highlighted, site filter, date range, sort order.
- Paging, 25 / 50 / 100 per page.
- Row actions: copy, delete, click the text to expand.
- Bulk: select page, copy selected, delete selected.
- Download every match as JSON, CSV or TXT.
- Clear all.
- Settings: recording switch, retention days, blocked hosts.
- Dark mode. `/` focuses the search box.

## Clipboard capture (done)

Added on 2026-08-27. Off by default, one checkbox on the manager page.

- The content script watches the top frame for a blur/focus pair while the tab
  stays visible. That is the shape a popup leaves behind.
- On that shape it reads the clipboard and sends the text to the service worker.
- The service worker drops the text when it matches the previous read, held in
  `chrome.storage.session`, or the newest record.
- The record is stored with `source: 'clipboard'`, host `clipboard`, no url.

Not solved: an alt-tab to another application draws the same shape as a popup.
`chrome.windows.onFocusChanged` may separate them. It is untested. If it stays
quiet while a popup opens, the service worker can refuse a capture taken across
a gap where the browser itself lost focus.

## Phase 2 — next

- A "Block this site" button on each row. It adds the host to the blocklist.
- Download only the selected rows, not just every match of the filter.
- Undo after a delete.
- A minimum length setting.
- A keyboard shortcut to open the page.

## Phase 3 — scale

- The query scans the `ts` index on every keystroke. It is capped at 100000
  records. Above that, search needs a real index.
- Options: store a lowercase copy of the text, a token index, or keyset paging
  instead of an offset.
- The list renders one DOM node per row. 100 rows per page is fine. A virtual
  list is only needed if the page size grows.

## Phase 4 — polish

- Group the list by day or by site.
- Import a JSON export back into the database.
- Tags, stars or notes on a record.

## Open questions

1. **Rich text editors.** Form fields are skipped, but a `contenteditable` box
   is not. Gmail compose and Notion are `contenteditable`. Should those be
   skipped too?
2. **Whitespace.** The text is stored as selected, trimmed only. Newlines and
   indentation are kept. Good for code, noisy for text copied out of a PDF.
3. **Blocked hosts and old records.** Adding a host to the blocklist stops new
   captures. It does not delete what that host already saved. Should it?
4. **PDF files.** Chrome's built-in PDF viewer does not run content scripts.
   Selections there are lost. Accept it, or handle it later?

## Testing notes

`npm test` runs `node --test` over `test/`. `fake-indexeddb` lets `lib/db.js`
run outside a browser. Covered: add, search, host and date filters, paging, the
supersede rule, delete, clear, retention, blocklist matching, host parsing.

Not covered: `content.js` and the page. Both need a browser. Check them by hand
after a change:

1. Select text on two different sites. Open the page. Both appear.
2. Select text inside a text box. Nothing is saved.
3. Add a host to the blocklist, reload that page, select text. Nothing is saved.
4. Search, filter by site, filter by date. Delete one row. Delete a selection.
5. Download JSON, CSV and TXT. Copy one row and a selection of rows.
6. Turn recording off. The badge shows `off` and nothing is saved.
