// The shortcut line shown by the popup and the manager page.
//
// Chrome owns the key. The user changes it on chrome://extensions/shortcuts.
// Chrome leaves the key empty when another extension already uses it.

const COMMAND = 'save';
const SHORTCUTS_URL = 'chrome://extensions/shortcuts';

/** The key as Chrome shows it, such as "⇧⌘S". Empty when no key is set. */
export async function shortcutKey() {
  const commands = await chrome.commands.getAll();
  return commands.find((command) => command.name === COMMAND)?.shortcut || '';
}

/**
 * Fill one element with the shortcut line and its link.
 *
 * A web page cannot link to chrome:// pages. An extension page can open one
 * with chrome.tabs.create, so the link runs that on click.
 */
export async function paintShortcut(element) {
  const key = await shortcutKey();
  const link = document.createElement('a');
  link.href = '#';
  link.textContent = key ? 'change' : 'set one';
  link.addEventListener('click', (event) => {
    event.preventDefault();
    chrome.tabs.create({ url: SHORTCUTS_URL });
  });
  const label = key ? 'Shortcut: ' : 'No shortcut set ';
  const keyBox = document.createElement('kbd');
  keyBox.textContent = key;
  element.replaceChildren(label, ...(key ? [keyBox, ' '] : []), '(', link, ')');
}
