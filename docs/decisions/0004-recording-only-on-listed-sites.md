# 0004 — Recording only on listed sites

**Date:** 2026-09-06

## Context

The blocklist was the only way to narrow capture. It suits someone who wants
everything but a few sites. It is useless to someone who reads on four sites and
wants those four, because naming the rest means naming the web.

## Decision

`hostMode` chooses which list decides. `block` records everywhere but
`blockedHosts`, and is the default, so nothing changes for a profile that never
opens Settings. `allow` records nowhere but `allowedHosts`.

`hostRecords()` in `lib/settings.js` is the one decision. `matchesHost()` is the
subdomain rule both lists share. `isBlocked()` stays as its block-mode name.

The mode takes effect on **Save settings**, with the lists it decides between.
Both lists are stored, so a swap back finds the one you typed.

The panel is a select over a textarea, and nothing else. The select is the whole
sentence, so no label over either control has to repeat it.

## The badge carries this feature

The badge is per-tab, and reads `off` on any page that will not record.

An allow-list saves nothing on most pages, and a page that saves nothing looks
exactly like a page with nothing worth saving. The two failure modes are not
symmetrical: a wrong blocklist records something you did not want, and you see
it and delete it. A wrong allow-list records nothing, and you find out weeks
later. The badge is what makes the second one visible, so it is part of the
feature rather than a nicety.

The host comes from the content script, not from `tab.url`. Reading a tab's URL
needs the `tabs` permission, which is a wider install prompt for a badge. A page
with no content script keeps the global badge; see [the
roadmap](../roadmap.md).

## The clipboard shortcut ignores the allow-list

Selection capture is ambient, and the list narrows it. A keypress is a request
for that text on that page. The blocklist still applies in block mode: a host
named there is one no text should come from, however it is asked for.

## A pasted URL is reduced to its host

Both lists match against `location.hostname`, which carries no scheme, no port
and no path. `parseHosts` kept all three until 2026-09-08, so an entry typed as
a URL matched nothing.

That defect was as old as the blocklist and hid there. A blocklist entry
matching nothing means "records everywhere", which looks like ordinary
behaviour. The same entry on an allow-list means "records nowhere", so the
setting appears to do nothing.

`getSettings` reads both stored lists back through the parser, so a profile that
already saved a URL repairs itself on the next read.

## Rejected

- **One list with a mode that empties it.** Switching modes would destroy the
  list you had typed.
- **Applying the mode on click, like the capture switches.** It would apply a
  list nobody had reviewed.
- **A `tabs` permission for the badge.** A wider install prompt to read a
  hostname the content script already knows.
