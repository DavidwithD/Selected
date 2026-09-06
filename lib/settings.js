// Settings live in chrome.storage.local. The page writes them.
// The service worker and the content script read them.

export const DEFAULTS = {
  recording: true,
  // 0 means keep everything.
  retentionDays: 90,
  blockedHosts: [],
  // Which list decides. 'block' records everywhere but the blocklist.
  // 'allow' records nowhere but the allow-list.
  hostMode: 'block',
  allowedHosts: [],
  // The two capture sources. Selection is the main one and is on.
  // Clipboard is off until the user asks for it.
  captureSelection: true,
  captureClipboard: false,
  // Which record fields a download carries. null means every field. The list
  // itself lives in lib/format.js, which the content script does not load.
  exportFields: null,
};

export async function getSettings() {
  const stored = await chrome.storage.local.get(DEFAULTS);
  return {
    recording: stored.recording !== false,
    retentionDays: Number(stored.retentionDays) || 0,
    blockedHosts: Array.isArray(stored.blockedHosts) ? stored.blockedHosts : [],
    hostMode: stored.hostMode === 'allow' ? 'allow' : 'block',
    allowedHosts: Array.isArray(stored.allowedHosts) ? stored.allowedHosts : [],
    captureSelection: stored.captureSelection !== false,
    captureClipboard: stored.captureClipboard === true,
    exportFields: Array.isArray(stored.exportFields)
      ? stored.exportFields
      : null,
  };
}

export function setSettings(patch) {
  return chrome.storage.local.set(patch);
}

/** One host per line, lowercase, no empty lines, no duplicates. */
export function parseHosts(input) {
  const hosts = input
    .split(/[\s,]+/)
    .map((line) =>
      line
        .trim()
        .toLowerCase()
        .replace(/^www\./, ''),
    )
    .filter(Boolean);
  return [...new Set(hosts)].sort();
}

/** A listed host also matches its subdomains. Both lists use this rule. */
export function matchesHost(host, hosts) {
  if (!host) return false;
  const target = host.toLowerCase();
  return (hosts || []).some((listed) => {
    const one = String(listed).toLowerCase();
    return one && (target === one || target.endsWith(`.${one}`));
  });
}

/** A blocked host also blocks its subdomains. */
export function isBlocked(host, blockedHosts) {
  return matchesHost(host, blockedHosts);
}

/**
 * Whether a page's host may be recorded.
 *
 * Block mode records everywhere except the blocklist. Allow mode records
 * nowhere except the allow-list, so an empty allow-list records nothing. The
 * badge says `off` on any page this refuses, because a page that silently
 * saves nothing is the one failure nobody notices.
 *
 * A host the browser gives as empty records in block mode and not in allow
 * mode. Both follow from the lists: nothing can block a host with no name,
 * and nothing can allow one either.
 */
export function hostRecords(host, settings) {
  if (settings.hostMode === 'allow') {
    return matchesHost(host, settings.allowedHosts);
  }
  return !matchesHost(host, settings.blockedHosts);
}

export function hostOfUrl(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}
