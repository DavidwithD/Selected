// Service worker. Single writer to the database.
// Owns the shortcut, the badge, the site list writes and the retention cleanup.

import {
  addSelection,
  countAll,
  deleteOlderThan,
  newestText,
} from './lib/db.js';
import {
  DEFAULTS,
  OLD_KEYS,
  cleanSites,
  getSettings,
  hostOfUrl,
  migrateSites,
  siteFor,
} from './lib/settings.js';
import { MAX_LENGTH, shouldSaveOnShortcut } from './lib/clipboard.js';

const PAGE_URL = 'page/page.html';
const OFFSCREEN_URL = 'offscreen/offscreen.html';
const SHORTCUT = 'save';
const CLEANUP_ALARM = 'selected:cleanup';
const CLEANUP_EVERY_MINUTES = 6 * 60;
const DAY_MS = 24 * 60 * 60 * 1000;
const FLASH_MS = 2000;
const MARK_COLOR = '#2e9d5b';
const OFF_COLOR = '#8a8a8a';

// The badge reads 'off' everywhere while recording is paused. This is the
// default every tab starts from. A tab on a listed site paints over it in
// paintTab below.
async function paintBadge() {
  const { recording } = await getSettings();
  await chrome.action.setBadgeText({ text: recording ? '' : 'off' });
  await chrome.action.setBadgeBackgroundColor({ color: OFF_COLOR });
  await chrome.action.setTitle({
    title: recording ? 'Selected' : 'Selected: paused',
  });
}

/**
 * Paint one tab's badge from the host its content script reported.
 *
 * A listed site gets a mark. Any other site gets nothing, because most sites
 * are not listed and a mark on all of them would say nothing.
 */
async function paintTab(tabId, host) {
  const { recording, sites } = await getSettings();
  const site = siteFor(host, sites);
  let text = '';
  let title = `Selected: ${host || 'this page'} is not on your list`;
  if (!recording) {
    text = 'off';
    title = 'Selected: paused';
  } else if (site) {
    text = '•';
    title = `Selected: saving on ${site.host}`;
  }
  await chrome.action.setBadgeText({ tabId, text });
  await chrome.action.setBadgeBackgroundColor({
    tabId,
    color: text === 'off' ? OFF_COLOR : MARK_COLOR,
  });
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

/**
 * Write the site list once from the old settings, then drop the old keys.
 *
 * getSettings reads the old keys too. This step means the content script,
 * which reads `sites` alone, sees the same list.
 */
async function migrate() {
  const stored = await chrome.storage.local.get(null);
  if (!Array.isArray(stored.sites)) {
    await chrome.storage.local.set({ sites: migrateSites(stored) });
  }
  await chrome.storage.local.remove(OLD_KEYS);
}

chrome.runtime.onInstalled.addListener(async () => {
  await migrate();
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
async function openPage() {
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
}

/**
 * Add, change or remove one site. This is the only code that writes `sites`.
 *
 * A host typed as a URL is reduced to its host first. Adding a host that is
 * already listed changes its boxes.
 */
async function updateSite({ host, select, shortcut, remove }) {
  const [entry] = cleanSites([{ host }]);
  if (!entry) return { ok: false, reason: 'no host' };
  const { sites } = await getSettings();
  const others = sites.filter((site) => site.host !== entry.host);
  const old = sites.find((site) => site.host === entry.host);
  const next = remove
    ? others
    : cleanSites([
        ...others,
        {
          host: entry.host,
          select: select ?? old?.select ?? true,
          shortcut: shortcut ?? old?.shortcut ?? true,
        },
      ]);
  await chrome.storage.local.set({ sites: next });
  return { ok: true, host: entry.host, sites: next };
}

async function handleSave(message, sender) {
  // The extension is not enabled in incognito, but check anyway.
  if (sender.tab?.incognito) return { saved: false, reason: 'incognito' };

  const settings = await getSettings();
  if (!settings.recording) return { saved: false, reason: 'paused' };

  const url = message.url || sender.tab?.url || '';
  if (!siteFor(hostOfUrl(url), settings.sites)?.select) {
    return { saved: false, reason: 'not listed' };
  }

  const result = await addSelection({
    text: message.text,
    url,
    title: message.title || sender.tab?.title || '',
  });
  return { saved: true, ...result };
}

let offscreenReady = null;

/**
 * Read the clipboard in the offscreen document.
 *
 * The worker has no clipboard of its own. The offscreen document is a hidden
 * page of this extension, so no website sees the text. Chrome allows one
 * offscreen document, so the promise stops two presses from creating two.
 */
async function readClipboard() {
  offscreenReady ??= (async () => {
    if (await chrome.offscreen.hasDocument()) return;
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: ['CLIPBOARD'],
      justification: 'Read the clipboard when the user presses the shortcut.',
    });
  })().catch((error) => {
    offscreenReady = null;
    throw error;
  });
  await offscreenReady;
  const reply = await chrome.runtime.sendMessage({
    type: 'selected:offscreen-read',
  });
  return String(reply?.text || '');
}

/** Ask the tab's frames for a selection. Only a focused frame answers. */
async function selectionIn(tabId) {
  try {
    const reply = await chrome.tabs.sendMessage(tabId, {
      type: 'selected:selection',
    });
    return reply?.text ? reply : null;
  } catch {
    // No frame answered, or the page has no content script.
    return null;
  }
}

/**
 * Tell the user what a press did.
 *
 * The toast needs the content script. A page without one (`chrome://`, the
 * PDF viewer) gets a mark on the badge for two seconds instead.
 */
async function tell(tabId, text, ok) {
  try {
    await chrome.tabs.sendMessage(
      tabId,
      { type: 'selected:toast', text },
      { frameId: 0 },
    );
  } catch {
    const before = await chrome.action.getBadgeText({ tabId });
    await chrome.action.setBadgeText({ tabId, text: ok ? '✓' : '×' });
    setTimeout(() => {
      chrome.action.setBadgeText({ tabId, text: before }).catch(() => {});
    }, FLASH_MS);
  }
}

/**
 * The shortcut. Chrome catches the key and passes the tab.
 *
 * Pressing the key grants `activeTab`, so `tab.url` is readable here. The
 * press saves the focused frame's selection. With no selection it saves the
 * clipboard. Both need the site to be listed with its Shortcut box ticked.
 */
async function onShortcut(tab) {
  if (!tab?.id || tab.incognito) return;
  const settings = await getSettings();
  if (!settings.recording) return tell(tab.id, 'Selected: paused', false);

  const host = hostOfUrl(tab.url || '');
  const site = siteFor(host, settings.sites);
  if (!site) {
    return tell(
      tab.id,
      `Selected: ${host || 'this page'} is not on your list`,
      false,
    );
  }
  if (!site.shortcut) {
    return tell(tab.id, `Selected: the shortcut is off on ${site.host}`, false);
  }

  const selection = await selectionIn(tab.id);
  let record;
  if (selection) {
    record = {
      text: selection.text,
      url: selection.url,
      title: selection.title,
    };
  } else {
    let text = '';
    try {
      text = (await readClipboard()).trim();
    } catch (error) {
      console.error('Selected: could not read the clipboard', error);
      return tell(tab.id, 'Selected: could not read the clipboard', false);
    }
    if (!text) return tell(tab.id, 'Selected: nothing to save', false);
    record = { text, url: '', title: '', source: 'clipboard' };
  }

  if (record.text.length > MAX_LENGTH) {
    return tell(tab.id, 'Selected: that text is too long', false);
  }
  if (!shouldSaveOnShortcut(record.text, { newestText: await newestText() })) {
    return tell(tab.id, 'Selected: already saved', true);
  }
  await addSelection(record);
  return tell(tab.id, 'Selected: saved', true);
}

chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== SHORTCUT) return;
  onShortcut(tab).catch((error) => {
    console.error('Selected: the shortcut failed', error);
  });
});

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

  // Sent by every content script on load, and again whenever the site list or
  // the recording flag changes. It is how the worker learns a tab's host
  // without the `tabs` permission.
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

  // From the popup and the manager page.
  if (message?.type === 'selected:site') {
    updateSite(message)
      .then(respond)
      .catch((error) => respond({ ok: false, error: String(error) }));
    return true;
  }

  if (message?.type === 'selected:open') {
    openPage().then(() => respond({ ok: true }));
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
