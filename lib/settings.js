// Settings live in chrome.storage.local. The page and the popup write them.
// The service worker and the content script read them.

export const DEFAULTS = {
  recording: true,
  // 0 means keep everything.
  retentionDays: 90,
  // The sites that save anything. A site not on the list saves nothing.
  // Each entry is { host, select, shortcut }. `select` saves what you select
  // there. `shortcut` lets the shortcut save the selection or the clipboard.
  sites: [],
  // Which record fields a download carries. null means every field. The list
  // itself lives in lib/format.js, which the content script does not load.
  exportFields: null,
};

// Keys from the two-mode settings. migrateSites reads them once. The service
// worker removes them after it writes `sites`.
export const OLD_KEYS = [
  'hostMode',
  'blockedHosts',
  'allowedHosts',
  'captureSelection',
  'captureClipboard',
];

export async function getSettings() {
  const stored = await chrome.storage.local.get(null);
  return {
    recording: stored.recording !== false,
    retentionDays: Number(stored.retentionDays ?? DEFAULTS.retentionDays) || 0,
    sites: migrateSites(stored),
    exportFields: Array.isArray(stored.exportFields)
      ? stored.exportFields
      : null,
  };
}

export function setSettings(patch) {
  return chrome.storage.local.set(patch);
}

/**
 * The site list from whatever is stored.
 *
 * A profile from before the site list has `allowedHosts` and no `sites`. Its
 * allow-list becomes the site list, whatever mode it was in. Each site keeps
 * the old selection switch. The shortcut is on, because a key press is a
 * request. The blocklist is dropped. A profile that saved nothing gets an
 * empty list.
 */
export function migrateSites(stored) {
  if (Array.isArray(stored?.sites)) return cleanSites(stored.sites);
  const select = stored?.captureSelection !== false;
  return cleanHosts(stored?.allowedHosts).map((host) => ({
    host,
    select,
    shortcut: true,
  }));
}

/**
 * A stored site list, read back through the host parser.
 *
 * An entry with a host that parses to nothing is dropped. Two entries for one
 * host keep the first. A box that is not `false` reads as ticked, so a
 * half-written entry saves rather than going silent.
 */
export function cleanSites(list) {
  if (!Array.isArray(list)) return [];
  const byHost = new Map();
  for (const entry of list) {
    const host = hostOfEntry(String(entry?.host ?? ''));
    if (!host || byHost.has(host)) continue;
    byHost.set(host, {
      host,
      select: entry.select !== false,
      shortcut: entry.shortcut !== false,
    });
  }
  return [...byHost.values()].sort((a, b) => a.host.localeCompare(b.host));
}

/**
 * The site entry that decides for a host, or null.
 *
 * A listed host also covers its subdomains. When two entries cover a host, the
 * longer one decides. With `naver.com` and `dict.naver.com` both listed,
 * `dict.naver.com` uses its own boxes.
 */
export function siteFor(host, sites) {
  if (!host) return null;
  let best = null;
  for (const site of sites || []) {
    if (!matchesHost(host, [site.host])) continue;
    if (!best || site.host.length > best.host.length) best = site;
  }
  return best;
}

/**
 * Reduce one typed line to a bare host.
 *
 * People paste what is in the address bar. The list matches against
 * `location.hostname`, which carries no scheme, no port and no path. An entry
 * that keeps any of them matches nothing, and that site saves nothing.
 */
function hostOfEntry(line) {
  let one = line.trim().toLowerCase();
  if (!one) return '';
  one = one.replace(/^[a-z][a-z0-9+.-]*:\/\//, ''); // scheme
  one = one.replace(/^\/+/, ''); // a line that began with //
  one = one.split(/[/?#]/)[0]; // path, query, fragment
  one = one.slice(one.lastIndexOf('@') + 1); // user:password@
  one = one.replace(/:\d+$/, ''); // port
  return one.replace(/^www\./, '');
}

/**
 * A stored host list, read back through the parser.
 *
 * A list saved before `parseHosts` learned to strip a scheme is still in
 * storage. Cleaning it here means no caller gets an entry that matches nothing.
 */
export function cleanHosts(list) {
  return Array.isArray(list) ? parseHosts(list.join('\n')) : [];
}

/** One host per line, lowercase, no empty lines, no duplicates. */
export function parseHosts(input) {
  const hosts = input
    .split(/[\s,]+/)
    .map(hostOfEntry)
    .filter(Boolean);
  return [...new Set(hosts)].sort();
}

/** A listed host also matches its subdomains. */
export function matchesHost(host, hosts) {
  if (!host) return false;
  const target = host.toLowerCase();
  return (hosts || []).some((listed) => {
    const one = String(listed).toLowerCase();
    return one && (target === one || target.endsWith(`.${one}`));
  });
}

export function hostOfUrl(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}
