# 0006 — Editing text on the manager page

**Date:** 2026-10-07

This record changes the single writer rule in
[0001](0001-the-shape-of-the-extension.md).

## Context

A saved selection often needs a small fix. A word is cut off, or extra text
came along. The only way to fix it was to delete it and select again.

## Decision

The page edits the text of a record in place. The text becomes a
`contenteditable="plaintext-only"` box. The other fields stay. `ts` stays the
save date. The edited text is what search, copy and export use.

An empty text is refused. Delete is the way to remove a record.

### The page writes

The page calls `updateText` in `lib/db.js` directly. It already deleted records
that way.

The service worker is still the only code that adds a record. That part of the
rule protects the supersede check and the site rules. An edit does not touch
either.

## Rejected

- **Send edits through the service worker.** It adds a message type and a
  round trip. It protects nothing the page does not already do for deletes.
