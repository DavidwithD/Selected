# Selected

A Chrome extension. It saves every text you select, automatically. One page lets
you browse, filter, copy, export and delete what it saved.

Everything stays on this machine. Nothing is uploaded.

This page is for installing it and driving it. How it is built is
[docs/architecture.md](docs/architecture.md), and why it is built that way is
[docs/decisions/](docs/decisions/).

## Install for development

1. Open `chrome://extensions`.
2. Turn on Developer mode.
3. Click "Load unpacked" and pick this folder.
4. Click the toolbar icon to open the saved text page.

Reload the extension from `chrome://extensions` after you change a file. The
manager page is read from disk every time you open it, but `content.js` and
`background.js` only change on a reload. Content scripts then attach to pages
loaded after it, so reload the page you are testing on too.

## What it never saves

- Text in an `<input>` or a `<textarea>`.
- Anything from an incognito window. The extension is disabled there.
- Anything the site lists refuse. See [Which sites record](#which-sites-record).
- A selection shorter than 2 characters or longer than 20000.
- The same text twice within 4 seconds.

A selection you widen within 4 seconds replaces the narrower one.

## Clipboard capture

Off by default. Turn it on under Settings, "Save what I copy".

Some text cannot be selected into this extension at all. A dictionary popup
drawn as a `chrome-extension://` iframe is one example. The clipboard is the way
in:

1. Select the text in the popup and press Ctrl+C.
2. Click back on the page.
3. Press Ctrl+Shift+S. On macOS, Command+Shift+S.

A message in the corner of the page says what happened. The key is the only
trigger, and it is fixed — you cannot rebind it yet.

A clipboard record has no source page. It is stored under the host `clipboard`,
so the site filter can pick it out, and the list shows a `Clipboard` label in
place of a link. A second press on the same clipboard saves nothing.

Why a keypress and not something automatic:
[0002](docs/decisions/0002-clipboard-capture-on-a-keypress.md).

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

- **Recording** — the switch in the header. It pauses both sources at once.
- **Save what I select** — on by default. Text you select on a page.
- **Save what I copy** — off by default. See [Clipboard
  capture](#clipboard-capture).
- **Keep selections for** — default 90 days. Leave the box empty to keep
  everything. A cleanup runs every 6 hours and on browser start.
- **Record on** — see below.

The two source switches take effect the moment you click them. Everything else
waits for **Save settings**.

### Which sites record

One select above one list.

- **Record on every site except these** — the default. It records everywhere
  but the hosts you list. This list stops clipboard capture on those sites too.
- **Record only on these sites** — it records nowhere but the hosts you list.
  An empty list records nothing, and saving one says so.

One host per line, and a host also covers its subdomains. Paste a whole URL if
that is what you have; it is reduced to its host. Both lists are kept, so
switching modes does not lose the one you typed.

The toolbar badge reads `off` on any page that will not record, and when both
source switches are off.

The allow-list does not stop the clipboard shortcut
([0004](docs/decisions/0004-recording-only-on-listed-sites.md)).

## Scripts

- `npm test` — run the test suite.
- `npm run icons` — regenerate the toolbar icons.
- `npm run format` — run Prettier.

## Documents

- [docs/architecture.md](docs/architecture.md) — the modules, the flow, the
  record, and the constraints they are built under.
- [docs/decisions/](docs/decisions/) — why each part works the way it does, and
  what was rejected.
- [docs/testing.md](docs/testing.md) — what the suite covers, and the checks
  that need a browser.
- [docs/roadmap.md](docs/roadmap.md) — what is next, and the open questions.
