// Watches for text selections and sends them to the service worker.
// Runs in every frame of every page. What it records depends on the host.

const MIN_LENGTH = 2;
const MAX_LENGTH = 20000;
const DEBOUNCE_MS = 250;
// Same text selected again inside this window is ignored.
const REPEAT_WINDOW_MS = 4000;

let recording = true;
let blocked = false;
let captureSelection = true;
let captureClipboard = false;
let timer = null;
let last = { text: '', at: 0 };

// The lists, as this frame last read them. Kept whole rather than reduced to a
// boolean, because a change to either one has to be re-decided against the
// mode, and a change to the mode against both lists.
let hostMode = 'block';
let blockedHosts = [];
let allowedHosts = [];

// Same rule as matchesHost() in lib/settings.js. Repeated here because a
// content script cannot import a module. background.js decides again with the
// real rule before anything is written; this copy only saves a message per
// selection on a page that will not record.
function hostMatches(hosts) {
  const target = location.hostname.toLowerCase();
  return (hosts || []).some((listed) => {
    const one = String(listed).toLowerCase();
    return one && (target === one || target.endsWith(`.${one}`));
  });
}

/**
 * Re-decide this frame's gate, then tell the worker which host it is on.
 *
 * The report is what paints this tab's badge. The worker has no `tabs`
 * permission and cannot read the URL itself. Only the top frame reports, or
 * one page with ten iframes would paint the badge ten times.
 */
function settle() {
  blocked =
    hostMode === 'allow'
      ? !hostMatches(allowedHosts)
      : hostMatches(blockedHosts);
  if (window.top !== window) return;
  chrome.runtime
    .sendMessage({ type: 'selected:host', host: location.hostname })
    .catch(() => {});
}

chrome.storage.local.get(
  {
    recording: true,
    hostMode: 'block',
    blockedHosts: [],
    allowedHosts: [],
    captureSelection: true,
    captureClipboard: false,
  },
  (state) => {
    recording = state.recording !== false;
    hostMode = state.hostMode === 'allow' ? 'allow' : 'block';
    blockedHosts = state.blockedHosts || [];
    allowedHosts = state.allowedHosts || [];
    captureSelection = state.captureSelection !== false;
    captureClipboard = state.captureClipboard === true;
    settle();
  },
);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.recording) recording = changes.recording.newValue !== false;
  if (changes.hostMode) {
    hostMode = changes.hostMode.newValue === 'allow' ? 'allow' : 'block';
  }
  if (changes.blockedHosts) blockedHosts = changes.blockedHosts.newValue || [];
  if (changes.allowedHosts) allowedHosts = changes.allowedHosts.newValue || [];
  if (changes.captureSelection) {
    captureSelection = changes.captureSelection.newValue !== false;
  }
  if (changes.captureClipboard) {
    captureClipboard = changes.captureClipboard.newValue === true;
  }
  settle();
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
  if (!recording || blocked || !captureSelection) return;
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

// Clipboard capture, off by default.
//
// A content script cannot run inside an extension popup. Chrome forbids one
// extension from injecting into another extension's pages. A dictionary that
// draws its popup as a chrome-extension:// iframe inside the page is closed the
// same way. The clipboard is the only channel to text selected there.
//
// The read runs on a keypress. Copy in the popup, click back on the page, then
// press the shortcut. Nothing is read until you ask for it.
//
// A blur/focus heuristic came first and failed. docs/decisions/0002 holds why.

// Ctrl+Shift+S, or Command+Shift+S on macOS. The key is fixed.
const SHORTCUT_KEY = 's';
const TOAST_MS = 1800;

let toastHost = null;
let toastBox = null;
let toastTimer = null;

function isShortcut(event) {
  if (event.key?.toLowerCase() !== SHORTCUT_KEY) return false;
  if (!event.shiftKey || event.altKey) return false;
  return event.ctrlKey || event.metaKey;
}

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

async function readClipboard() {
  if (!captureClipboard) return toast('Selected: turn on "Save what I copy"');
  if (!recording) return toast('Selected: paused');
  // Only the blocklist stops a shortcut, and only in block mode. The allow-list
  // narrows ambient capture. This press is a request for this text.
  // background.js applies the same rule before it writes.
  if (hostMode === 'block' && hostMatches(blockedHosts)) {
    return toast('Selected: this site is blocked');
  }

  let text = '';
  try {
    text = await navigator.clipboard.readText();
  } catch {
    // The frame lost focus, or the page forbids the read.
    return toast('Selected: could not read the clipboard');
  }

  text = text.trim();
  if (text.length < MIN_LENGTH)
    return toast('Selected: the clipboard is empty');
  if (text.length > MAX_LENGTH) return toast('Selected: that text is too long');

  chrome.runtime.sendMessage(
    {
      type: 'selected:clipboard',
      text,
      // For the blocklist check. It is not stored on the record.
      pageUrl: location.href,
    },
    (response) => {
      // The service worker may be restarting. Ignore the error.
      void chrome.runtime.lastError;
      if (response?.saved) toast('Selected: saved');
      else if (response?.reason === 'duplicate')
        toast('Selected: already saved');
      else toast('Selected: not saved');
    },
  );
}

// The listener runs in every frame. A key event reaches only the frame that has
// focus, so one press sends one message.
document.addEventListener(
  'keydown',
  (event) => {
    if (!isShortcut(event)) return;
    event.preventDefault();
    readClipboard();
  },
  true,
);
