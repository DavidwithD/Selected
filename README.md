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

A record is `{ id, text, ts, url, title, host, source }`. `source` is
`selection` or `clipboard`.

## What it never saves

- Text in an `<input>` or a `<textarea>`.
- Anything from an incognito window. The extension is disabled there.
- Anything from a host on your blocklist, and its subdomains.
- A selection shorter than 2 characters or longer than 20000.
- The same text twice within 4 seconds.

A selection you widen within 4 seconds replaces the narrower one.

## Clipboard capture

Off by default. Turn it on under Settings, "Also save what I copy".

A content script cannot run inside an extension popup. Chrome forbids one
extension from injecting into another extension's pages. Text you select there
is out of reach.

The clipboard is the way in. Select the text in the popup and press Ctrl+C. The
popup closes when you click back on the page. The extension reads the clipboard
at that moment and saves what it finds.

The trigger is a shape, not the popup itself: the window loses focus, the tab
stays visible, focus comes back within a minute. Tab switches and minimised
windows are skipped. Switching to another application draws the same shape, so
text you copy in another application is saved too. The page cannot tell the two
apart.

A clipboard record has no source page. It is stored under the host `clipboard`,
so the site filter can pick it out, and the list shows a `Clipboard` label in
place of a link.

The same text is not saved twice. It is skipped when it is still in the
clipboard on the next focus, and when it is already the newest record. The first
focus after a browser restart is the exception. Whatever sits in the clipboard
then is saved once.

## Settings

Open the page and expand "Settings".

- **Recording** — the switch in the header. The badge shows `off` when paused.
- **Keep selections for N days** — default 90. A cleanup runs every 6 hours and
  on browser start. 0 keeps everything.
- **Never record on these sites** — one host per line. A host also covers its
  subdomains. The blocklist stops clipboard capture on those sites too.
- **Also save what I copy** — off by default. See "Clipboard capture" above.

## Scripts

- `npm test` — run the storage and blocklist tests.
- `npm run icons` — regenerate the toolbar icons.
- `npm run format` — run Prettier.

See [docs/plan.md](docs/plan.md) for the plan and the open questions.
