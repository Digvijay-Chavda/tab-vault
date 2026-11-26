import MiniSearch from 'minisearch';

export interface SearchDoc {
  id: string; // "tab:<id>" or "saved:<sessionId>:<index>"
  title: string;
  url: string;
  source: 'open' | 'saved';
  sessionName?: string;
  /** Your note and tags for this address, so they are searchable. */
  note?: string;
  tags?: string;
}

export function createIndex(docs: SearchDoc[]): MiniSearch<SearchDoc> {
  const index = new MiniSearch<SearchDoc>({
    fields: ['title', 'url', 'sessionName', 'note', 'tags'],
    storeFields: ['title', 'url', 'source', 'sessionName', 'note', 'tags'],
    searchOptions: { prefix: true, fuzzy: 0.3, boost: { title: 2 } },
  });
  index.addAll(docs);
  return index;
}

export function search(index: MiniSearch<SearchDoc>, query: string): SearchDoc[] {
  const q = query.trim().replace(/(^|\s)#/g, '$1'); // "#work" finds the tag work
  if (!q) return [];
  return index.search(q).map((r) => ({
    id: String(r.id),
    title: r.title as string,
    url: r.url as string,
    source: r.source as 'open' | 'saved',
    sessionName: r.sessionName as string | undefined,
    note: r.note as string | undefined,
    tags: r.tags as string | undefined,
  }));
}
