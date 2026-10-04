# Testing

## The suite

`npm test` runs `node --test` over `test/`. `fake-indexeddb` lets `lib/db.js`
run outside a browser, so nothing opens.

Covered: add, search, host and date filters, paging, the supersede rule, delete,
clear, retention, the site list rules, migration, host parsing, and the three
export builders.

## What the suite cannot reach

`content.js`, `background.js`, `page/`, `popup/` and `offscreen/` all need a
browser. None of them is
covered. A change to any of them is unverified until someone drives it.

Run this list by hand after such a change. Reload the extension first, then
reload each page you test on — content scripts only attach to pages loaded after
the reload.

1. Select text on a site that is not listed. Nothing is saved, and the icon
   shows no mark.
2. Click the icon, then **Add site**. The icon shows a green mark. Select text.
   It is saved.
3. Select text inside a text box. Nothing is saved.
4. Untick **Select** for the site. Select text. Nothing is saved. Press the
   shortcut. The selection is saved with its page.
5. Copy text in another app. Press the shortcut with nothing selected. It is
   saved as `Clipboard`.
6. Copy text in a dictionary popup. Press the shortcut while the popup has the
   focus. The copied text is saved, not an old page selection.
7. Press the shortcut on a site that is not listed. A toast says so.
8. Change the key at `chrome://extensions/shortcuts`. The new key works. The
   popup shows it.
9. Search, filter by site, filter by date. Delete one row. Delete a selection.
10. Download JSON, CSV and TXT. Untick some fields and download again.
11. Copy one row, and a selection of rows.
12. Turn recording off. The icon shows `off`, and neither selection nor the
    shortcut saves.

## Reading the storage

The service worker console is the fastest way to see what a setting actually
stored. Open `chrome://extensions`, click **service worker** under Selected, and
run:

```js
chrome.storage.local.get(null).then(console.log);
```

Settings that look wrong but read correctly there mean the page saved fine and
the worker is running older code. Reload the extension.
