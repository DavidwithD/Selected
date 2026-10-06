# Selected

A Chrome extension. It saves the text you select on the sites you choose. A
shortcut saves a selection or the clipboard. One page lets you browse, filter,
copy, export and delete what it saved.

Everything stays on this machine. Nothing is uploaded.

This page is for installing it and driving it. How it is built is
[docs/architecture.md](docs/architecture.md), and why it is built that way is
[docs/decisions/](docs/decisions/).

## Install for development

1. Open `chrome://extensions`.
2. Turn on Developer mode.
3. Click "Load unpacked" and pick this folder.
4. Click the toolbar icon, then **Open saved text**.

Reload the extension from `chrome://extensions` after you change a file. The
manager page is read from disk every time you open it, but `content.js` and
`background.js` only change on a reload. Content scripts then attach to pages
loaded after it, so reload the page you are testing on too.

## What it never saves

- Text in an `<input>` or a `<textarea>`.
- Anything from an incognito window. The extension is disabled there.
- Anything on a site that is not on your list. See [Sites](#sites).
- A selection shorter than 2 characters or longer than 20000.
- The same text twice within 4 seconds.

A selection you widen within 4 seconds replaces the narrower one.

## Sites

Nothing is saved on a site until you add it. On a page, click the toolbar icon,
then **Add site**. You can also add one under Settings on the manager page.
Paste a whole URL if that is what you have. It is reduced to its host.

Each site has two boxes:

- **Select** saves what you select there.
- **Shortcut** lets the shortcut save there.

A site also covers its subdomains. When two entries cover a page, the longer
one decides. With `naver.com` and `dict.naver.com` both listed,
`dict.naver.com` uses its own boxes.

The toolbar icon shows a green mark on a listed site. It shows `off` everywhere
while recording is paused.

## The shortcut

The default is Ctrl+Shift+S, and Command+Shift+S on macOS. Change it at
`chrome://extensions/shortcuts`. The popup and the manager page show the
current key, with a link there.

On a listed site with **Shortcut** ticked, the key saves:

- the text you selected, with its page, or
- the clipboard, when nothing is selected.

A message in the corner of the page says what happened. A second press on the
same text saves nothing.

The clipboard covers text the extension cannot reach. A dictionary popup drawn
as a `chrome-extension://` iframe is one example. Copy the text in the popup,
then press the key.

A clipboard record has no source page. It is stored under the host `clipboard`,
so the site filter can pick it out. The list shows a `Clipboard` label in place
of a link.

If the key does nothing, check two things. Another extension may use it, and
then Chrome leaves Selected's key empty. macOS may use it too. For example,
Command+Shift+Y makes a Stickies note, and Chrome never sees it.

Why it works this way:
[0005](docs/decisions/0005-one-site-list-and-a-chrome-shortcut.md).

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

- **Recording** — the switch in the header. It pauses everything at once.
- **Keep selections for** — default 90 days. Leave the box empty to keep
  everything. A cleanup runs every 6 hours and on browser start. A new value
  applies when you press Enter or leave the box. If a shorter window would
  delete records, the page says how many and asks first.
- **The site list** — see [Sites](#sites). A box or a ✕ takes effect on click.

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
