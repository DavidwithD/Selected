// Rules for text saved by the shortcut.
// Pure functions. The service worker applies them before it writes.

export const MIN_LENGTH = 2;
export const MAX_LENGTH = 20000;

/**
 * True when this shortcut text is worth saving.
 *
 * newestText is the text of the newest record. It catches a second press on
 * the same text. It also catches a press on a selection that the Select box
 * already saved. Without this check the same text lands twice.
 */
export function shouldSaveOnShortcut(text, { newestText = '' } = {}) {
  if (typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (trimmed.length < MIN_LENGTH) return false;
  if (trimmed.length > MAX_LENGTH) return false;
  if (trimmed === newestText) return false;
  return true;
}
