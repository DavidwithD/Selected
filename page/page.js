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
import { FORMATS, formatTime, stamp } from '../lib/format.js';
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
  blocked: el('blocked'),
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
  const link = document.createElement('a');
  link.href = record.url;
  link.target = '_blank';
  link.rel = 'noreferrer';
  link.textContent = record.host || 'unknown';
  link.title = record.url;
  const when = document.createElement('span');
  when.textContent = formatTime(record.ts);
  const title = document.createElement('span');
  title.textContent = record.title || '';
  meta.append(link, when, title);

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

function download(rows, kind) {
  const format = FORMATS[kind];
  const blob = new Blob([format.build(rows)], {
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
    const rows = await queryAll(filters());
    if (rows.length === 0) return toast('Nothing to download');
    download(rows, button.dataset.download);
    toast(`Downloaded ${rows.length}`);
  });
}

// Recording flag and settings
ui.recording.addEventListener('change', () => {
  setSettings({ recording: ui.recording.checked });
  toast(ui.recording.checked ? 'Recording' : 'Paused');
});

ui.saveSettings.addEventListener('click', async () => {
  const days = Math.max(0, Math.min(3650, Number(ui.retention.value) || 0));
  const blockedHosts = parseHosts(ui.blocked.value);
  await setSettings({ retentionDays: days, blockedHosts });
  ui.retention.value = String(days);
  ui.blocked.value = blockedHosts.join('\n');

  // The service worker drops records that fall outside the new window.
  const result = await chrome.runtime.sendMessage({ type: 'selected:cleanup' });
  const dropped = result?.deleted || 0;
  toast(dropped ? `Saved. Dropped ${dropped} old records.` : 'Settings saved');
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
  const settings = await getSettings();
  ui.recording.checked = settings.recording;
  ui.retention.value = String(settings.retentionDays);
  ui.blocked.value = settings.blockedHosts.join('\n');
  state.pageSize = Number(ui.pageSize.value);
  await refreshHosts();
  await refresh();
}

start();
