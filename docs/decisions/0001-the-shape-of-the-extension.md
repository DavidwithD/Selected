# 0001 — The shape of the extension

**Date:** 2026-08-21

## Context

A tool that saves every selection has to decide four things before any code
works: where the records live, who writes them, how the user pauses it, and what
is never recorded at all.

## Decision

| Question   | Answer                                                     |
| ---------- | ---------------------------------------------------------- |
| Storage    | IndexedDB. `chrome.storage.local` holds only the settings. |
| Writer     | The service worker, alone. The page reads and deletes.     |
| Retention  | Keep the last N days. Default 90. Editable on the page.    |
| Duplicates | Keep every capture. The same text twice is two records.    |
| Pause      | A switch on the page. No popup, no context menu.           |
| Exclusions | Site list, no incognito windows, no form fields at all.    |

Plain MV3 throughout: no bundler, no framework, no TypeScript.

## Why

Selections grow without limit and need indexed queries.
`chrome.storage.local` gives neither, and it has a quota that a year of reading
would pass.

One writer means no second process can race the supersede rule, which reads the
newest record before deciding whether to add or update.

A popup would need its own HTML, its own stylesheet and its own copy of the
switches. The manager page already exists and is where someone goes to look at
what was saved.

## Rejected

- **`chrome.storage.local` for records** — no indexes, and a quota.
- **A popup for the switches** — a second surface holding the same state.
- **Dropping duplicates on write** — the same sentence saved twice from two
  pages is two facts, not one mistake.
- **A context menu entry to pause** — a third place to keep in step with the
  switch and the badge.
