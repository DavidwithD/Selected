# Selected — plan

Status: phase 1, clipboard capture, the export field choice and the site
allow-list are built and loadable. `npm test` passes, 53 tests.

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
| Exclusions | Site list, no incognito windows, no form fields at all.      |

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
- Download every match as JSON, CSV or TXT, carrying the fields you tick.
- Clear all.
- Settings: recording switch, retention days, the site list and its mode.
- Dark mode. `/` focuses the search box.

## Clipboard capture (done)

Added on 2026-08-27. Off by default, one checkbox on the manager page.

- The content script reads the clipboard on Ctrl+Shift+S, Command+Shift+S on
  macOS. The listener runs in every frame. A key event reaches only the focused
  frame, so one press sends one message.
- It sends the text to the service worker, which drops it when it matches the
  newest record.
- The record is stored with `source: 'clipboard'`, host `clipboard`, no url.
- The content script shows the result in a toast. The toast sits in a closed
  shadow root, out of reach of page styles and page scripts.
- Each source has its own switch: `captureSelection` on, `captureClipboard`
  off. The header `recording` switch pauses both. The badge reads `off` when
  nothing can be saved.

## Why the shortcut replaced blur/focus (2026-09-05)

The first version read the clipboard when the top window fired blur and then
focus, with the tab still visible. That guessed at a popup. It failed twice.

A popup drawn as a `chrome-extension://` iframe inside the page removes itself
when you click back. The window fires blur when focus enters the iframe. It
never fires focus, because the browser window never lost focus at the OS level.
The read never ran.

The same shape also appeared on every switch back from another application. The
extension read whatever you had copied there.

A keypress fixes both cases. The read happens only when the user presses the
key. The `lastClipboard` record in `chrome.storage.session` went with the
heuristic. It existed because the ambient read fired on every focus.

Open: the key is fixed in `content.js`. `chrome.commands` would let the user
remap it, but it needs `host_permissions` for `tabs.sendMessage`, because the
service worker has no clipboard of its own. That is a wider install prompt for a
remappable key.

## Export field choice (done)

Added on 2026-09-06. One closed control beside the three download buttons. It
opens on six boxes: text, url, title, host, source, date.

The boxes were inline in the bar first. Six of them pushed Clear all onto a
second row under 1000px, away from the divider that separated it. Settings was
the other place considered. It was rejected: the choice decides what a download
button writes, so it has to be readable where that button is. The summary text
is what makes the closed control honest.

- `FIELDS` in `lib/format.js` is the one list. Every builder takes the chosen
  fields and sorts them back into that order, so one set of boxes writes one
  order of columns.
- The choice is stored as `exportFields` in `chrome.storage.local`. `null` means
  every field, which is what a profile with no stored list reads as.
- `id` is not on offer. It is the database's own key and means nothing outside
  this profile. Phase 4 wants a JSON import; that is when a record needs an id
  a file can carry.
- TXT gained title and source on its meta line. Untick both and it writes what
  it wrote before.
- Every box unticked is refused at the button. The builders would write empty
  records rather than throw, and the tests hold that.
- The summary names two fields and a count. Five names make the control wider
  than the three buttons beside it.

Open: the choice is one set for all three formats. A CSV wanted as a table and a
TXT wanted for reading may want different sets.

## Site allow-list (done)

Added on 2026-09-06. `hostMode` chooses which list decides: `block` records
everywhere but `blockedHosts`, `allow` records nowhere but `allowedHosts`.

- `hostRecords()` in `lib/settings.js` is the one decision. `matchesHost()` is
  the subdomain rule both lists share. `isBlocked()` stays as its block-mode
  name.
- `content.js` keeps a copy of the rule, as it did before. It cannot import a
  module. The copy only saves a message per selection; `background.js` decides
  again with the real rule before anything is written.
- The badge is per-tab now. It reads `off` on any page that will not record.
  An allow-list saves nothing on most pages, and that is invisible without it.
- The host comes from the content script, not from `tab.url`. Reading a tab's
  URL needs the `tabs` permission, which is a wider install prompt for a badge.
  A page with no content script keeps the global badge.
- The clipboard shortcut ignores the allow-list. It obeys the blocklist in
  block mode. A shortcut is a request; a selection is ambient.
- The mode takes effect on Save, with the lists it decides between. Both lists
  are stored, so a swap back finds the old one.
- `parseHosts` reduces a pasted URL to its host. It did not before. The lists
  match on `location.hostname`, so an entry keeping its scheme, port or path
  matched nothing. On a blocklist that reads as "records everywhere" and hides.
  On an allow-list it reads as "records nowhere", which is the setting failing.
  `getSettings` re-parses both stored lists, so a profile saved before this
  fixes itself on read.
- The panel is a select over a textarea, and nothing else. The first version
  had a label over each and a hint under them: three lines of prose saying what
  the select already said. The subdomain rule moved to the README. The empty
  allow-list is still called out, as the toast on Save.

Open: a page with no content script — the Web Store, `chrome://` pages, the
built-in PDF viewer — shows the global badge rather than `off`. Those pages
never recorded anything anyway.

## Phase 2 — next

- A "Block this site" button on each row. It adds the host to the list the
  current mode uses.
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
