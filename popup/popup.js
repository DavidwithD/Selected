// The toolbar popup: the current site's boxes, and a way to the saved text.
//
// Clicking the toolbar icon grants `activeTab`, so the popup can read the
// address of the tab it was opened on.

import { cleanSites, getSettings, siteFor } from '../lib/settings.js';
import { paintShortcut } from '../lib/shortcut.js';

const el = (id) => document.getElementById(id);

// The host as the list would store it, or '' for pages with no web host.
function hostOfTab(tab) {
  try {
    const url = new URL(tab?.url || '');
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return cleanSites([{ host: url.hostname }])[0]?.host || '';
  } catch {
    return '';
  }
}

async function send(message) {
  return chrome.runtime.sendMessage(message);
}

/**
 * Show the entry that decides for this page.
 *
 * On dict.naver.com with only naver.com listed, that is the naver.com entry.
 * Its boxes and its Remove act on naver.com.
 */
async function paint(host) {
  const { recording, sites } = await getSettings();
  const site = siteFor(host, sites);
  el('site').hidden = false;
  el('paused').hidden = recording;
  el('host').textContent = site?.host || host;
  el('listed').hidden = !site;
  el('unlisted').hidden = Boolean(site);
  if (site) {
    el('select').checked = site.select;
    el('shortcut').checked = site.shortcut;
  }
  return site;
}

async function start() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const host = hostOfTab(tab);
  paintShortcut(el('shortcutLine'));
  el('open').addEventListener('click', async () => {
    await send({ type: 'selected:open' });
    window.close();
  });
  if (!host) return;

  let site = await paint(host);
  // Repaint on every change to the list or the flag. The change can come from
  // this popup or from the manager page.
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== 'local' || !(changes.sites || changes.recording)) return;
    site = await paint(host);
  });
  el('add').addEventListener('click', async () => {
    await send({ type: 'selected:site', host });
  });
  el('remove').addEventListener('click', async () => {
    await send({ type: 'selected:site', host: site.host, remove: true });
  });
  for (const box of ['select', 'shortcut']) {
    el(box).addEventListener('change', async () => {
      await send({
        type: 'selected:site',
        host: site.host,
        [box]: el(box).checked,
      });
    });
  }
}

start();
