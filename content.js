// Watches for text selections and sends them to the service worker.
// Runs in every frame of every page, except blocked hosts.

const MIN_LENGTH = 2;
const MAX_LENGTH = 20000;
const DEBOUNCE_MS = 250;
// Same text selected again inside this window is ignored.
const REPEAT_WINDOW_MS = 4000;

let recording = true;
let blocked = false;
let timer = null;
let last = { text: '', at: 0 };

// Same rule as isBlocked() in lib/settings.js. Repeated here because a content
// script cannot import a module.
function hostIsBlocked(hosts) {
  const target = location.hostname.toLowerCase();
  return (hosts || []).some((blockedHost) => {
    const b = String(blockedHost).toLowerCase();
    return b && (target === b || target.endsWith(`.${b}`));
  });
}

chrome.storage.local.get({ recording: true, blockedHosts: [] }, (state) => {
  recording = state.recording !== false;
  blocked = hostIsBlocked(state.blockedHosts);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.recording) recording = changes.recording.newValue !== false;
  if (changes.blockedHosts) {
    blocked = hostIsBlocked(changes.blockedHosts.newValue);
  }
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
  if (!recording || blocked) return;
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
