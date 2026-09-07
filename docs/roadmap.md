# Roadmap

What is built is in the [README](../README.md). This is what is not.

## Next

- A "Block this site" button on each row. It adds the host to the list the
  current mode uses.
- Download only the selected rows, not just every match of the filter.
- Undo after a delete.
- A minimum length setting.
- A keyboard shortcut to open the page.
- A rebindable clipboard shortcut. `chrome.commands` would do it, but it needs
  `host_permissions` for `tabs.sendMessage`, because the service worker has no
  clipboard of its own. That is a wider install prompt for a remappable key.

## Scale

- The query scans the `ts` index on every keystroke, capped at 100000 records.
  Above that, search needs a real index. Options: a lowercase copy of the text,
  a token index, or keyset paging instead of an offset.
- The list renders one DOM node per row. 100 rows per page is fine. A virtual
  list is only needed if the page size grows.

## Polish

- Group the list by day or by site.
- Import a JSON export back into the database. That is when a record needs an id
  a file can carry.
- Tags, stars or notes on a record.

## Open questions

1. **Rich text editors.** Form fields are skipped, but a `contenteditable` box
   is not. Gmail compose and Notion are `contenteditable`. Should those be
   skipped too?
2. **Whitespace.** The text is stored as selected, trimmed only. Newlines and
   indentation are kept. Good for code, noisy for text copied out of a PDF.
3. **Blocked hosts and old records.** Adding a host to the blocklist stops new
   captures. It does not delete what that host already saved. Should it?
4. **PDF files.** Chrome's built-in PDF viewer does not run content scripts.
   Selections there are lost. Accept it, or handle it later?
5. **Pages with no content script.** The Web Store, `chrome://` pages and the
   PDF viewer keep the global badge rather than reading `off`. They never
   recorded anything, so the badge is only cosmetically wrong.
6. **One field set for three formats.** A CSV wanted as a table and a TXT wanted
   for reading may want different sets.
