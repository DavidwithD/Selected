// Service worker. Single writer to the database.
// Owns the toolbar icon, the badge and the retention cleanup.

import {
  addSelection,
  countAll,
  deleteOlderThan,
  newestText,
} from './lib/db.js';
import {
  DEFAULTS,
  getSettings,
  hostOfUrl,
  hostRecords,
  isBlocked,
} from './lib/settings.js';
import { shouldSaveClipboard } from './lib/clipboard.js';

const PAGE_URL = 'page/page.html';
const CLEANUP_ALARM = 'selected:cleanup';
const CLEANUP_EVERY_MINUTES = 6 * 60;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Both sources off, or recording paused. Nothing records anywhere. */
const isLive = (settings) =>
  settings.recording &&
  (settings.captureSelection || settings.captureClipboard);

// The badge reads 'off' when nothing can be saved: paused, or both sources off.
// This is the default every tab starts from. A tab whose host is refused paints
// over it in paintTab below.
async function paintBadge() {
  const live = isLive(await getSettings());
  await chrome.action.setBadgeText({ text: live ? '' : 'off' });
  await chrome.action.setBadgeBackgroundColor({ color: '#8a8a8a' });
  await chrome.action.setTitle({
    title: live ? 'Selected: open saved text' : 'Selected: paused',
  });
}

/**
 * Paint one tab's badge from the host its content script reported.
 *
 * An allow-list saves nothing on most pages, and a page that saves nothing
 * looks exactly like a page with nothing worth saving. The badge is what makes
 * the two different, so it is part of the allow-list rather than a nicety.
 *
 * The host comes from the content script because the extension has no `tabs`
 * permission and cannot read a tab's URL. Asking for one would widen the
 * install prompt for a badge.
 */
async function paintTab(tabId, host) {
  const settings = await getSettings();
  const records = isLive(settings) && hostRecords(host, settings);
  await chrome.action.setBadgeText({ tabId, text: records ? '' : 'off' });
  let title = 'Selected: open saved text';
  if (!isLive(settings)) title = 'Selected: paused';
  else if (!records) title = `Selected: not recording on ${host}`;
  await chrome.action.setTitle({ tabId, title });
}

/** Drop records older than the retention window. 0 days keeps everything. */
async function runCleanup() {
  const { retentionDays } = await getSettings();
  if (!retentionDays) return 0;
  const deleted = await deleteOlderThan(Date.now() - retentionDays * DAY_MS);
  if (deleted) console.log(`Selected: dropped ${deleted} old records`);
  return deleted;
}

function scheduleCleanup() {
  chrome.alarms.create(CLEANUP_ALARM, {
    periodInMinutes: CLEANUP_EVERY_MINUTES,
    delayInMinutes: 1,
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULTS));
  const missing = {};
  for (const [key, value] of Object.entries(DEFAULTS)) {
    if (stored[key] === undefined) missing[key] = value;
  }
  if (Object.keys(missing).length) await chrome.storage.local.set(missing);
  scheduleCleanup();
  await paintBadge();
  await runCleanup();
});

chrome.runtime.onStartup.addListener(async () => {
  scheduleCleanup();
  await paintBadge();
  await runCleanup();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === CLEANUP_ALARM) runCleanup();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (
    changes.recording ||
    changes.captureSelection ||
    changes.captureClipboard
  ) {
    paintBadge();
  }
  if (changes.retentionDays) runCleanup();
});

// Open the manager page, or focus it if it is already open.
// getContexts finds our own tab without the broad "tabs" permission.
chrome.action.onClicked.addListener(async () => {
  const url = chrome.runtime.getURL(PAGE_URL);
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['TAB'],
    documentUrls: [url],
  });
  const open = contexts.find((context) => context.tabId >= 0);
  if (open) {
    await chrome.tabs.update(open.tabId, { active: true });
    await chrome.windows.update(open.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url });
  }
});

async function handleSave(message, sender) {
  // The extension is not enabled in incognito, but check anyway.
  if (sender.tab?.incognito) return { saved: false, reason: 'incognito' };

  const settings = await getSettings();
  if (!settings.recording) return { saved: false, reason: 'paused' };
  if (!settings.captureSelection) return { saved: false, reason: 'off' };

  const url = message.url || sender.tab?.url || '';
  if (!hostRecords(hostOfUrl(url), settings)) {
    return { saved: false, reason: 'blocked' };
  }

  const result = await addSelection({
    text: message.text,
    url,
    title: message.title || sender.tab?.title || '',
  });
  return { saved: true, ...result };
}

/**
 * Save the clipboard text after the user presses the shortcut.
 * The record has no source page, so it carries no url and no title.
 */
async function handleClipboard(message) {
  const settings = await getSettings();
  if (!settings.recording) return { saved: false, reason: 'paused' };
  if (!settings.captureClipboard) return { saved: false, reason: 'off' };
  // The allow-list does not apply here. Selection capture is ambient and the
  // list narrows it. A shortcut is a request for this text on this page.
  // The blocklist still applies in block mode: a host named there is one no
  // text should come from, however it is asked for.
  if (
    settings.hostMode === 'block' &&
    isBlocked(hostOfUrl(message.pageUrl), settings.blockedHosts)
  ) {
    return { saved: false, reason: 'blocked' };
  }

  const text = String(message.text || '').trim();
  const keep = shouldSaveClipboard(text, { newestText: await newestText() });
  if (!keep) return { saved: false, reason: 'duplicate' };

  const result = await addSelection({
    text,
    url: '',
    title: '',
    source: 'clipboard',
  });
  return { saved: true, ...result };
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type === 'selected:save') {
    handleSave(message, sender)
      .then(respond)
      .catch((error) => {
        console.error('Selected: could not save', error);
        respond({ saved: false, error: String(error) });
      });
    return true; // respond() is called later
  }

  if (message?.type === 'selected:clipboard') {
    handleClipboard(message)
      .then(respond)
      .catch((error) => {
        console.error('Selected: could not save the clipboard', error);
        respond({ saved: false, error: String(error) });
      });
    return true;
  }

  // Sent by every content script on load, and again whenever a setting that
  // decides recording changes. It is the only way the worker learns a tab's
  // host without the `tabs` permission.
  if (message?.type === 'selected:host') {
    const tabId = sender.tab?.id;
    if (tabId !== undefined) {
      paintTab(tabId, String(message.host || '')).catch((error) => {
        console.error('Selected: could not paint the badge', error);
      });
    }
    respond({ ok: true });
    return false;
  }

  if (message?.type === 'selected:count') {
    countAll().then((count) => respond({ count }));
    return true;
  }

  // The page asks for a cleanup after the retention setting changes.
  if (message?.type === 'selected:cleanup') {
    runCleanup().then((deleted) => respond({ deleted }));
    return true;
  }

  return false;
});
