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
  blocklist rules. `lib/format.js` builds the export files.

A record is `{ id, text, ts, url, title, host }`.

## What it never saves

- Text in an `<input>` or a `<textarea>`.
- Anything from an incognito window. The extension is disabled there.
- Anything from a host on your blocklist, and its subdomains.
- A selection shorter than 2 characters or longer than 20000.
- The same text twice within 4 seconds.

A selection you widen within 4 seconds replaces the narrower one.

## Settings

Open the page and expand "Settings".

- **Recording** — the switch in the header. The badge shows `off` when paused.
- **Keep selections for N days** — default 90. A cleanup runs every 6 hours and
  on browser start. 0 keeps everything.
- **Never record on these sites** — one host per line. A host also covers its
  subdomains.

## Scripts

- `npm test` — run the storage and blocklist tests.
- `npm run icons` — regenerate the toolbar icons.
- `npm run format` — run Prettier.

See [docs/plan.md](docs/plan.md) for the plan and the open questions.
