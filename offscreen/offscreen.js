// Reads the clipboard for the service worker. The worker has no clipboard.
//
// The paste goes into a text box on this page. The page belongs to the
// extension, so no website sees the text. The `clipboardRead` permission lets
// the paste run without a key press here and without the focus.

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== 'selected:offscreen-read') return false;
  const box = document.getElementById('box');
  box.value = '';
  box.focus();
  const ok = document.execCommand('paste');
  respond({ ok, text: box.value });
  box.value = '';
  return false;
});
