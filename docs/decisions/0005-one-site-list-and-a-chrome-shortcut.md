# 0005 — One site list, and a Chrome shortcut

**Date:** 2026-10-03

This record replaces two parts of earlier records. It replaces the clipboard
switch and the fixed key in [0002](0002-clipboard-capture-on-a-keypress.md). It
replaces the two modes and the shortcut rule in
[0004](0004-recording-only-on-listed-sites.md).

## Context

Block mode was the default. With an empty blocklist it saved every selection on
every site. Most of those were noise.

The shortcut sat behind a global switch. A key press is already a request, so
the switch added nothing. With the switch off, `content.js` still blocked the
key on every page.

The shortcut checked the page's host against the blocklist. The clipboard text
can come from another site or another app. The check looked at the wrong thing.

## Decision

`sites` is one list in `chrome.storage.local`. Each entry is
`{ host, select, shortcut }`. A site that is not on the list saves nothing.

- `select` saves what you select on that site.
- `shortcut` lets the shortcut save on that site.

`siteFor()` in `lib/settings.js` picks the entry for a host. A listed host
covers its subdomains. When two entries cover a host, the longer one decides.

You add a site from the toolbar popup or from the manager page. A new site
starts with both boxes ticked. A change takes effect on click.

## The shortcut

Chrome owns the key through `chrome.commands`. The default is Ctrl+Shift+S, and
Command+Shift+S on macOS. The user changes it at `chrome://extensions/shortcuts`.

Chrome catches the key before the page sees it. Websites get their own
Ctrl+Shift+S back once the user picks another key.

When the key is pressed, `background.js` does this:

1. It reads the tab's address. Pressing the key grants `activeTab`.
2. It finds the site entry. With no entry, or with the box off, it shows a
   toast and saves nothing.
3. It asks every frame of the tab for a selection. A frame answers only if it
   holds the focus and a selection. A frame whose focused element is an iframe
   does not answer. The check follows shadow roots down to the focused element.
4. With an answer, it checks the answering frame's host against the list. An
   iframe from an unlisted host saves nothing. The Select box applies the same
   rule.
5. It saves the selection with its url and title.
6. With no answer, it reads the clipboard and saves it as a clipboard record.

Text shorter than two characters saves nothing, and the toast says it is too
short.

Step 3 covers the dictionary popup from 0002. When the popup's frame has the
focus, the page's old selection does not answer. The shortcut then reads the
clipboard.

## The clipboard is read in an offscreen document

The service worker has no clipboard. `offscreen/offscreen.html` is a hidden page
of the extension. It pastes the clipboard into a text box and returns the text.
No website sees it. `clipboardRead` lets the paste run without a key press.

## The popup and `activeTab`

The toolbar icon opens `popup/popup.html`. It replaces the direct open of the
manager page. Clicking the icon grants `activeTab`, so the popup reads the tab's
address. 0004 rejected the `tabs` permission. `activeTab` adds no install
warning.

## The badge

A listed site shows a green mark. Other sites show nothing. Most sites are not
listed, so `off` on all of them would say nothing. `off` now means paused.

## Migration

`migrateSites()` builds `sites` from the old `allowedHosts`, whatever the old
mode was. Each site keeps the old selection switch. The shortcut box is on. The
blocklist is dropped. `onInstalled` writes the list once and removes the old
keys.

A profile that used block mode with an empty allow-list ends with an empty list.
It saves nothing until a site is added.

## Tested before building

A test extension checked each step in Chrome for Testing, and in Chrome 154 by
hand:

- A key set at `chrome://extensions/shortcuts` reached the extension.
- After the key press, `tab.url` was readable with only `activeTab`.
- `tabs.sendMessage` reached the content script with no `tabs` permission.
- The offscreen document read the clipboard in three cases. The page had focus,
  the page was in a background tab, and Chrome was in the background.
- `navigator.clipboard.readText()` in the page failed when the page had no
  focus.

Command+Shift+Y is a macOS system key. It makes a Stickies note, and Chrome
never sees it.

## Rejected

- **The global clipboard switch.** A key press is already a request.
- **The blocklist.** One list is simpler. Nothing is saved by default.
- **Asking once on an unknown site.** A prompt on every new site is noise.
- **Copy on select.** It replaces the clipboard without asking.
- **Three boxes per site.** "Shortcut saves the selection" and "shortcut saves
  the clipboard" share one key. One box covers both.
- **A key setting inside the extension.** The page still sees the key, so page
  shortcuts conflict.
- **Pasting into the web page.** The website's scripts can read the text.
