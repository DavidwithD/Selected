// Rules for the clipboard capture.
// Pure functions. The service worker applies them before it writes.

export const MIN_LENGTH = 2;
export const MAX_LENGTH = 20000;

/**
 * True when this clipboard text is worth saving.
 *
 * lastClipboard is the text of the previous read. The clipboard keeps its
 * content until something replaces it, so every focus would otherwise save the
 * same text again.
 *
 * newestText is the text of the newest record. Ctrl+C on a page already saves
 * the text as a selection. Without this check the same text lands twice.
 */
export function shouldSaveClipboard(
  text,
  { lastClipboard = '', newestText = '' } = {},
) {
  if (typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (trimmed.length < MIN_LENGTH) return false;
  if (trimmed.length > MAX_LENGTH) return false;
  if (trimmed === lastClipboard) return false;
  if (trimmed === newestText) return false;
  return true;
}
