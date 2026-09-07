# 0002 — Clipboard capture on a keypress

**Date:** 2026-08-27, revised 2026-09-05

## Context

A content script cannot run inside another extension's pages. Chrome forbids the
injection. Some dictionaries draw their popup as a `chrome-extension://` iframe
inside the page, and that frame is closed the same way. Text selected there
cannot be reached at all.

The clipboard is the only channel to it.

## Decision

The content script reads the clipboard when the user presses Ctrl+Shift+S,
Command+Shift+S on macOS. It is off by default, behind its own switch.

The listener runs in every frame. A key event reaches only the focused frame, so
one press sends one message. The service worker drops the text when it matches
the newest record, so a second press on the same clipboard saves nothing.

The record is stored with `source: 'clipboard'`, host `clipboard`, and no url.

## Why a keypress, and not a heuristic

The first version read the clipboard when the top window fired blur and then
focus, with the tab still visible. That guessed at a popup, and it failed twice.

A popup drawn as a `chrome-extension://` iframe removes itself when you click
back. The window fires blur when focus enters the iframe. It never fires focus,
because the browser window never lost focus at the OS level. The read never ran.

The same shape appeared on every switch back from another application. The
extension read whatever had been copied there.

A keypress fixes both. The read happens when, and only when, the user asks for
it. The `lastClipboard` entry in `chrome.storage.session` went with the
heuristic; it existed because an ambient read fired on every focus, and one
press cannot repeat itself.

## Rejected

- **The blur/focus heuristic.** Described above. It read text nobody asked it
  to.
- **`chrome.commands` for a rebindable key.** It needs `host_permissions` for
  `tabs.sendMessage`, because the service worker has no clipboard of its own.
  That is a wider install prompt for a remappable key. Left in
  [the roadmap](../roadmap.md).
