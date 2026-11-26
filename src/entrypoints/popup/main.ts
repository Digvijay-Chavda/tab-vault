import { isWhitelisted } from '../../core/rules';
import { getSettings, saveSettings } from '../../core/settings';
import { addSuspended, estimateMb, getStats } from '../../core/stats';
import { findDuplicateIds } from '../../core/duplicates';
import { groupWindow, ungroupWindow } from '../../core/grouping-apply';
import { createIndex, search, type SearchDoc } from '../../core/search';
import { deleteSession, listSessions, renameSession, restoreSession, saveCurrentWindow, saveTabsAsSession } from '../../core/sessions';
import { createWorkspace, deleteWorkspace, getActiveWorkspaceId, listWorkspaces, renameWorkspace, switchWorkspace, updateWorkspaceFromWindow } from '../../core/workspaces';
import { listClosed, restoreClosed, timeAgo } from '../../core/closed';
import { clearStash, listStash, removeStash, stashTabs, unstash } from '../../core/stash';
import { formatTags, noteKey } from '../../core/notes';
import { getNotes, setNote } from '../../core/notes-store';
import { EVERY_DAY, WEEKDAYS, describeDays, getSchedules, parseTime, setSchedule } from '../../core/schedule';
import { summarize, type SortMode } from '../../core/tab-plans';
import { mergeWindows, moveTab, panic, sortWindow, whitelistSite } from '../../core/tab-actions';
import { backupNow } from '../../core/backup-schedule';
import type { NoteEntry } from '../../core/types';
import { askForm, button, el, icon, iconButton, openMenu, type IconName, type MenuItem } from './dom';

type View = 'tabs' | 'stash' | 'workspaces' | 'sessions' | 'closed' | 'insights' | 'help';
type Filter = 'all' | 'suspended' | 'playing' | 'pinned' | 'duplicates';
const NAV: View[] = ['tabs', 'stash', 'workspaces', 'sessions', 'closed', 'insights'];
const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' }, { id: 'suspended', label: 'Suspended' }, { id: 'playing', label: 'Playing' },
  { id: 'pinned', label: 'Pinned' }, { id: 'duplicates', label: 'Duplicates' },
];
const hasGroups = typeof chrome.tabGroups !== 'undefined';

let view: View = 'tabs';
let filter: Filter = 'all';
let selected = 0;
// Draft text survives re-renders (tab events rebuild the DOM; users must never lose what they are typing).
let workspaceDraft = '';
let actions: Array<() => void | Promise<void>> = [];
const picked = new Set<number>(); // multi-selected tab ids
let lastPicked: number | undefined;
let visibleIds: number[] = [];

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

interface Pill { text: string; kind?: 'accent' | 'ok' | 'warn' | 'tag' }

function item(opts: {
  title: string; sub: string; icon?: string; glyph?: IconName; cls?: string; pills?: Pill[]; tooltip?: string;
  chip?: { text: string; color: string }; picked?: boolean;
  onClick: (e?: MouseEvent) => void | Promise<void>; buttons?: HTMLElement[];
}): HTMLLIElement {
  const li = el('li', { className: `${opts.cls ?? ''}${opts.picked ? ' picked' : ''}`.trim(), role: 'option', title: opts.tooltip ?? '' });
  const fav = el('span', { className: 'fav' });
  if (opts.glyph) {
    fav.append(icon(opts.glyph));
  } else if (opts.icon && /^https?:/.test(opts.icon)) {
    const img = el('img', { src: opts.icon, alt: '', loading: 'lazy' });
    img.addEventListener('error', () => img.replaceWith(icon('globe')));
    fav.append(img);
  } else {
    fav.append(icon('globe'));
  }
  if (opts.picked) li.setAttribute('data-picked', 'true');
  li.append(fav, el('div', { className: 't' }, el('b', { textContent: opts.title }), el('small', { textContent: opts.sub })));
  const meta = el('span', { className: 'meta' });
  if (opts.chip) {
    meta.append(el('span', { className: 'chip', textContent: opts.chip.text, title: `Tab group: ${opts.chip.text}`, style: `background:${GROUP_HEX[opts.chip.color] ?? GROUP_HEX.grey}` }));
  }
  for (const p of opts.pills ?? []) meta.append(el('span', { className: `pill ${p.kind ?? ''}`.trim(), textContent: p.text }));
  if (meta.childElementCount) li.append(meta);
  if (opts.buttons?.length) li.append(el('span', { className: 'actions' }, ...opts.buttons));
  li.addEventListener('click', (e) => void opts.onClick(e));
  actions.push(() => opts.onClick());
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
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

async function currentWindowId(): Promise<number> {
  return (await chrome.windows.getCurrent()).id!;
}

async function focusTab(tab: chrome.tabs.Tab): Promise<void> {
  if (tab.id === undefined) return;
  await chrome.tabs.update(tab.id, { active: true });
  if (tab.windowId !== undefined) await chrome.windows.update(tab.windowId, { focused: true });
  dismissPopup();
}

const isHttp = (t: chrome.tabs.Tab) => /^https?:/.test(t.url ?? '');

async function discardTabs(tabs: chrome.tabs.Tab[]): Promise<number> {
  let n = 0;
  for (const t of tabs) if (t.id !== undefined) await chrome.tabs.discard(t.id).then(() => n++, () => undefined);
  await addSuspended(n);
  return n;
}

async function activeTab(): Promise<chrome.tabs.Tab | undefined> {
  return (await chrome.tabs.query({ active: true, windowId: await currentWindowId() }))[0];
}

async function editNote(url: string, existing?: NoteEntry): Promise<void> {
  const v = await askForm('Note and tags', [
    { label: 'Note', value: existing?.note ?? '', placeholder: 'Why you kept this', maxLength: 500 },
    { label: 'Tags (separate with spaces)', value: existing ? formatTags(existing.tags) : '', placeholder: '#work #read-later' },
  ]);
  if (!v) return;
  await setNote(url, v[0]!, v[1]!);
  flash('Note saved.');
  await render();
}

const stashAndFlash = async (tabs: chrome.tabs.Tab[]) => {
  const n = await stashTabs(tabs);
  flash(n ? `Stashed ${plural(n, 'tab')}. Find them under Stash.` : 'Only web pages can be stashed.');
  picked.clear();
  await render();
};

// ---------- shared actions (toolbar buttons, menus and the command palette) ----------
const runGroup = async () => {
  const r = await groupWindow(await currentWindowId());
  return r.groups ? `Grouped ${r.tabs} tabs into ${r.groups} group${r.groups === 1 ? '' : 's'}.` : 'Nothing to group: no site or category has enough ungrouped tabs yet.';
};
const runUngroup = async () => {
  if (!confirm('Remove all tab groups in this window? (Your tabs stay open.)')) return 'Cancelled.';
  const n = await ungroupWindow(await currentWindowId());
  return n ? `Ungrouped ${n} tabs.` : 'No grouped tabs in this window.';
};
const runSuspendIdle = async () => {
  const [targets, { whitelist }] = await Promise.all([
    chrome.tabs.query({ active: false, pinned: false, audible: false, discarded: false }),
    getSettings(),
  ]);
  const n = await discardTabs(targets.filter((t) => isHttp(t) && !isWhitelisted(t.url, whitelist)));
  return n ? `Suspended ${plural(n, 'tab')} (≈${estimateMb(n)} MB freed).` : 'No idle tabs to suspend.';
};
const runPanic = async () => {
  const n = await panic();
  return n ? `Panic: suspended ${plural(n, 'tab')}. Only the active tab in each window is still loaded.` : 'Nothing to suspend.';
};
const runCloseDuplicates = async () => {
  const ids = findDuplicateIds(await chrome.tabs.query({}));
  if (ids.length) await chrome.tabs.remove(ids);
  return ids.length ? `Closed ${plural(ids.length, 'duplicate')}.` : 'No duplicates.';
};
const runSort = (mode: SortMode) => async () => {
  const n = await sortWindow(await currentWindowId(), mode);
  return n ? `Sorted ${plural(n, 'tab')}.` : 'Already sorted.';
};
const runMerge = async () => {
  const n = await mergeWindows(await currentWindowId());
  return n ? `Moved ${plural(n, 'tab')} into this window.` : 'No other windows to merge.';
};
const runSaveSession = async () => { await saveCurrentWindow(); return 'Session saved.'; };
const runStashActive = async () => {
  const t = await activeTab();
  const n = t ? await stashTabs([t]) : 0;
  return n ? 'Stashed. Find it under Stash.' : 'This page cannot be stashed.';
};
const runWhitelist = async () => {
  const host = await whitelistSite((await activeTab())?.url);
  return host ? `${host} will never be suspended.` : 'This page has no site to protect.';
};
const toggleTheme = async () => {
  const dark = document.documentElement.dataset.theme === 'dark' || (document.documentElement.dataset.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  const s = await saveSettings({ theme: dark ? 'light' : 'dark' });
  applyLook(s.theme, s.density);
  return `Theme: ${s.theme}.`;
};

/** Runs an action, shows its message, refreshes the list. */
const act = (fn: () => Promise<string | void>) => async () => {
  try {
    const msg = await fn();
    if (msg) flash(msg);
  } catch (e) {
    flash(e instanceof Error ? e.message : 'That did not work.');
  }
  await render();
};

// ---------- views ----------
async function windowMenu(anchor: HTMLElement, tab: chrome.tabs.Tab): Promise<void> {
  const here = await chrome.windows.get(tab.windowId!);
  const wins = (await chrome.windows.getAll({ populate: true, windowTypes: ['normal'] })).filter((w) => w.id !== tab.windowId && w.incognito === here.incognito);
  const items: MenuItem[] = wins.map((w) => ({
    label: `Window · ${plural(w.tabs?.length ?? 0, 'tab')} · ${(w.tabs?.find((x) => x.active)?.title ?? '').slice(0, 28)}`,
    icon: 'windows' as const,
    run: act(async () => { await moveTab(tab.id!, w.id!); return 'Moved.'; }),
  }));
  items.push({ label: 'New window', icon: 'windows', run: act(async () => { await chrome.windows.create({ tabId: tab.id }); return 'Moved to a new window.'; }) });
  openMenu(anchor, items);
}

function tabMenu(anchor: HTMLElement, t: chrome.tabs.Tab, note: NoteEntry | undefined): void {
  const items: MenuItem[] = [
    { label: 'Stash and close', icon: 'stash', run: () => stashAndFlash([t]) },
    { label: note ? 'Edit note and tags…' : 'Add note and tags…', icon: 'note', run: () => editNote(t.url ?? '', note) },
    { label: 'Move to window…', icon: 'move', run: () => windowMenu(anchor, t) },
  ];
  if (!t.active && !t.discarded && isHttp(t)) items.push({ label: 'Suspend tab', icon: 'moon', run: act(async () => { await discardTabs([t]); }) });
  if (t.audible || t.mutedInfo?.muted) {
    const muted = !!t.mutedInfo?.muted;
    items.push({ label: muted ? 'Unmute tab' : 'Mute tab', icon: muted ? 'sound' : 'mute', run: act(async () => { await chrome.tabs.update(t.id!, { muted: !muted }); }) });
  }
  if (isHttp(t)) items.push({ label: 'Never suspend this site', icon: 'shield', run: act(async () => { const h = await whitelistSite(t.url); return h ? `${h} will never be suspended.` : undefined; }) });
  openMenu(anchor, items);
}

async function renderTabs(): Promise<HTMLElement[]> {
  const [tabs, groups, notes] = await Promise.all([chrome.tabs.query({}), hasGroups ? chrome.tabGroups.query({}) : Promise.resolve([]), getNotes()]);
  const groupById = new Map(groups.map((g) => [g.id, g]));
  const dupes = findDuplicateIds(tabs);
  const dupeSet = new Set(dupes);
  for (const id of [...picked]) if (!tabs.some((t) => t.id === id)) picked.delete(id);

  const matches: Record<Filter, (t: chrome.tabs.Tab) => boolean> = {
    all: () => true,
    suspended: (t) => !!t.discarded,
    playing: (t) => !!t.audible || !!t.mutedInfo?.muted,
    pinned: (t) => t.pinned,
    duplicates: (t) => t.id !== undefined && dupeSet.has(t.id),
  };
  const visible = tabs.filter(matches[filter]);
  visibleIds = visible.flatMap((t) => (t.id === undefined ? [] : [t.id]));

  const organize = el('button', { title: 'Sort tabs or merge windows' });
  organize.append(icon('sort'), 'Organize…');
  organize.addEventListener('click', (e) => {
    e.stopPropagation();
    openMenu(organize, [
      { label: 'Sort by title', icon: 'sort', run: act(runSort('title')) },
      { label: 'Sort by site', icon: 'sort', run: act(runSort('site')) },
      { label: 'Sort by recent use', icon: 'clock', run: act(runSort('recent')) },
      { label: 'Merge all windows into this one', icon: 'windows', run: act(runMerge) },
    ]);
  });
  const bar = el('div', { className: 'toolbar' },
    ...(hasGroups ? [
      button('Group tabs', act(runGroup), { title: 'Group this window\'s ungrouped tabs by your rules, category, or site', icon: 'group' }),
      button('Ungroup all', act(runUngroup), { title: 'Remove every tab group in this window', icon: 'ungroup' }),
    ] : []),
    button('Suspend idle now', act(runSuspendIdle), { title: 'Suspend every background tab now (not pinned, not playing, not on your never-suspend list)', icon: 'moon' }),
    button(`Close duplicates (${dupes.length})`, act(runCloseDuplicates), { title: 'Close tabs whose URL is already open in the same window', icon: 'copy' }),
    organize,
    button('Panic', act(runPanic), { title: 'Suspend every tab except the active one in each window', icon: 'zap', cls: 'panic' }),
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

  const bulk = picked.size === 0 ? [] : [el('div', { className: 'bulk' },
    el('span', { textContent: `${picked.size} selected` }),
    button('Stash', async () => stashAndFlash(tabs.filter((t) => t.id !== undefined && picked.has(t.id))), { icon: 'stash' }),
    ...(hasGroups ? [button('Group…', async () => {
      const v = await askForm('Group selected tabs', [{ label: 'Group name', placeholder: 'e.g. Research', maxLength: 30 }], 'Group');
      if (!v) return;
      const ids = tabs.filter((t) => t.id !== undefined && picked.has(t.id) && !t.pinned).map((t) => t.id!);
      if (ids.length) {
        const gid = await chrome.tabs.group({ tabIds: ids as [number, ...number[]], createProperties: { windowId: await currentWindowId() } });
        await chrome.tabGroups.update(gid, { title: v[0]!.trim().slice(0, 30), color: 'blue' });
        flash(`Grouped ${plural(ids.length, 'tab')}.`);
      }
      picked.clear();
      await render();
    }, { icon: 'group' })] : []),
    button('Save session', async () => {
      const n = await saveTabsAsSession(tabs.filter((t) => t.id !== undefined && picked.has(t.id)), `Selection ${new Date().toLocaleString()}`);
      flash(`Saved ${plural(n, 'tab')} as a session.`);
      picked.clear();
      await render();
    }, { icon: 'save' }),
    button('Close', async () => { await chrome.tabs.remove([...picked]); picked.clear(); await render(); }, { icon: 'close', cls: 'danger' }),
    iconButton('undo', 'Clear selection', async () => { picked.clear(); await render(); }),
  )];

  const rows = visible.map((t) => {
    const group = t.groupId !== undefined ? groupById.get(t.groupId) : undefined;
    const note = notes.get(noteKey(t.url ?? ''));
    const pills: Pill[] = [];
    if (t.active) pills.push({ text: 'active', kind: 'accent' });
    if (t.discarded) pills.push({ text: 'suspended' });
    if (t.pinned) pills.push({ text: 'pinned' });
    if (t.audible) pills.push({ text: 'playing', kind: 'ok' });
    else if (t.mutedInfo?.muted) pills.push({ text: 'muted' });
    if (t.id !== undefined && dupeSet.has(t.id)) pills.push({ text: 'duplicate', kind: 'warn' });
    for (const tag of note?.tags.slice(0, 2) ?? []) pills.push({ text: `#${tag}`, kind: 'tag' });
    const buttons = [
      iconButton('pin', t.pinned ? 'Unpin tab' : 'Pin tab', async () => { if (t.id !== undefined) await chrome.tabs.update(t.id, { pinned: !t.pinned }); await render(); }, { pressed: t.pinned }),
      iconButton('more', 'More actions', (anchor) => tabMenu(anchor, t, note)),
      iconButton('close', 'Close tab', async () => { if (t.id !== undefined) await chrome.tabs.remove(t.id); await render(); }, { cls: 'danger' }),
    ];
    return item({
      title: t.title || t.url || 'Untitled',
      sub: note?.note ? `${note.note} · ${t.url ?? ''}` : (t.url ?? ''),
      tooltip: note?.note || undefined,
      icon: t.favIconUrl,
      cls: t.discarded ? 'discarded' : '',
      picked: t.id !== undefined && picked.has(t.id),
      pills,
      chip: group ? { text: group.title || 'Group', color: group.color } : undefined,
      onClick: async (e) => {
        if (t.id === undefined) return;
        if (e?.ctrlKey || e?.metaKey) {
          if (picked.has(t.id)) picked.delete(t.id); else picked.add(t.id);
          lastPicked = t.id;
          await render();
        } else if (e?.shiftKey && lastPicked !== undefined) {
          const a = visibleIds.indexOf(lastPicked);
          const b = visibleIds.indexOf(t.id);
          for (const id of visibleIds.slice(Math.min(a, b), Math.max(a, b) + 1)) picked.add(id);
          await render();
        } else {
          picked.clear();
          await focusTab(t);
        }
      },
      buttons,
    });
  });
  const heading = filter === 'all' ? `Open tabs (${tabs.length})` : `${FILTERS.find((f) => f.id === filter)!.label} tabs (${visible.length})`;
  const hint = el('p', { className: 'hint-line', textContent: 'Ctrl/Cmd-click or Shift-click to select several tabs.' });
  return [bar, filterBar, ...bulk, section(heading), rows.length ? list(...rows) : empty(filter === 'all' ? 'No tabs.' : 'No tabs match this filter.'), ...(rows.length > 1 && picked.size === 0 ? [hint] : [])];
}

async function renderStash(): Promise<HTMLElement[]> {
  const [items, notes] = await Promise.all([listStash(), getNotes()]);
  const rows = items.map((s) => {
    const note = notes.get(noteKey(s.url));
    return item({
      title: s.title,
      sub: `${note?.note ? `${note.note} · ` : ''}${s.url} · ${timeAgo(s.createdAt)}`,
      icon: s.favIconUrl,
      tooltip: note?.note || undefined,
      pills: (note?.tags.slice(0, 2) ?? []).map((tag) => ({ text: `#${tag}`, kind: 'tag' as const })),
      onClick: async () => { await unstash(s); dismissPopup(); await render(); },
      buttons: [
        iconButton('note', note ? 'Edit note and tags' : 'Add note and tags', () => editNote(s.url, note)),
        iconButton('trash', 'Remove from stash', async () => { await removeStash(s.id!); await render(); }, { cls: 'danger' }),
      ],
    });
  });
  const bar = el('div', { className: 'toolbar' },
    button('Stash this tab', act(runStashActive), { title: 'Save the active tab for later and close it (Alt+Shift+S)', icon: 'stash' }),
    button('Clear stash', async () => { if (items.length && confirm(`Remove all ${items.length} stashed tabs?`)) { await clearStash(); await render(); } }, { icon: 'trash', cls: 'danger' }),
  );
  return [bar, section(`Stashed tabs (${items.length}) — click to reopen`), rows.length ? list(...rows) : empty('Nothing stashed. Use "Stash and close" on a tab to park it here.')];
}

const DAY_PRESETS: Array<{ value: string; label: string; days: number[] }> = [
  { value: 'weekdays', label: 'Weekdays', days: WEEKDAYS },
  { value: 'every', label: 'Every day', days: EVERY_DAY },
  { value: 'weekends', label: 'Weekends', days: [0, 6] },
  { value: 'mwf', label: 'Mon, Wed, Fri', days: [1, 3, 5] },
];

async function renderWorkspaces(): Promise<HTMLElement[]> {
  const winId = await currentWindowId();
  const [wss, activeId, schedules] = await Promise.all([listWorkspaces(), getActiveWorkspaceId(winId), getSchedules()]);
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
  const rows = wss.map((w) => {
    const sched = schedules.find((s) => s.workspaceId === w.id);
    const pills: Pill[] = [];
    if (w.id === activeId) pills.push({ text: 'active', kind: 'accent' });
    if (sched) pills.push({ text: `⏰ ${sched.time} ${describeDays(sched.days)}` });
    return item({
      title: w.name,
      sub: `${w.tabs.length} tabs`,
      pills,
      onClick: async () => { await switchWorkspace(winId, w.id!); await render(); dismissPopup(); },
      buttons: [
        iconButton('refresh', 'Save this window\'s tabs into the workspace', async () => { await updateWorkspaceFromWindow(w.id!, winId); flash(`Saved this window into "${w.name}".`); await render(); }),
        iconButton('more', 'More actions', (anchor) => openMenu(anchor, [
          { label: 'Rename…', icon: 'note', run: async () => { const v = await askForm('Rename workspace', [{ label: 'Name', value: w.name, maxLength: 60 }]); if (v) { await renameWorkspace(w.id!, v[0]!); await render(); } } },
          { label: sched ? 'Change schedule…' : 'Open automatically…', icon: 'clock', run: async () => {
            const preset = DAY_PRESETS.find((p) => sched && describeDays(p.days) === describeDays(sched.days))?.value ?? 'weekdays';
            const v = await askForm(`Open "${w.name}" automatically`, [
              { label: 'Time (24h, like 09:00). Leave empty to remove.', value: sched?.time ?? '', placeholder: '09:00', maxLength: 5 },
              { label: 'Days', value: preset, options: DAY_PRESETS.map((p) => ({ value: p.value, label: p.label })) },
            ]);
            if (!v) return;
            const time = parseTime(v[0]!);
            if (!v[0]!.trim()) await setSchedule({ workspaceId: w.id!, remove: true });
            else if (!time) { flash('That is not a time. Use 24h like 09:00.'); return; }
            else await setSchedule({ workspaceId: w.id!, time, days: DAY_PRESETS.find((p) => p.value === v[1])!.days });
            flash(time ? `Will open at ${time}, in a new window.` : 'Schedule removed.');
            await render();
          } },
          { label: 'Delete workspace', icon: 'trash', danger: true, run: async () => { if (confirm(`Delete workspace "${w.name}"?`)) { await deleteWorkspace(w.id!); await setSchedule({ workspaceId: w.id!, remove: true }); await render(); } } },
        ])),
      ],
    });
  });
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
      pills: s.kind === 'auto' ? [{ text: 'auto' }] : s.kind === 'archive' ? [{ text: 'archive' }] : undefined,
      onClick: async () => { await restoreSession(s.id!); dismissPopup(); },
      buttons: [
        iconButton('note', 'Rename session', async () => { const v = await askForm('Rename session', [{ label: 'Name', value: s.name, maxLength: 120 }]); if (v) { await renameSession(s.id!, v[0]!); await render(); } }),
        iconButton('trash', 'Delete session', async () => { await deleteSession(s.id!); await render(); }, { cls: 'danger' }),
      ],
    }),
  );
  return [
    el('div', { className: 'toolbar single' }, button('Save this window as a session', act(runSaveSession), { icon: 'save' })),
    section('Sessions — click to restore in a new window'),
    rows.length ? list(...rows) : empty('No saved sessions yet.'),
  ];
}

async function renderClosed(): Promise<HTMLElement[]> {
  const closed = await listClosed();
  const rows = closed.map((c) =>
    item({
      title: c.title,
      sub: c.kind === 'window' ? `${c.url} + ${c.tabs - 1} more · ${timeAgo(c.closedAt)}` : `${c.url} · ${timeAgo(c.closedAt)}`,
      icon: c.favIconUrl,
      pills: [{ text: c.kind === 'window' ? 'window' : 'tab' }],
      onClick: async () => { await restoreClosed(c.sessionId); dismissPopup(); await render(); },
      buttons: [iconButton('undo', c.kind === 'window' ? 'Restore window' : 'Restore tab', async () => { await restoreClosed(c.sessionId); dismissPopup(); await render(); })],
    }),
  );
  return [section(`Recently closed (${closed.length}) — click to reopen`), rows.length ? list(...rows) : empty('Nothing closed recently.')];
}

async function renderInsights(): Promise<HTMLElement[]> {
  const [tabs, stats, stash] = await Promise.all([chrome.tabs.query({}), getStats(), listStash()]);
  const s = summarize(tabs, findDuplicateIds(tabs), Date.now());
  const card = (value: string | number, label: string) => el('div', { className: 'card' }, el('b', { textContent: String(value) }), el('span', { textContent: label }));
  const max = s.topSites[0]?.count ?? 1;
  const oldest = s.oldest.map((o) =>
    item({
      title: o.title, sub: o.url, pills: [{ text: o.idleDays === 0 ? 'today' : `${o.idleDays} d idle` }],
      onClick: async () => { const t = tabs.find((x) => x.id === o.id); if (t) await focusTab(t); },
    }),
  );
  return [
    el('div', { className: 'cards' },
      card(s.tabs, 'open tabs'), card(s.windows, plural(s.windows, 'window').replace(/^\d+ /, '')), card(s.suspended, 'suspended'),
      card(s.duplicates, 'duplicates'), card(s.pinned, 'pinned'), card(stash.length, 'stashed'),
    ),
    el('p', { className: 'hint-line', textContent: `About ${estimateMb(s.tabs - s.suspended)} MB used by loaded tabs (estimate: browsers do not let extensions read real per-tab memory). ${stats.suspendedTotal} tabs suspended all-time.` }),
    section('Top sites'),
    s.topSites.length
      ? el('div', { className: 'bars' }, ...s.topSites.map((t) =>
        el('div', { className: 'bar' },
          el('span', { className: 'bar-label', textContent: t.site }),
          el('span', { className: 'bar-track' }, el('span', { className: 'bar-fill', style: `width:${Math.round((t.count / max) * 100)}%` })),
          el('span', { className: 'bar-n', textContent: String(t.count) }),
        )))
      : empty('No web tabs open.'),
    section('Longest unopened'),
    oldest.length ? list(...oldest) : empty('Nothing to show yet.'),
  ];
}

function renderHelp(): HTMLElement[] {
  const rows: Array<[string, string]> = [
    ['Ctrl/Cmd + K', 'Open the command palette (or type > in search)'],
    ['↑ ↓ Enter', 'Move through the list and open'],
    ['Alt + 1 … 6', 'Jump to Tabs, Stash, Workspaces, Sessions, Closed, Insights'],
    ['Ctrl/Cmd-click, Shift-click', 'Select several tabs, then stash, group, save or close them'],
    ['Esc', 'Clear search, selection, menus and dialogs'],
    ['?', 'Show this help'],
    ['Ctrl/Cmd + Shift + K', 'Open TabVault (set at chrome://extensions/shortcuts)'],
    ['Alt + Shift + S', 'Stash the current tab'],
    ['Alt + Shift + P', 'Panic: suspend everything except the active tabs'],
    ['Alt + Shift + G', 'Group this window\'s tabs'],
  ];
  return [section('Keyboard shortcuts'), el('dl', { className: 'help' }, ...rows.flatMap(([k, v]) => [el('dt', {}, el('kbd', { textContent: k })), el('dd', { textContent: v })]))];
}

// ---------- command palette ----------
interface Command { title: string; hint: string; glyph: IconName; run: () => Promise<string | void> }

const goTo = (v: View) => async () => { setView(v); };

const COMMANDS: Command[] = [
  ...(hasGroups ? [
    { title: 'Group tabs', hint: 'Group this window by your rules, category or site', glyph: 'group' as const, run: runGroup },
    { title: 'Ungroup all tabs', hint: 'Remove every tab group in this window', glyph: 'ungroup' as const, run: runUngroup },
  ] : []),
  { title: 'Suspend idle tabs', hint: 'Suspend all background tabs now', glyph: 'moon', run: runSuspendIdle },
  { title: 'Panic: suspend all except active', hint: 'Free memory fast (Alt+Shift+P)', glyph: 'zap', run: runPanic },
  { title: 'Close duplicate tabs', hint: 'Keep one copy of each page per window', glyph: 'copy', run: runCloseDuplicates },
  { title: 'Sort tabs by title', hint: 'Pinned tabs and groups keep their place', glyph: 'sort', run: runSort('title') },
  { title: 'Sort tabs by site', hint: 'Group tabs from the same site together', glyph: 'sort', run: runSort('site') },
  { title: 'Sort tabs by recent use', hint: 'Most recently used first', glyph: 'clock', run: runSort('recent') },
  { title: 'Merge all windows', hint: 'Move every tab into this window', glyph: 'windows', run: runMerge },
  { title: 'Stash this tab', hint: 'Save it for later and close it (Alt+Shift+S)', glyph: 'stash', run: runStashActive },
  { title: 'Save window as session', hint: 'Snapshot this window', glyph: 'save', run: runSaveSession },
  { title: 'Never suspend this site', hint: 'Add the current site to the safe list', glyph: 'shield', run: runWhitelist },
  { title: 'Back up now', hint: 'Download a backup file to your Downloads/TabVault folder', glyph: 'save', run: async () => `Saved ${await backupNow()}` },
  { title: 'Toggle dark / light theme', hint: 'Switch the look of TabVault', glyph: 'moon', run: toggleTheme },
  { title: 'Open settings', hint: 'Suspend rules, grouping, backups, theme', glyph: 'gear', run: async () => { await chrome.runtime.openOptionsPage(); } },
  { title: 'Go to Tabs', hint: 'Alt+1', glyph: 'globe', run: goTo('tabs') },
  { title: 'Go to Stash', hint: 'Alt+2', glyph: 'stash', run: goTo('stash') },
  { title: 'Go to Workspaces', hint: 'Alt+3', glyph: 'group', run: goTo('workspaces') },
  { title: 'Go to Sessions', hint: 'Alt+4', glyph: 'save', run: goTo('sessions') },
  { title: 'Go to Recently closed', hint: 'Alt+5', glyph: 'undo', run: goTo('closed') },
  { title: 'Go to Insights', hint: 'Alt+6', glyph: 'chart', run: goTo('insights') },
  { title: 'Keyboard shortcuts', hint: 'Show every shortcut', glyph: 'help', run: goTo('help') },
];

function renderCommands(query: string): HTMLElement[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = COMMANDS.filter((c) => words.every((w) => `${c.title} ${c.hint}`.toLowerCase().includes(w)));
  const rows = hits.map((c) =>
    item({
      title: c.title, sub: c.hint, glyph: c.glyph,
      onClick: async () => {
        q.value = '';
        try {
          const msg = await c.run();
          if (msg) flash(msg);
        } catch (e) {
          flash(e instanceof Error ? e.message : 'That did not work.');
        }
        selected = 0;
        await render();
      },
    }),
  );
  return [section(`Commands (${hits.length})`), rows.length ? list(...rows) : empty('No matching command.')];
}

async function renderSearch(query: string): Promise<HTMLElement[]> {
  const [tabs, sessions, wss, stash, notes] = await Promise.all([chrome.tabs.query({}), listSessions(), listWorkspaces(), listStash(), getNotes()]);
  const docs: SearchDoc[] = [];
  const open = new Map<string, chrome.tabs.Tab>();
  const withNote = (url: string) => {
    const n = notes.get(noteKey(url));
    return n ? { note: n.note, tags: n.tags.join(' ') } : {};
  };
  for (const t of tabs) {
    if (t.id !== undefined && t.url) {
      docs.push({ id: `tab:${t.id}`, title: t.title ?? t.url, url: t.url, source: 'open', ...withNote(t.url) });
      open.set(`tab:${t.id}`, t);
    }
  }
  for (const s of sessions) s.tabs.forEach((t, i) => docs.push({ id: `saved:${s.id}:${i}`, title: t.title, url: t.url, source: 'saved', sessionName: s.name, ...withNote(t.url) }));
  for (const w of wss) w.tabs.forEach((t, i) => docs.push({ id: `ws:${w.id}:${i}`, title: t.title, url: t.url, source: 'saved', sessionName: `Workspace: ${w.name}`, ...withNote(t.url) }));
  for (const s of stash) docs.push({ id: `stash:${s.id}`, title: s.title, url: s.url, source: 'saved', sessionName: 'Stash', ...withNote(s.url) });
  const hits = search(createIndex(docs), query).slice(0, 100);
  const rows = hits.map((d) =>
    item({
      title: d.title,
      sub: d.source === 'saved' ? `${d.sessionName} · ${d.url}` : d.url,
      icon: open.get(d.id)?.favIconUrl,
      tooltip: d.note || undefined,
      pills: [
        { text: d.source === 'open' ? 'open' : 'saved', kind: d.source === 'open' ? 'accent' : undefined },
        ...(d.tags ? d.tags.split(' ').slice(0, 2).map((t) => ({ text: `#${t}`, kind: 'tag' as const })) : []),
      ],
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
  const [stats, tabs, sessions, wss, closed, stash] = await Promise.all([
    getStats(), chrome.tabs.query({}), listSessions(), listWorkspaces(), listClosed().catch(() => []), listStash(),
  ]);
  const now = tabs.filter((t) => t.discarded).length;
  statsEl.textContent = `${now} suspended now (≈${estimateMb(now)} MB freed, estimate) · ${stats.suspendedTotal} suspended all-time`;
  const counts: Partial<Record<View, number>> = { tabs: tabs.length, stash: stash.length, workspaces: wss.length, sessions: sessions.length, closed: closed.length };
  for (const v of NAV) {
    const c = nav.querySelector(`[data-count=${v}]`);
    if (c) c.textContent = counts[v] ? String(counts[v]) : '';
  }
}

// ---------- look: theme and density ----------
function applyLook(theme: string, density: string): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.density = density;
}

// Remember where the user was (storage.session is per browser run and never leaves the device).
const UI_KEY = 'popupUi';
async function loadUi(): Promise<void> {
  try {
    const saved = (await chrome.storage.session.get(UI_KEY))[UI_KEY] as { view?: View; filter?: Filter } | undefined;
    if (saved?.view && NAV.includes(saved.view)) view = saved.view;
    if (saved?.filter && FILTERS.some((f) => f.id === saved.filter)) filter = saved.filter;
  } catch { /* storage unavailable: start on defaults */ }
  const s = await getSettings();
  applyLook(s.theme, s.density);
  syncNav();
}
const saveUi = () => { if (view !== 'help') void chrome.storage.session.set({ [UI_KEY]: { view, filter } }).catch(() => undefined); };
const syncNav = () => nav.querySelectorAll('button').forEach((n) => n.setAttribute('aria-selected', String(n.dataset.view === view)));

function setView(v: View): void {
  view = v;
  q.value = '';
  selected = 0;
  syncNav();
  void render();
}

let renderToken = 0;
async function render(): Promise<void> {
  const token = ++renderToken;
  actions = [];
  const text = q.value.trimStart();
  const nodes = text.startsWith('>')
    ? renderCommands(text.slice(1).trim())
    : text.trim()
      ? await renderSearch(text.trim())
      : view === 'tabs' ? await renderTabs()
      : view === 'stash' ? await renderStash()
      : view === 'workspaces' ? await renderWorkspaces()
      : view === 'sessions' ? await renderSessions()
      : view === 'closed' ? await renderClosed()
      : view === 'insights' ? await renderInsights()
      : renderHelp();
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
  if (b) setView(b.dataset.view as View);
});
q.addEventListener('input', () => { selected = 0; void render(); });
q.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { selected = Math.min(selected + 1, actions.length - 1); highlight(); e.preventDefault(); }
  else if (e.key === 'ArrowUp') { selected = Math.max(selected - 1, 0); highlight(); e.preventDefault(); }
  else if (e.key === 'Enter') void actions[selected]?.();
  else if (e.key === 'Escape') {
    if (q.value) q.value = ''; else if (picked.size) picked.clear(); else if (view === 'help') { setView('tabs'); return; }
    void render();
  }
});

function openPalette(): void {
  if (!q.value.startsWith('>')) q.value = '>';
  q.focus();
  selected = 0;
  void render();
}

document.addEventListener('keydown', (e) => {
  const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); }
  else if (e.altKey && /^[1-6]$/.test(e.key)) { e.preventDefault(); setView(NAV[Number(e.key) - 1]!); }
  else if (!typing && e.key === '/') { e.preventDefault(); q.focus(); }
  else if (!typing && e.key === '?') { e.preventDefault(); setView('help'); }
});

document.getElementById('brand')!.append(icon('logo'));
document.getElementById('search-icon')!.append(icon('search'));
const paletteBtn = document.getElementById('palette')!;
paletteBtn.append(icon('cmd'));
paletteBtn.addEventListener('click', openPalette);
const gear = document.getElementById('gear')!;
gear.append(icon('gear'));
gear.addEventListener('click', () => void chrome.runtime.openOptionsPage());

let timer: ReturnType<typeof setTimeout> | undefined;
// Only the tab list and search results depend on tab events; the other views must not be rebuilt under the user.
const rerenderSoon = () => {
  if (!q.value.trim() && view !== 'tabs' && view !== 'insights') return;
  if (document.querySelector('.overlay, .menu')) return; // never rebuild under an open dialog or menu
  clearTimeout(timer);
  timer = setTimeout(() => void render(), 250);
};
chrome.tabs.onUpdated.addListener(rerenderSoon);
chrome.tabs.onRemoved.addListener(rerenderSoon);
chrome.tabs.onCreated.addListener(rerenderSoon);

void loadUi().then(render);
