// Settings live in chrome.storage.local. The page writes them.
// The service worker and the content script read them.

export const DEFAULTS = {
  recording: true,
  // 0 means keep everything.
  retentionDays: 90,
  blockedHosts: [],
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

/** A blocked host also blocks its subdomains. */
export function isBlocked(host, blockedHosts) {
  if (!host) return false;
  const target = host.toLowerCase();
  return blockedHosts.some((blocked) => {
    const b = String(blocked).toLowerCase();
    return b && (target === b || target.endsWith(`.${b}`));
  });
}

export function hostOfUrl(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}
