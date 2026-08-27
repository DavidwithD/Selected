// Service worker. Single writer to the database.
// Owns the toolbar icon, the badge and the retention cleanup.

import {
  addSelection,
  countAll,
  deleteOlderThan,
  newestText,
} from './lib/db.js';
import { DEFAULTS, getSettings, isBlocked, hostOfUrl } from './lib/settings.js';
import { shouldSaveClipboard } from './lib/clipboard.js';

const PAGE_URL = 'page/page.html';
// The last clipboard text, in session storage. That storage is memory only and
// is cleared when the browser closes.
const LAST_CLIPBOARD = 'lastClipboard';
const CLEANUP_ALARM = 'selected:cleanup';
const CLEANUP_EVERY_MINUTES = 6 * 60;
const DAY_MS = 24 * 60 * 60 * 1000;

async function paintBadge() {
  const { recording } = await getSettings();
  await chrome.action.setBadgeText({ text: recording ? '' : 'off' });
  await chrome.action.setBadgeBackgroundColor({ color: '#8a8a8a' });
  await chrome.action.setTitle({
    title: recording ? 'Selected: open saved text' : 'Selected: paused',
  });
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
  if (changes.recording) paintBadge();
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

  const { recording, blockedHosts } = await getSettings();
  if (!recording) return { saved: false, reason: 'paused' };

  const url = message.url || sender.tab?.url || '';
  if (isBlocked(hostOfUrl(url), blockedHosts)) {
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
 * Save text the user copied while a popup was open.
 * The record has no source page, so it carries no url and no title.
 */
async function handleClipboard(message) {
  const { recording, blockedHosts, captureClipboard } = await getSettings();
  if (!recording) return { saved: false, reason: 'paused' };
  if (!captureClipboard) return { saved: false, reason: 'off' };
  if (isBlocked(hostOfUrl(message.pageUrl), blockedHosts)) {
    return { saved: false, reason: 'blocked' };
  }

  const text = String(message.text || '').trim();
  const stored = await chrome.storage.session.get({ [LAST_CLIPBOARD]: '' });
  const keep = shouldSaveClipboard(text, {
    lastClipboard: stored[LAST_CLIPBOARD],
    newestText: await newestText(),
  });

  // Remember the text either way. A text skipped here must not come back on the
  // next focus.
  await chrome.storage.session.set({ [LAST_CLIPBOARD]: text });
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
