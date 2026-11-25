import MiniSearch from 'minisearch';

export interface SearchDoc {
  id: string; // "tab:<id>" or "saved:<sessionId>:<index>"
  title: string;
  url: string;
  source: 'open' | 'saved';
  sessionName?: string;
}

export function createIndex(docs: SearchDoc[]): MiniSearch<SearchDoc> {
  const index = new MiniSearch<SearchDoc>({
    fields: ['title', 'url', 'sessionName'],
    storeFields: ['title', 'url', 'source', 'sessionName'],
    searchOptions: { prefix: true, fuzzy: 0.3, boost: { title: 2 } },
  });
  index.addAll(docs);
  return index;
}

export function search(index: MiniSearch<SearchDoc>, query: string): SearchDoc[] {
  const q = query.trim();
  if (!q) return [];
  return index.search(q).map((r) => ({
    id: String(r.id),
    title: r.title as string,
    url: r.url as string,
    source: r.source as 'open' | 'saved',
    sessionName: r.sessionName as string | undefined,
  }));
}
