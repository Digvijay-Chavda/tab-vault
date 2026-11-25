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
let view: View = 'tabs';
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

// ---------- tiny DOM helpers (textContent only: page titles/URLs are untrusted) ----------
function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...kids);
  return node;
}

function button(label: string, onClick: () => void | Promise<void>, opts: { title?: string; cls?: string } = {}): HTMLButtonElement {
  const b = el('button', { textContent: label, title: opts.title ?? label, className: opts.cls ?? '' });
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    void onClick();
  });
  return b;
}

function item(opts: {
  title: string; sub: string; icon?: string; cls?: string; badge?: string; chip?: { text: string; color: string };
  onClick: () => void | Promise<void>; buttons?: HTMLElement[];
}): HTMLLIElement {
  const li = el('li', { className: opts.cls ?? '', role: 'option' });
  if (opts.icon && /^https?:/.test(opts.icon)) {
    const img = el('img', { src: opts.icon, alt: '', loading: 'lazy' });
    img.addEventListener('error', () => img.remove());
    li.append(img);
  }
  const t = el('div', { className: 't' }, el('b', { textContent: opts.title }), el('small', { textContent: opts.sub }));
  li.append(t);
  if (opts.chip) {
    li.append(el('span', { className: 'chip', textContent: opts.chip.text, title: `Tab group: ${opts.chip.text}`, style: `background:${GROUP_HEX[opts.chip.color] ?? GROUP_HEX.grey}` }));
  }
  if (opts.badge) li.append(el('span', { className: 'badge', textContent: opts.badge }));
  if (opts.buttons) li.append(...opts.buttons);
  li.addEventListener('click', () => void opts.onClick());
  actions.push(opts.onClick);
  return li;
}

const section = (label: string) => el('h2', { textContent: label });
const empty = (msg: string) => el('p', { className: 'empty', textContent: msg });
const list = (...items: HTMLLIElement[]) => el('ul', { role: 'listbox' }, ...items);

function highlight(): void {
  const items = main.querySelectorAll<HTMLLIElement>('li[role=option]');
  items.forEach((li, i) => li.setAttribute('aria-selected', String(i === selected)));
  items[selected]?.scrollIntoView({ block: 'nearest' });
}

// ---------- views ----------
async function currentWindowId(): Promise<number> {
  return (await chrome.windows.getCurrent()).id!;
}

async function renderTabs(): Promise<HTMLElement[]> {
  const [tabs, groups] = await Promise.all([chrome.tabs.query({}), chrome.tabGroups.query({})]);
  const groupById = new Map(groups.map((g) => [g.id, g]));
  const dupes = findDuplicateIds(tabs);
  const winId = await currentWindowId();
  const bar = el('div', { className: 'toolbar' },
    button('Group tabs', async () => {
      const r = await groupWindow(winId);
      flash(r.groups ? `Grouped ${r.tabs} tabs into ${r.groups} group${r.groups === 1 ? '' : 's'}.` : 'Nothing to group: no site or category has enough ungrouped tabs yet.');
      await render();
    }, { title: 'Group this window\'s ungrouped tabs by your rules, category, or site' }),
    button('Ungroup all', async () => {
      if (!confirm('Remove all tab groups in this window? (Your tabs stay open.)')) return;
      const n = await ungroupWindow(winId);
      flash(n ? `Ungrouped ${n} tabs.` : 'No grouped tabs in this window.');
      await render();
    }, { title: 'Remove every tab group in this window' }),
    button('Suspend idle now', async () => {
      const [targets, { whitelist }] = await Promise.all([
        chrome.tabs.query({ active: false, pinned: false, audible: false, discarded: false }),
        getSettings(),
      ]);
      let n = 0;
      for (const t of targets) {
        if (t.id !== undefined && /^https?:/.test(t.url ?? '') && !isWhitelisted(t.url, whitelist)) {
          await chrome.tabs.discard(t.id).then(() => n++, () => undefined);
        }
      }
      await addSuspended(n);
      await render();
    }),
    button(`Close duplicates (${dupes.length})`, async () => {
      const ids = findDuplicateIds(await chrome.tabs.query({}));
      if (ids.length) await chrome.tabs.remove(ids);
      await render();
    }, { title: 'Close tabs whose URL is already open in the same window' }),
  );
  const rows = tabs.map((t) =>
    item({
      title: t.title || t.url || 'Untitled',
      sub: t.url ?? '',
      icon: t.favIconUrl,
      cls: t.discarded ? 'discarded' : '',
      badge: t.discarded ? 'suspended' : t.active ? 'active' : undefined,
      chip: t.groupId !== undefined && groupById.has(t.groupId)
        ? { text: groupById.get(t.groupId)!.title || 'Group', color: groupById.get(t.groupId)!.color }
        : undefined,
      onClick: async () => {
        if (t.id === undefined) return;
        await chrome.tabs.update(t.id, { active: true });
        if (t.windowId !== undefined) await chrome.windows.update(t.windowId, { focused: true });
      },
      buttons: [button('✕', async () => { if (t.id !== undefined) await chrome.tabs.remove(t.id); await render(); }, { title: 'Close tab', cls: 'danger' })],
    }),
  );
  return [bar, section(`Open tabs (${tabs.length})`), rows.length ? list(...rows) : empty('No tabs.')];
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
      badge: w.id === activeId ? 'active' : undefined,
      onClick: async () => { await switchWorkspace(winId, w.id!); await render(); },
      buttons: [
        button('↻', async () => { await updateWorkspaceFromWindow(w.id!, winId); await render(); }, { title: 'Save this window\'s tabs into the workspace' }),
        button('✕', async () => { if (confirm(`Delete workspace "${w.name}"?`)) { await deleteWorkspace(w.id!); await render(); } }, { title: 'Delete workspace', cls: 'danger' }),
      ],
    }),
  );
  return [
    el('div', { className: 'row' }, input, button('Create', create, { title: 'Create a workspace from this window\'s tabs' })),
    section('Workspaces — click to switch (your current tabs are saved first)'),
    rows.length ? list(...rows) : empty('No workspaces yet. Name one above to save this window as a workspace.'),
  ];
}

async function renderSessions(): Promise<HTMLElement[]> {
  const sessions = await listSessions();
  const rows = sessions.map((s) =>
    item({
      title: s.name,
      sub: `${s.tabs.length} tabs · ${new Date(s.createdAt).toLocaleString()}`,
      badge: s.kind === 'auto' ? 'auto' : undefined,
      onClick: () => restoreSession(s.id!),
      buttons: [button('✕', async () => { await deleteSession(s.id!); await render(); }, { title: 'Delete session', cls: 'danger' })],
    }),
  );
  return [
    el('div', { className: 'toolbar' }, button('Save this window as a session', async () => { await saveCurrentWindow(); await render(); })),
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
      badge: d.source === 'open' ? 'open' : 'saved',
      onClick: async () => {
        const tab = open.get(d.id);
        if (tab?.id !== undefined) {
          await chrome.tabs.update(tab.id, { active: true });
          if (tab.windowId !== undefined) await chrome.windows.update(tab.windowId, { focused: true });
        } else {
          await chrome.tabs.create({ url: d.url });
        }
      },
    }),
  );
  return [section(`Results (${hits.length})`), rows.length ? list(...rows) : empty('Nothing found.')];
}

async function renderStats(): Promise<void> {
  const [stats, tabs] = await Promise.all([getStats(), chrome.tabs.query({})]);
  const now = tabs.filter((t) => t.discarded).length;
  statsEl.textContent = `${now} suspended now (≈${estimateMb(now)} MB freed, estimate) · ${stats.suspendedTotal} suspended all-time`;
}

let renderToken = 0;
async function render(): Promise<void> {
  const token = ++renderToken;
  actions = [];
  const query = q.value.trim();
  const nodes = query ? await renderSearch(query) : view === 'tabs' ? await renderTabs() : view === 'workspaces' ? await renderWorkspaces() : await renderSessions();
  if (token !== renderToken) return; // a newer render superseded this one
  main.replaceChildren(...nodes);
  selected = Math.min(selected, Math.max(0, actions.length - 1));
  highlight();
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
document.getElementById('gear')!.addEventListener('click', () => void chrome.runtime.openOptionsPage());

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

void render();
