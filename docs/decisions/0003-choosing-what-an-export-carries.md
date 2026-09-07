# 0003 — Choosing what an export carries

**Date:** 2026-09-06

## Context

The three download buttons each wrote a fixed set of fields. Wanting the names
with their dates meant taking the JSON and reading it by hand.

## Decision

`format` takes a list of fields. `FIELDS` in `lib/format.js` is the one list,
and every builder sorts what it is given back into that order, so one set of
boxes writes one order of columns.

The boxes sit in one closed control beside the download buttons. Its summary
reads what the next file will carry.

The choice is stored as `exportFields` in `chrome.storage.local`. `null` means
every field, which is what a profile with nothing stored reads as.

Every box unticked is refused at the button. The builders write empty records
rather than throw, and a test holds that.

## Why the control sits with the buttons

The choice decides what a download button writes, so it has to be readable where
that button is. A choice made in Settings is invisible at the moment it is used:
the same button would write different files on different days with nothing on
screen to explain why.

Six always-open checkboxes were the first attempt. They pushed **Clear all**
onto a second row under 1000px, away from the divider that separated it. Closing
them into one control with a summary keeps both the answer and the space.

## Rejected

- **The boxes in Settings.** Invisible where it matters.
- **A field list on the JSON backup.** It is the only file that restores a
  graph of records exactly.
- **`id` as an offered field.** It is the database's own key and means nothing
  outside this profile. A JSON import would change that; see
  [the roadmap](../roadmap.md).
- **Always writing the date, with no boxes.** A file meant for a diff is worse
  for a column nobody asked for.
