// Watches for text selections and sends them to the service worker.
// Runs in every frame of every page. What it saves depends on the site list.

const MIN_LENGTH = 2;
const MAX_LENGTH = 20000;
const DEBOUNCE_MS = 250;
// Same text selected again inside this window is ignored.
const REPEAT_WINDOW_MS = 4000;
const TOAST_MS = 1800;

let recording = true;
let sites = [];
// The entry for this frame's host, or null when the site is not listed.
let site = null;
let timer = null;
let last = { text: '', at: 0 };

// Same rule as siteFor() in lib/settings.js. Repeated here because a content
// script cannot import a module. background.js decides again with the real
// rule before anything is written. This copy only saves a message per
// selection on a site that does not save.
function siteHere() {
  const target = location.hostname.toLowerCase();
  if (!target) return null;
  let best = null;
  for (const entry of sites) {
    const one = String(entry?.host || '').toLowerCase();
    const hit = one && (target === one || target.endsWith(`.${one}`));
    if (hit && (!best || one.length > best.host.length)) best = entry;
  }
  return best;
}

/**
 * Re-decide this frame's site, then tell the worker which host it is on.
 *
 * The report is what paints this tab's badge. Only the top frame reports, or
 * one page with ten iframes would paint the badge ten times.
 */
function settle() {
  site = siteHere();
  if (window.top !== window) return;
  chrome.runtime
    .sendMessage({ type: 'selected:host', host: location.hostname })
    .catch(() => {});
}

chrome.storage.local.get({ recording: true, sites: [] }, (state) => {
  recording = state.recording !== false;
  sites = Array.isArray(state.sites) ? state.sites : [];
  settle();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.recording) recording = changes.recording.newValue !== false;
  if (changes.sites) {
    sites = Array.isArray(changes.sites.newValue) ? changes.sites.newValue : [];
  }
  if (changes.recording || changes.sites) settle();
});

// Text in a form field is never saved.
function inFormField() {
  const el = document.activeElement;
  if (!el) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
}

function currentSelection() {
  if (inFormField()) return '';
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return '';
  return sel.toString();
}

function capture() {
  if (!recording || !site?.select) return;
  const text = currentSelection().trim();
  if (text.length < MIN_LENGTH) return;
  if (text.length > MAX_LENGTH) return;

  const now = Date.now();
  if (text === last.text && now - last.at < REPEAT_WINDOW_MS) {
    last.at = now;
    return;
  }
  last = { text, at: now };

  chrome.runtime.sendMessage(
    {
      type: 'selected:save',
      text,
      url: location.href,
      title: document.title,
    },
    () => {
      // The service worker may be restarting. Ignore the error.
      void chrome.runtime.lastError;
    },
  );
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(capture, DEBOUNCE_MS);
}

document.addEventListener('mouseup', schedule, true);
document.addEventListener('dblclick', schedule, true);
document.addEventListener(
  'keyup',
  (event) => {
    if (event.shiftKey || event.key?.startsWith('Arrow')) schedule();
  },
  true,
);

/**
 * Whether this frame holds the focus itself.
 *
 * `hasFocus()` is also true when a child frame has the focus. A dictionary
 * popup drawn as a `chrome-extension://` iframe is such a child. When it has
 * the focus, the page's old selection must not answer for it. The shortcut
 * then reads the clipboard, which holds what was copied in the popup.
 */
function holdsFocus() {
  if (!document.hasFocus()) return false;
  const tag = document.activeElement?.tagName;
  return tag !== 'IFRAME' && tag !== 'FRAME';
}

let toastHost = null;
let toastBox = null;
let toastTimer = null;

/**
 * Show a short message in the corner of the page.
 *
 * The message sits in a closed shadow root. Page styles cannot reach it, and
 * page scripts cannot read it.
 */
function toast(message) {
  if (!toastHost) {
    toastHost = document.createElement('div');
    toastHost.style.cssText =
      'all: initial; position: fixed; right: 16px; bottom: 16px;' +
      ' z-index: 2147483647;';
    const root = toastHost.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent =
      'div { font: 13px/1.4 system-ui, sans-serif; color: #fff;' +
      ' background: #1f1f1f; padding: 8px 12px; border-radius: 6px;' +
      ' box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35); }';
    toastBox = document.createElement('div');
    root.append(style, toastBox);
  }
  toastBox.textContent = message;
  (document.body || document.documentElement).append(toastHost);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastHost.remove(), TOAST_MS);
}

// Chrome handles the shortcut key, so no key listener runs here. The worker
// asks every frame for its selection. Only the frame that holds the focus and
// a selection answers. The worker sends toasts to the top frame only.
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type === 'selected:selection') {
    if (!holdsFocus()) return false;
    const text = currentSelection().trim();
    if (!text) return false;
    respond({ text, url: location.href, title: document.title });
    return false;
  }
  if (message?.type === 'selected:toast') {
    toast(String(message.text || ''));
    respond({ ok: true });
    return false;
  }
  return false;
});
