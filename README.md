# Selected

A Chrome extension. It saves every text you select, automatically. One page lets
you browse, filter, copy, export and delete what it saved.

Everything stays on this machine. Nothing is uploaded.

## Install for development

1. Open `chrome://extensions`.
2. Turn on Developer mode.
3. Click "Load unpacked" and pick this folder.
4. Click the toolbar icon to open the saved text page.

Reload the extension from `chrome://extensions` after you change a file. The
content script only runs on pages loaded after the reload.

## How it works

- `content.js` runs on every page. It reads the selection after a mouse-up, a
  double-click or a shift-select, waits 250 ms, then sends the text to the
  service worker.
- `background.js` is the only writer. It stores records in IndexedDB. It also
  runs the cleanup that drops old records.
- `page/` is the manager page. It reads the same database directly.
- `lib/db.js` holds the queries. `lib/settings.js` holds the settings and the
  blocklist rules. `lib/format.js` builds the export files and holds the list of
  fields they can carry.

A record is `{ id, text, ts, url, title, host, source }`. `source` is
`selection` or `clipboard`. Each source has its own switch.

## What it never saves

- Text in an `<input>` or a `<textarea>`.
- Anything from an incognito window. The extension is disabled there.
- Anything from a host on your blocklist, and its subdomains.
- A selection shorter than 2 characters or longer than 20000.
- The same text twice within 4 seconds.

A selection you widen within 4 seconds replaces the narrower one.

## Clipboard capture

Off by default. Turn it on under Settings, "Save what I copy".

A content script cannot run inside an extension popup. Chrome forbids one
extension from injecting into another extension's pages. Some dictionaries draw
their popup as a `chrome-extension://` iframe inside the page. That frame is
closed the same way. Text you select there is out of reach.

The clipboard is the way in. Select the text in the popup and press Ctrl+C.
Click back on the page. Then press Ctrl+Shift+S. On macOS
Command+Shift+S works too. The extension reads the clipboard and saves what it
finds.

The key is the only trigger. Nothing is read while you work, and nothing is read
after you switch back from another application. A message in the corner of the
page says what happened.

The shortcut is fixed. You cannot change it yet.

A clipboard record has no source page. It is stored under the host `clipboard`,
so the site filter can pick it out, and the list shows a `Clipboard` label in
place of a link.

A second press on the same clipboard saves nothing. The text is skipped when it
is already the newest record.

## Download

Three buttons write every row the current filter matches: JSON, CSV or TXT.

Beside them sits one control, closed. It reads what the next file will carry —
"carrying all 6 fields", or "carrying text, url +1". Open it for six boxes:
**text**, **url**, **title**, **host**, **source**, **date**. All six start
ticked. The choice applies to all three buttons and is remembered between
visits.

Each format uses the choice its own way.

- **JSON** keeps only the chosen keys on each item.
- **CSV** writes one column per chosen field, header included.
- **TXT** puts the text on top, then the title, host, source and date on one
  meta line, then the url. A part it was not given is left out.

Unticking every box downloads nothing. The page says to pick one.

## Settings

Open the page and expand "Settings".

- **Recording** — the switch in the header. It pauses both sources at once. The
  badge shows `off` when paused.
- **Save what I select** — on by default. Text you select on a page.
- **Save what I copy** — off by default. See "Clipboard capture" above.
- **Keep selections for N days** — default 90. A cleanup runs every 6 hours and
  on browser start. 0 keeps everything.
- **Never record on these sites** — one host per line. A host also covers its
  subdomains. The blocklist stops clipboard capture on those sites too.

The two source switches are independent. Turn selection off and clipboard on to
save only what you copy. The badge shows `off` when both are off, the same as a
pause.

## Scripts

- `npm test` — run the storage and blocklist tests.
- `npm run icons` — regenerate the toolbar icons.
- `npm run format` — run Prettier.

See [docs/plan.md](docs/plan.md) for the plan and the open questions.
