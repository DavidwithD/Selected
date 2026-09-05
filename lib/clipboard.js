// Rules for the clipboard capture.
// Pure functions. The service worker applies them before it writes.

export const MIN_LENGTH = 2;
export const MAX_LENGTH = 20000;

/**
 * True when this clipboard text is worth saving.
 *
 * newestText is the text of the newest record. It catches a second press of the
 * shortcut on the same clipboard. Ctrl+C on a page also saves the text as a
 * selection. Without this check the same text lands twice.
 */
export function shouldSaveClipboard(text, { newestText = '' } = {}) {
  if (typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (trimmed.length < MIN_LENGTH) return false;
  if (trimmed.length > MAX_LENGTH) return false;
  if (trimmed === newestText) return false;
  return true;
}
