import { isWhitelisted } from '../../core/rules';
import { getSettings } from '../../core/settings';
import { addSuspended, estimateMb, getStats } from '../../core/stats';
import { findDuplicateIds } from '../../core/duplicates';
import { groupWindow, ungroupWindow } from '../../core/grouping-apply';
import { createIndex, search, type SearchDoc } from '../../core/search';
import { deleteSession, listSessions, restoreSession, saveCurrentWindow } from '../../core/sessions';
import {
  createWorkspace, deleteWorkspace, getActiveWorkspaceId, listWorkspaces, switchWorkspace, updateWorkspaceFromWindow,
} from '../../core/workspaces';

type View = 'tabs' | 'workspaces' | 'sessions';
type Filter = 'all' | 'suspended' | 'playing' | 'pinned' | 'duplicates';
const VIEWS: View[] = ['tabs', 'workspaces', 'sessions'];
const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' }, { id: 'suspended', label: 'Suspended' }, { id: 'playing', label: 'Playing' },
  { id: 'pinned', label: 'Pinned' }, { id: 'duplicates', label: 'Duplicates' },
];

let view: View = 'tabs';
let filter: Filter = 'all';
let selected = 0;
// Draft text survives re-renders (tab events rebuild the DOM; users must never lose what they are typing).
let workspaceDraft = '';
let actions: Array<() => void | Promise<void>> = [];

const q = document.getElementById('q') as HTMLInputElement;
const main = document.getElementById('main') as HTMLElement;
const statsEl = document.getElementById('stats') as HTMLElement;
const nav = document.getElementById('nav') as HTMLElement;
const toast = document.getElementById('toast') as HTMLElement;

let toastTimer: ReturnType<typeof setTimeout> | undefined;
function flash(msg: string): void {
  toast.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.textContent = ''), 4000);
}

// Chrome's tab group colors, darkened so white chip text stays readable.
const GROUP_HEX: Record<string, string> = {
  grey: '#5f6368', blue: '#1a73e8', red: '#d93025', yellow: '#b06000', green: '#188038',
  pink: '#c2185b', purple: '#8430ce', cyan: '#007b83', orange: '#c26401',
};

// ---------- icons: static, hard-coded SVG markup only (never built from page data) ----------
const ICONS = {
  logo: '<path d="M4 7.5 12 4l8 3.5v9L12 20l-8-3.5z"/><path d="M12 11v9M4 7.5l8 3.5 8-3.5"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  group: '<rect x="3" y="4" width="7" height="7" rx="1.5"/><rect x="14" y="4" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="6" rx="1.5"/><rect x="14" y="14" width="7" height="6" rx="1.5"/>',
  ungroup: '<rect x="3" y="4" width="7" height="7" rx="1.5"/><rect x="14" y="13" width="7" height="7" rx="1.5"/><path d="M14 7h7M3 17h7"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
  pin: '<path d="M12 17v5M8 3h8l-1.5 7 3 3H6.5l3-3z"/>',
  mute: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="m16 9 5 6M21 9l-5 6"/>',
  sound: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.9-3M4 5v4h4M4 13a8 8 0 0 0 14.9 3M20 19v-4h-4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  empty: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
} as const;
type IconName = keyof typeof ICONS;

function icon(name: IconName): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = ICONS[name]; // static constants above; nothing user-controlled reaches here
  return svg;
}

// ---------- tiny DOM helpers (textContent only: page titles/URLs are untrusted) ----------
function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...kids);
  return node;
}

function button(label: string, onClick: () => void | Promise<void>, opts: { title?: string; cls?: string; icon?: IconName } = {}): HTMLButtonElement {
  const b = el('button', { title: opts.title ?? label, className: opts.cls ?? '' });
  if (opts.icon) b.append(icon(opts.icon));
  b.append(label);
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    void onClick();
  });
  return b;
}

function iconButton(name: IconName, label: string, onClick: () => void | Promise<void>, opts: { cls?: string; pressed?: boolean } = {}): HTMLButtonElement {
  const b = el('button', { title: label, className: opts.cls ?? '', ariaLabel: label });
  if (opts.pressed !== undefined) b.setAttribute('aria-pressed', String(opts.pressed));
  b.append(icon(name));
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    void onClick();
  });
  return b;
}

interface Pill { text: string; kind?: 'accent' | 'ok' | 'warn' }

function item(opts: {
  title: string; sub: string; icon?: string; cls?: string; pills?: Pill[]; chip?: { text: string; color: string };
  onClick: () => void | Promise<void>; buttons?: HTMLElement[];
}): HTMLLIElement {
  const li = el('li', { className: opts.cls ?? '', role: 'option' });
  const fav = el('span', { className: 'fav' });
  if (opts.icon && /^https?:/.test(opts.icon)) {
    const img = el('img', { src: opts.icon, alt: '', loading: 'lazy' });
    img.addEventListener('error', () => img.replaceWith(icon('globe')));
    fav.append(img);
  } else {
    fav.append(icon('globe'));
  }
  li.append(fav, el('div', { className: 't' }, el('b', { textContent: opts.title }), el('small', { textContent: opts.sub })));
  const meta = el('span', { className: 'meta' });
  if (opts.chip) {
    meta.append(el('span', { className: 'chip', textContent: opts.chip.text, title: `Tab group: ${opts.chip.text}`, style: `background:${GROUP_HEX[opts.chip.color] ?? GROUP_HEX.grey}` }));
  }
  for (const p of opts.pills ?? []) meta.append(el('span', { className: `pill ${p.kind ?? ''}`.trim(), textContent: p.text }));
  if (meta.childElementCount) li.append(meta);
  if (opts.buttons?.length) li.append(el('span', { className: 'actions' }, ...opts.buttons));
  li.addEventListener('click', () => void opts.onClick());
  actions.push(opts.onClick);
  return li;
}

const section = (label: string) => el('h2', { textContent: label });
const empty = (msg: string) => el('p', { className: 'empty' }, icon('empty'), msg);
const list = (...items: HTMLLIElement[]) => el('ul', { role: 'listbox' }, ...items);

function highlight(): void {
  const items = main.querySelectorAll<HTMLLIElement>('li[role=option]');
  items.forEach((li, i) => li.setAttribute('aria-selected', String(i === selected)));
  items[selected]?.scrollIntoView({ block: 'nearest' });
}

// Close the popup once the user has jumped somewhere (a no-op when the page is opened as a normal tab).
const dismissPopup = () => window.close();

async function focusTab(tab: chrome.tabs.Tab): Promise<void> {
  if (tab.id === undefined) return;
  await chrome.tabs.update(tab.id, { active: true });
  if (tab.windowId !== undefined) await chrome.windows.update(tab.windowId, { focused: true });
  dismissPopup();
}

// ---------- views ----------
async function currentWindowId(): Promise<number> {
  return (await chrome.windows.getCurrent()).id!;
}

const isHttp = (t: chrome.tabs.Tab) => /^https?:/.test(t.url ?? '');

async function discardTabs(tabs: chrome.tabs.Tab[]): Promise<number> {
  let n = 0;
  for (const t of tabs) if (t.id !== undefined) await chrome.tabs.discard(t.id).then(() => n++, () => undefined);
  await addSuspended(n);
  return n;
}

async function renderTabs(): Promise<HTMLElement[]> {
  const [tabs, groups] = await Promise.all([chrome.tabs.query({}), chrome.tabGroups.query({})]);
  const groupById = new Map(groups.map((g) => [g.id, g]));
  const dupes = findDuplicateIds(tabs);
  const dupeSet = new Set(dupes);
  const winId = await currentWindowId();

  const matches: Record<Filter, (t: chrome.tabs.Tab) => boolean> = {
    all: () => true,
    suspended: (t) => !!t.discarded,
    playing: (t) => !!t.audible || !!t.mutedInfo?.muted,
    pinned: (t) => t.pinned,
    duplicates: (t) => t.id !== undefined && dupeSet.has(t.id),
  };
  const visible = tabs.filter(matches[filter]);

  const bar = el('div', { className: 'toolbar' },
    button('Group tabs', async () => {
      const r = await groupWindow(winId);
      flash(r.groups ? `Grouped ${r.tabs} tabs into ${r.groups} group${r.groups === 1 ? '' : 's'}.` : 'Nothing to group: no site or category has enough ungrouped tabs yet.');
      await render();
    }, { title: 'Group this window\'s ungrouped tabs by your rules, category, or site', icon: 'group' }),
    button('Ungroup all', async () => {
      if (!confirm('Remove all tab groups in this window? (Your tabs stay open.)')) return;
      const n = await ungroupWindow(winId);
      flash(n ? `Ungrouped ${n} tabs.` : 'No grouped tabs in this window.');
      await render();
    }, { title: 'Remove every tab group in this window', icon: 'ungroup' }),
    button('Suspend idle now', async () => {
      const [targets, { whitelist }] = await Promise.all([
        chrome.tabs.query({ active: false, pinned: false, audible: false, discarded: false }),
        getSettings(),
      ]);
      const n = await discardTabs(targets.filter((t) => isHttp(t) && !isWhitelisted(t.url, whitelist)));
      flash(n ? `Suspended ${n} tab${n === 1 ? '' : 's'} (≈${estimateMb(n)} MB freed).` : 'No idle tabs to suspend.');
      await render();
    }, { title: 'Suspend every background tab now (not pinned, not playing, not on your never-suspend list)', icon: 'moon' }),
    button(`Close duplicates (${dupes.length})`, async () => {
      const ids = findDuplicateIds(await chrome.tabs.query({}));
      if (ids.length) await chrome.tabs.remove(ids);
      await render();
    }, { title: 'Close tabs whose URL is already open in the same window', icon: 'copy' }),
  );

  const filterBar = el('div', { className: 'filters', role: 'group', ariaLabel: 'Filter tabs' },
    ...FILTERS.map((f) => {
      const n = tabs.filter(matches[f.id]).length;
      const b = el('button', { textContent: f.id === 'all' || n === 0 ? f.label : `${f.label} ${n}`, title: `Show ${f.label.toLowerCase()} tabs` });
      b.setAttribute('aria-pressed', String(filter === f.id));
      b.addEventListener('click', () => { filter = f.id; selected = 0; void render(); });
      return b;
    }),
  );

  const rows = visible.map((t) => {
    const group = t.groupId !== undefined ? groupById.get(t.groupId) : undefined;
    const pills: Pill[] = [];
    if (t.active) pills.push({ text: 'active', kind: 'accent' });
    if (t.discarded) pills.push({ text: 'suspended' });
    if (t.pinned) pills.push({ text: 'pinned' });
    if (t.audible) pills.push({ text: 'playing', kind: 'ok' });
    else if (t.mutedInfo?.muted) pills.push({ text: 'muted' });
    if (t.id !== undefined && dupeSet.has(t.id)) pills.push({ text: 'duplicate', kind: 'warn' });
    const buttons = [
      iconButton('pin', t.pinned ? 'Unpin tab' : 'Pin tab', async () => { if (t.id !== undefined) await chrome.tabs.update(t.id, { pinned: !t.pinned }); await render(); }, { pressed: t.pinned }),
    ];
    if (t.audible || t.mutedInfo?.muted) {
      const muted = !!t.mutedInfo?.muted;
      buttons.push(iconButton(muted ? 'mute' : 'sound', muted ? 'Unmute tab' : 'Mute tab', async () => { if (t.id !== undefined) await chrome.tabs.update(t.id, { muted: !muted }); await render(); }, { pressed: muted }));
    }
    if (!t.active && !t.discarded && isHttp(t)) {
      buttons.push(iconButton('moon', 'Suspend tab', async () => { await discardTabs([t]); await render(); }));
    }
    buttons.push(iconButton('close', 'Close tab', async () => { if (t.id !== undefined) await chrome.tabs.remove(t.id); await render(); }, { cls: 'danger' }));
    return item({
      title: t.title || t.url || 'Untitled',
      sub: t.url ?? '',
      icon: t.favIconUrl,
      cls: t.discarded ? 'discarded' : '',
      pills,
      chip: group ? { text: group.title || 'Group', color: group.color } : undefined,
      onClick: () => focusTab(t),
      buttons,
    });
  });
  const heading = filter === 'all' ? `Open tabs (${tabs.length})` : `${FILTERS.find((f) => f.id === filter)!.label} tabs (${visible.length})`;
  return [bar, filterBar, section(heading), rows.length ? list(...rows) : empty(filter === 'all' ? 'No tabs.' : 'No tabs match this filter.')];
}

async function renderWorkspaces(): Promise<HTMLElement[]> {
  const winId = await currentWindowId();
  const [wss, activeId] = await Promise.all([listWorkspaces(), getActiveWorkspaceId(winId)]);
  const input = el('input', { type: 'text', placeholder: 'New workspace name', maxLength: 60, ariaLabel: 'Workspace name', value: workspaceDraft });
  input.addEventListener('input', () => { workspaceDraft = input.value; });
  const create = async () => {
    if (!input.value.trim()) return input.focus();
    const name = input.value;
    workspaceDraft = '';
    await createWorkspace(name, winId);
    await render();
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') void create(); });
  const rows = wss.map((w) =>
    item({
      title: w.name,
      sub: `${w.tabs.length} tabs`,
      pills: w.id === activeId ? [{ text: 'active', kind: 'accent' }] : undefined,
      onClick: async () => { await switchWorkspace(winId, w.id!); await render(); dismissPopup(); },
      buttons: [
        iconButton('refresh', 'Save this window\'s tabs into the workspace', async () => { await updateWorkspaceFromWindow(w.id!, winId); flash(`Saved this window into "${w.name}".`); await render(); }),
        iconButton('trash', 'Delete workspace', async () => { if (confirm(`Delete workspace "${w.name}"?`)) { await deleteWorkspace(w.id!); await render(); } }, { cls: 'danger' }),
      ],
    }),
  );
  return [
    el('div', { className: 'row' }, input, button('Create', create, { title: 'Create a workspace from this window\'s tabs', cls: 'primary' })),
    section('Workspaces — click to switch'),
    rows.length ? list(...rows) : empty('No workspaces yet. Name one above to save this window as a workspace.'),
  ];
}

async function renderSessions(): Promise<HTMLElement[]> {
  const sessions = await listSessions();
  const rows = sessions.map((s) =>
    item({
      title: s.name,
      sub: `${s.tabs.length} tabs · ${new Date(s.createdAt).toLocaleString()}`,
      pills: s.kind === 'auto' ? [{ text: 'auto' }] : undefined,
      onClick: async () => { await restoreSession(s.id!); dismissPopup(); },
      buttons: [iconButton('trash', 'Delete session', async () => { await deleteSession(s.id!); await render(); }, { cls: 'danger' })],
    }),
  );
  return [
    el('div', { className: 'toolbar single' }, button('Save this window as a session', async () => { await saveCurrentWindow(); flash('Session saved.'); await render(); }, { icon: 'save' })),
    section('Sessions — click to restore in a new window'),
    rows.length ? list(...rows) : empty('No saved sessions yet.'),
  ];
}

async function renderSearch(query: string): Promise<HTMLElement[]> {
  const [tabs, sessions, wss] = await Promise.all([chrome.tabs.query({}), listSessions(), listWorkspaces()]);
  const docs: SearchDoc[] = [];
  const open = new Map<string, chrome.tabs.Tab>();
  for (const t of tabs) {
    if (t.id !== undefined && t.url) {
      docs.push({ id: `tab:${t.id}`, title: t.title ?? t.url, url: t.url, source: 'open' });
      open.set(`tab:${t.id}`, t);
    }
  }
  for (const s of sessions) s.tabs.forEach((t, i) => docs.push({ id: `saved:${s.id}:${i}`, title: t.title, url: t.url, source: 'saved', sessionName: s.name }));
  for (const w of wss) w.tabs.forEach((t, i) => docs.push({ id: `ws:${w.id}:${i}`, title: t.title, url: t.url, source: 'saved', sessionName: `Workspace: ${w.name}` }));
  const hits = search(createIndex(docs), query).slice(0, 100);
  const rows = hits.map((d) =>
    item({
      title: d.title,
      sub: d.source === 'saved' ? `${d.sessionName} · ${d.url}` : d.url,
      icon: open.get(d.id)?.favIconUrl,
      pills: [{ text: d.source === 'open' ? 'open' : 'saved', kind: d.source === 'open' ? 'accent' : undefined }],
      onClick: async () => {
        const tab = open.get(d.id);
        if (tab) await focusTab(tab);
        else {
          await chrome.tabs.create({ url: d.url });
          dismissPopup();
        }
      },
    }),
  );
  return [section(`Results (${hits.length})`), rows.length ? list(...rows) : empty('Nothing found.')];
}

async function renderStats(): Promise<void> {
  const [stats, tabs, sessions, wss] = await Promise.all([getStats(), chrome.tabs.query({}), listSessions(), listWorkspaces()]);
  const now = tabs.filter((t) => t.discarded).length;
  statsEl.textContent = `${now} suspended now (≈${estimateMb(now)} MB freed, estimate) · ${stats.suspendedTotal} suspended all-time`;
  const counts: Record<View, number> = { tabs: tabs.length, workspaces: wss.length, sessions: sessions.length };
  for (const v of VIEWS) nav.querySelector(`[data-count=${v}]`)!.textContent = counts[v] ? String(counts[v]) : '';
}

// Remember where the user was (storage.session is per browser run and never leaves the device).
const UI_KEY = 'popupUi';
async function loadUi(): Promise<void> {
  try {
    const saved = (await chrome.storage.session.get(UI_KEY))[UI_KEY] as { view?: View; filter?: Filter } | undefined;
    if (saved?.view && VIEWS.includes(saved.view)) view = saved.view;
    if (saved?.filter && FILTERS.some((f) => f.id === saved.filter)) filter = saved.filter;
  } catch { /* storage unavailable: start on defaults */ }
  nav.querySelectorAll('button').forEach((n) => n.setAttribute('aria-selected', String(n.dataset.view === view)));
}
const saveUi = () => void chrome.storage.session.set({ [UI_KEY]: { view, filter } }).catch(() => undefined);

let renderToken = 0;
async function render(): Promise<void> {
  const token = ++renderToken;
  actions = [];
  const query = q.value.trim();
  const nodes = query ? await renderSearch(query) : view === 'tabs' ? await renderTabs() : view === 'workspaces' ? await renderWorkspaces() : await renderSessions();
  if (token !== renderToken) return; // a newer render superseded this one
  const scroll = main.scrollTop;
  main.replaceChildren(...nodes);
  main.scrollTop = scroll;
  selected = Math.min(selected, Math.max(0, actions.length - 1));
  highlight();
  saveUi();
  await renderStats();
}

// ---------- events ----------
nav.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-view]');
  if (!b) return;
  view = b.dataset.view as View;
  q.value = '';
  selected = 0;
  nav.querySelectorAll('button').forEach((n) => n.setAttribute('aria-selected', String(n === b)));
  void render();
});
q.addEventListener('input', () => { selected = 0; void render(); });
q.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { selected = Math.min(selected + 1, actions.length - 1); highlight(); e.preventDefault(); }
  else if (e.key === 'ArrowUp') { selected = Math.max(selected - 1, 0); highlight(); e.preventDefault(); }
  else if (e.key === 'Enter') void actions[selected]?.();
  else if (e.key === 'Escape') { q.value = ''; void render(); }
});

document.getElementById('brand')!.append(icon('logo'));
document.getElementById('search-icon')!.append(icon('search'));
const gear = document.getElementById('gear')!;
gear.append(icon('gear'));
gear.addEventListener('click', () => void chrome.runtime.openOptionsPage());

let timer: ReturnType<typeof setTimeout> | undefined;
// Only the tab list and search results depend on tab events; the workspace and session views must not be rebuilt under the user.
const rerenderSoon = () => {
  if (!q.value.trim() && view !== 'tabs') return;
  clearTimeout(timer);
  timer = setTimeout(() => void render(), 250);
};
chrome.tabs.onUpdated.addListener(rerenderSoon);
chrome.tabs.onRemoved.addListener(rerenderSoon);
chrome.tabs.onCreated.addListener(rerenderSoon);

void loadUi().then(render);
