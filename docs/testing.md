# Testing

## The suite

`npm test` runs `node --test` over `test/`. `fake-indexeddb` lets `lib/db.js`
run outside a browser, so nothing opens.

Covered: add, search, host and date filters, paging, the supersede rule, delete,
clear, retention, the site rules, host parsing, and the three export builders.

## What the suite cannot reach

`content.js`, `background.js` and `page/` all need a browser. None of them is
covered. A change to any of them is unverified until someone drives it.

Run this list by hand after such a change. Reload the extension first, then
reload each page you test on — content scripts only attach to pages loaded after
the reload.

1. Select text on two different sites. Open the page. Both appear.
2. Select text inside a text box. Nothing is saved.
3. Add a host to the blocklist, reload that page, select text. Nothing is saved.
4. Switch to "Record only on these sites", list one host, save. Selecting on
   another site saves nothing, and the badge reads `off` there.
5. Search, filter by site, filter by date. Delete one row. Delete a selection.
6. Download JSON, CSV and TXT. Untick some fields and download again.
7. Copy one row, and a selection of rows.
8. Turn recording off. The badge shows `off` and nothing is saved.

## Reading the storage

The service worker console is the fastest way to see what a setting actually
stored. Open `chrome://extensions`, click **service worker** under Selected, and
run:

```js
chrome.storage.local.get(null).then(console.log);
```

Settings that look wrong but read correctly there mean the page saved fine and
the worker is running older code. Reload the extension.
