import { createIndex, search, type SearchDoc } from '../../core/search';
import { deleteSession, listSessions, restoreSession, saveCurrentWindow } from '../../core/sessions';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const q = $<HTMLInputElement>('q');
const results = $<HTMLUListElement>('results');
const sessionsEl = $<HTMLUListElement>('sessions');
const resultsTitle = $('results-title');

function row(title: string, sub: string, onClick: () => void, extra?: HTMLElement, cls = ''): HTMLLIElement {
  const li = document.createElement('li');
  li.className = cls;
  const t = document.createElement('div');
  t.className = 't';
  const b = document.createElement('b');
  b.textContent = title; // textContent only: titles come from untrusted pages
  const s = document.createElement('small');
  s.textContent = sub;
  t.append(b, s);
  li.append(t);
  if (extra) li.append(extra);
  li.addEventListener('click', onClick);
  return li;
}

async function buildDocs(): Promise<SearchDoc[]> {
  const [tabs, sessions] = await Promise.all([chrome.tabs.query({}), listSessions()]);
  const docs: SearchDoc[] = [];
  for (const t of tabs) {
    if (t.id !== undefined && t.url) docs.push({ id: `tab:${t.id}`, title: t.title ?? t.url, url: t.url, source: 'open' });
  }
  for (const s of sessions) {
    s.tabs.forEach((t, i) =>
      docs.push({ id: `saved:${s.id}:${i}`, title: t.title, url: t.url, source: 'saved', sessionName: s.name }),
    );
  }
  return docs;
}

async function renderResults(): Promise<void> {
  const docs = await buildDocs();
  const query = q.value;
  const hits = query.trim() ? search(createIndex(docs), query) : docs.filter((d) => d.source === 'open');
  resultsTitle.textContent = query.trim() ? `Results (${hits.length})` : 'Open tabs';
  results.replaceChildren(
    ...hits.slice(0, 200).map((d) =>
      row(d.title, d.source === 'saved' ? `${d.sessionName} · ${d.url}` : d.url, async () => {
        if (d.id.startsWith('tab:')) {
          const tab = await chrome.tabs.update(Number(d.id.slice(4)), { active: true });
          if (tab?.windowId !== undefined) await chrome.windows.update(tab.windowId, { focused: true });
        } else {
          await chrome.tabs.create({ url: d.url });
        }
      }),
    ),
  );
}

async function renderSessions(): Promise<void> {
  const sessions = await listSessions();
  sessionsEl.replaceChildren(
    ...sessions.map((s) => {
      const del = document.createElement('button');
      del.className = 'x';
      del.textContent = '✕';
      del.title = 'Delete session';
      del.addEventListener('click', async (e) => {
        e.stopPropagation();
        await deleteSession(s.id!);
        await refresh();
      });
      return row(s.name, `${s.tabs.length} tabs · click to restore`, () => void restoreSession(s.id!), del);
    }),
  );
}

async function refresh(): Promise<void> {
  await Promise.all([renderResults(), renderSessions()]);
}

q.addEventListener('input', () => void renderResults());
$('save').addEventListener('click', async () => {
  await saveCurrentWindow();
  await refresh();
});
$('suspend').addEventListener('click', async () => {
  const tabs = await chrome.tabs.query({ active: false, pinned: false, audible: false, discarded: false });
  for (const t of tabs) if (t.id !== undefined) await chrome.tabs.discard(t.id).catch(() => undefined);
  await refresh();
});
chrome.tabs.onUpdated.addListener(() => void renderResults());
chrome.tabs.onRemoved.addListener(() => void renderResults());

void refresh();
