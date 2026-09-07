// Manager page: browse, filter, copy, download and delete saved selections.

import {
  query,
  queryAll,
  getByIds,
  deleteIds,
  clearAll,
  countAll,
  listHosts,
} from '../lib/db.js';
import { FIELD_LABELS, FORMATS, formatTime, stamp } from '../lib/format.js';
import { getSettings, setSettings, parseHosts } from '../lib/settings.js';

const el = (id) => document.getElementById(id);
const ui = {
  count: el('count'),
  recording: el('recording'),
  q: el('q'),
  host: el('host'),
  from: el('from'),
  to: el('to'),
  order: el('order'),
  reset: el('reset'),
  selectPage: el('selectPage'),
  selectedCount: el('selectedCount'),
  copySel: el('copySel'),
  delSel: el('delSel'),
  clearAll: el('clearAll'),
  list: el('list'),
  empty: el('empty'),
  prev: el('prev'),
  next: el('next'),
  pageInfo: el('pageInfo'),
  pageSize: el('pageSize'),
  retention: el('retention'),
  retentionDays: el('retentionDays'),
  blocked: el('blocked'),
  hostMode: el('hostMode'),
  allowed: el('allowed'),
  captureSelection: el('captureSelection'),
  captureClipboard: el('captureClipboard'),
  fieldsSummary: el('fieldsSummary'),
  clipboardModifier: el('clipboardModifier'),
  saveSettings: el('saveSettings'),
  toast: el('toast'),
};

const state = {
  page: 0,
  pageSize: 50,
  total: 0,
  rows: [],
  picked: new Set(),
};

let toastTimer = null;

function toast(message) {
  ui.toast.textContent = message;
  ui.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    ui.toast.hidden = true;
  }, 1800);
}

function startOfDay(value) {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

function endOfDay(value) {
  const start = startOfDay(value);
  return start === null ? null : start + 24 * 60 * 60 * 1000 - 1;
}

function filters() {
  return {
    text: ui.q.value,
    host: ui.host.value,
    from: startOfDay(ui.from.value),
    to: endOfDay(ui.to.value),
    order: ui.order.value,
  };
}

/** Text with every match of the search term wrapped in <mark>. */
function highlighted(text, term) {
  const fragment = document.createDocumentFragment();
  const needle = term.trim().toLowerCase();
  if (!needle) {
    fragment.append(text);
    return fragment;
  }
  const haystack = text.toLowerCase();
  let at = 0;
  let found = haystack.indexOf(needle, at);
  while (found !== -1) {
    if (found > at) fragment.append(text.slice(at, found));
    const mark = document.createElement('mark');
    mark.textContent = text.slice(found, found + needle.length);
    fragment.append(mark);
    at = found + needle.length;
    found = haystack.indexOf(needle, at);
  }
  fragment.append(text.slice(at));
  return fragment;
}

/** A link to the page, or a label when the text came from the clipboard. */
function sourceTag(record) {
  if (record.source === 'clipboard') {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = 'Clipboard';
    chip.title = 'Read from the clipboard. There is no source page.';
    return chip;
  }
  const link = document.createElement('a');
  link.href = record.url;
  link.target = '_blank';
  link.rel = 'noreferrer';
  link.textContent = record.host || 'unknown';
  link.title = record.url;
  return link;
}

function buildRow(record) {
  const row = document.createElement('li');
  row.className = 'row';
  row.dataset.id = record.id;
  if (state.picked.has(record.id)) row.classList.add('picked');

  const check = document.createElement('input');
  check.type = 'checkbox';
  check.checked = state.picked.has(record.id);
  check.addEventListener('change', () => {
    if (check.checked) state.picked.add(record.id);
    else state.picked.delete(record.id);
    row.classList.toggle('picked', check.checked);
    paintSelection();
  });

  const body = document.createElement('div');
  body.className = 'body';

  const text = document.createElement('p');
  text.className = 'text';
  text.append(highlighted(record.text, ui.q.value));
  text.title = 'Click to expand';
  text.addEventListener('click', () => row.classList.toggle('open'));

  const meta = document.createElement('div');
  meta.className = 'meta';
  const when = document.createElement('span');
  when.textContent = formatTime(record.ts);
  const title = document.createElement('span');
  title.textContent = record.title || '';
  meta.append(sourceTag(record), when, title);

  body.append(text, meta);

  const actions = document.createElement('div');
  actions.className = 'actions';
  const copy = document.createElement('button');
  copy.textContent = 'Copy';
  copy.addEventListener('click', () => copyText(record.text, 'Copied'));
  const remove = document.createElement('button');
  remove.className = 'danger';
  remove.textContent = 'Delete';
  remove.addEventListener('click', async () => {
    await deleteIds([record.id]);
    state.picked.delete(record.id);
    toast('Deleted');
    await refresh();
  });
  actions.append(copy, remove);

  row.append(check, body, actions);
  return row;
}

function paintSelection() {
  const n = state.picked.size;
  ui.selectedCount.textContent = n ? `${n} selected` : 'Select page';
  ui.copySel.disabled = n === 0;
  ui.delSel.disabled = n === 0;
  const ids = state.rows.map((r) => r.id);
  ui.selectPage.checked =
    ids.length > 0 && ids.every((id) => state.picked.has(id));
}

function paintPager() {
  const pages = Math.max(1, Math.ceil(state.total / state.pageSize));
  ui.pageInfo.textContent = `Page ${state.page + 1} of ${pages} · ${
    state.total
  } match${state.total === 1 ? '' : 'es'}`;
  ui.prev.disabled = state.page === 0;
  ui.next.disabled = state.page >= pages - 1;
}

async function refresh() {
  const f = filters();
  const { rows, total } = await query({
    ...f,
    offset: state.page * state.pageSize,
    limit: state.pageSize,
  });

  // A delete can leave the current page past the end of the results.
  if (rows.length === 0 && state.page > 0 && total > 0) {
    state.page = Math.max(0, Math.ceil(total / state.pageSize) - 1);
    return refresh();
  }

  state.rows = rows;
  state.total = total;

  ui.list.replaceChildren(...rows.map(buildRow));
  ui.empty.hidden = rows.length > 0;
  ui.empty.textContent =
    total === 0 && (f.text || f.host || f.from || f.to)
      ? 'No selection matches these filters.'
      : 'Nothing saved yet. Select some text on any page.';

  const all = await countAll();
  ui.count.textContent = `${all} saved`;
  paintPager();
  paintSelection();
}

async function refreshHosts() {
  const current = ui.host.value;
  const hosts = await listHosts();
  const options = [new Option('All sites', '')];
  for (const host of hosts) options.push(new Option(host, host));
  ui.host.replaceChildren(...options);
  ui.host.value = hosts.includes(current) ? current : '';
}

async function copyText(text, message) {
  try {
    await navigator.clipboard.writeText(text);
    toast(message);
  } catch (error) {
    console.error('Selected: clipboard failed', error);
    toast('Could not copy');
  }
}

/**
 * The field boxes, in the markup order. A box carries the field it writes, the
 * same way a download button carries its format.
 */
const fieldBoxes = [...document.querySelectorAll('[data-field]')];

/** The fields ticked now. The builders put them back in FIELDS order. */
const pickedFields = () =>
  fieldBoxes.filter((box) => box.checked).map((box) => box.dataset.field);

/**
 * What the closed control says. The choice is only useful if it is readable
 * without opening anything, because it decides what a download button writes.
 *
 * Two names and a count, rather than all of them. Five names make the control
 * wider than the three buttons beside it.
 */
function tellFields() {
  const picked = pickedFields();
  if (picked.length === 0) return 'carrying nothing';
  if (picked.length === fieldBoxes.length) {
    return `carrying all ${fieldBoxes.length} fields`;
  }
  const names = picked.map((field) => FIELD_LABELS[field]);
  const rest = names.length - 2;
  return `carrying ${names.slice(0, 2).join(', ')}${rest > 0 ? ` +${rest}` : ''}`;
}

function download(rows, kind, fields) {
  const format = FORMATS[kind];
  const blob = new Blob([format.build(rows, fields)], {
    type: `${format.mime};charset=utf-8`,
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `selected-${stamp()}.${format.ext}`;
  link.click();
  URL.revokeObjectURL(url);
}

// Filters and paging
let searchTimer = null;
ui.q.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.page = 0;
    refresh();
  }, 200);
});

for (const control of [ui.host, ui.from, ui.to, ui.order]) {
  control.addEventListener('change', () => {
    state.page = 0;
    refresh();
  });
}

ui.reset.addEventListener('click', () => {
  ui.q.value = '';
  ui.host.value = '';
  ui.from.value = '';
  ui.to.value = '';
  ui.order.value = 'desc';
  state.page = 0;
  refresh();
});

ui.pageSize.addEventListener('change', () => {
  state.pageSize = Number(ui.pageSize.value);
  state.page = 0;
  refresh();
});

ui.prev.addEventListener('click', () => {
  state.page = Math.max(0, state.page - 1);
  refresh();
});

ui.next.addEventListener('click', () => {
  state.page += 1;
  refresh();
});

// Bulk actions
ui.selectPage.addEventListener('change', () => {
  for (const record of state.rows) {
    if (ui.selectPage.checked) state.picked.add(record.id);
    else state.picked.delete(record.id);
  }
  refresh();
});

ui.copySel.addEventListener('click', async () => {
  const rows = await getByIds([...state.picked]);
  rows.sort((a, b) => a.ts - b.ts);
  await copyText(
    rows.map((r) => r.text).join('\n\n'),
    `Copied ${rows.length} item${rows.length === 1 ? '' : 's'}`,
  );
});

ui.delSel.addEventListener('click', async () => {
  const ids = [...state.picked];
  if (!confirm(`Delete ${ids.length} saved selection(s)?`)) return;
  await deleteIds(ids);
  state.picked.clear();
  toast(`Deleted ${ids.length}`);
  await refreshHosts();
  await refresh();
});

ui.clearAll.addEventListener('click', async () => {
  if (!confirm('Delete every saved selection? This cannot be undone.')) return;
  await clearAll();
  state.picked.clear();
  state.page = 0;
  toast('All cleared');
  await refreshHosts();
  await refresh();
});

for (const button of document.querySelectorAll('[data-download]')) {
  button.addEventListener('click', async () => {
    // Every box unticked would write a file of empty records. Say so instead.
    const fields = pickedFields();
    if (fields.length === 0) return toast('Pick at least one field');
    const rows = await queryAll(filters());
    if (rows.length === 0) return toast('Nothing to download');
    download(rows, button.dataset.download, fields);
    toast(`Downloaded ${rows.length}`);
  });
}

// The choice is a setting, not a per-download question. It is written on each
// click so the next visit downloads what this one did.
for (const box of fieldBoxes) {
  box.addEventListener('change', () => {
    setSettings({ exportFields: pickedFields() });
    ui.fieldsSummary.textContent = tellFields();
  });
}

// Recording flag and settings
ui.recording.addEventListener('change', () => {
  setSettings({ recording: ui.recording.checked });
  toast(ui.recording.checked ? 'Recording' : 'Paused');
});

// A capture switch takes effect when it is clicked, not on Save.
ui.captureSelection.addEventListener('change', () => {
  setSettings({ captureSelection: ui.captureSelection.checked });
  toast(
    ui.captureSelection.checked
      ? 'Saving what you select'
      : 'Selection capture off',
  );
});

ui.captureClipboard.addEventListener('change', () => {
  setSettings({ captureClipboard: ui.captureClipboard.checked });
  toast(
    ui.captureClipboard.checked
      ? 'Saving what you copy'
      : 'Clipboard capture off',
  );
});

/**
 * Hide the word "days" while the box is empty.
 *
 * An empty box keeps everything, and the placeholder reads "forever". Leaving
 * "days" after it would make the line say "keep selections for forever days".
 * The stored value is still 0, which is what the service worker reads.
 */
function showRetention() {
  ui.retentionDays.hidden = ui.retention.value.trim() === '';
}

ui.retention.addEventListener('input', showRetention);

/** Show the list the mode uses. The other one keeps its text for a swap back. */
function showHostList() {
  const allow = ui.hostMode.value === 'allow';
  ui.blocked.hidden = allow;
  ui.allowed.hidden = !allow;
}

// The mode takes effect on Save, with the lists it decides between. A switch
// that took effect on click would apply a list nobody had reviewed.
ui.hostMode.addEventListener('change', showHostList);

ui.saveSettings.addEventListener('click', async () => {
  const days = Math.max(0, Math.min(3650, Number(ui.retention.value) || 0));
  const blockedHosts = parseHosts(ui.blocked.value);
  const allowedHosts = parseHosts(ui.allowed.value);
  const hostMode = ui.hostMode.value === 'allow' ? 'allow' : 'block';
  await setSettings({
    retentionDays: days,
    blockedHosts,
    allowedHosts,
    hostMode,
  });
  ui.retention.value = days ? String(days) : '';
  showRetention();
  ui.blocked.value = blockedHosts.join('\n');
  ui.allowed.value = allowedHosts.join('\n');
  // The service worker drops records that fall outside the new window.
  const result = await chrome.runtime.sendMessage({ type: 'selected:cleanup' });
  const dropped = result?.deleted || 0;
  // An allow-list with nothing on it records nothing anywhere. It is a valid
  // setting and a silent one, so saving it says so.
  const empty = hostMode === 'allow' && allowedHosts.length === 0;
  if (empty) toast('Saved. An empty allow-list records nothing.');
  else
    toast(
      dropped ? `Saved. Dropped ${dropped} old records.` : 'Settings saved',
    );
  await refreshHosts();
  await refresh();
});

document.addEventListener('keydown', (event) => {
  if (event.key === '/' && document.activeElement !== ui.q) {
    event.preventDefault();
    ui.q.focus();
  }
});

async function start() {
  const { os } = await chrome.runtime.getPlatformInfo();
  if (os === 'mac') ui.clipboardModifier.textContent = 'Command';

  const settings = await getSettings();
  ui.recording.checked = settings.recording;
  ui.retention.value = settings.retentionDays
    ? String(settings.retentionDays)
    : '';
  showRetention();
  ui.blocked.value = settings.blockedHosts.join('\n');
  ui.allowed.value = settings.allowedHosts.join('\n');
  ui.hostMode.value = settings.hostMode;
  showHostList();
  ui.captureSelection.checked = settings.captureSelection;
  ui.captureClipboard.checked = settings.captureClipboard;
  // null is the default: every field. A stored list ticks exactly what it holds.
  if (settings.exportFields) {
    const kept = new Set(settings.exportFields);
    for (const box of fieldBoxes) box.checked = kept.has(box.dataset.field);
  }
  ui.fieldsSummary.textContent = tellFields();
  state.pageSize = Number(ui.pageSize.value);
  await refreshHosts();
  await refresh();
}

start();
