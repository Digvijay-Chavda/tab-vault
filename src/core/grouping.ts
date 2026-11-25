import type { Settings, TabLike } from './types';
import { hostOf } from './rules';

export type GroupColor = 'grey' | 'blue' | 'red' | 'yellow' | 'green' | 'pink' | 'purple' | 'cyan' | 'orange';
export const GROUP_COLORS: GroupColor[] = ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange', 'grey'];

export interface GroupPlan {
  name: string;
  color: GroupColor;
  tabIds: number[];
  /** Set when a group with this title already exists in the window: join it instead of creating one. */
  existingGroupId?: number;
}

export interface ExistingGroup {
  id: number;
  title?: string;
}

/** Common two-level public suffixes; a full Public Suffix List would be overkill for naming groups. */
const SECOND_LEVEL = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'com.au', 'net.au', 'org.au', 'edu.au', 'co.nz', 'org.nz',
  'co.in', 'co.jp', 'co.kr', 'com.br', 'com.cn', 'com.hk', 'com.sg', 'com.tr', 'com.mx', 'co.za',
]);

/** "mail.google.com" -> "google.com", "news.bbc.co.uk" -> "bbc.co.uk". IPs and localhost are kept whole. */
export function registrableDomain(host: string): string {
  if (host === 'localhost' || host.includes(':') || /^\d+(\.\d+){3}$/.test(host)) return host;
  const labels = host.split('.');
  if (labels.length <= 2) return host;
  const last2 = labels.slice(-2).join('.');
  return labels.slice(SECOND_LEVEL.has(last2) ? -3 : -2).join('.');
}

/** Hostname (subdomains included) -> category. The longest matching entry wins, so mail.google.com beats google.com. */
const CATEGORY_HOSTS: Record<string, string> = {
  'github.com': 'Dev', 'gitlab.com': 'Dev', 'bitbucket.org': 'Dev', 'stackoverflow.com': 'Dev', 'stackexchange.com': 'Dev',
  'npmjs.com': 'Dev', 'developer.mozilla.org': 'Dev', 'localhost': 'Dev', 'pypi.org': 'Dev', 'crates.io': 'Dev',
  'docs.google.com': 'Docs', 'drive.google.com': 'Docs', 'notion.so': 'Docs', 'atlassian.net': 'Docs',
  'office.com': 'Docs', 'sharepoint.com': 'Docs', 'dropbox.com': 'Docs', 'figma.com': 'Design',
  'mail.google.com': 'Mail', 'outlook.live.com': 'Mail', 'outlook.office.com': 'Mail', 'proton.me': 'Mail',
  'twitter.com': 'Social', 'x.com': 'Social', 'facebook.com': 'Social', 'instagram.com': 'Social',
  'linkedin.com': 'Social', 'reddit.com': 'Social', 'tiktok.com': 'Social', 'discord.com': 'Social', 'slack.com': 'Chat',
  'youtube.com': 'Video', 'netflix.com': 'Video', 'twitch.tv': 'Video', 'vimeo.com': 'Video', 'spotify.com': 'Music',
  'ebay.com': 'Shopping', 'etsy.com': 'Shopping', 'aliexpress.com': 'Shopping', 'walmart.com': 'Shopping',
  'bbc.com': 'News', 'bbc.co.uk': 'News', 'nytimes.com': 'News', 'theguardian.com': 'News', 'cnn.com': 'News',
  'news.ycombinator.com': 'News', 'chatgpt.com': 'AI', 'claude.ai': 'AI', 'gemini.google.com': 'AI', 'perplexity.ai': 'AI',
  'wikipedia.org': 'Reference', 'maps.google.com': 'Maps',
};
/** Brands with many country domains (amazon.com, amazon.co.uk, ...) matched on the registrable name. */
const CATEGORY_LABELS: Record<string, string> = { amazon: 'Shopping' };

export function categoryFor(host: string): string | null {
  let best: string | null = null;
  let bestLen = -1;
  for (const [h, cat] of Object.entries(CATEGORY_HOSTS)) {
    if ((host === h || host.endsWith('.' + h)) && h.length > bestLen) {
      best = cat;
      bestLen = h.length;
    }
  }
  if (best) return best;
  const label = registrableDomain(host).split('.')[0] ?? '';
  return CATEGORY_LABELS[label] ?? null;
}

/** User rules win; longest matching rule host wins. Then built-in category, then the site itself. */
export function groupNameFor(url: string | undefined, settings: Pick<Settings, 'groupRules'>): string | null {
  const host = hostOf(url);
  if (!host || !/^https?:/.test(url ?? '')) return null;
  let rule: { host: string; name: string } | undefined;
  for (const r of settings.groupRules) {
    if ((host === r.host || host.endsWith('.' + r.host)) && (!rule || r.host.length > rule.host.length)) rule = r;
  }
  return rule?.name ?? categoryFor(host) ?? registrableDomain(host);
}

/** Same name -> same color, so a group looks the same every time. */
export function colorFor(name: string): GroupColor {
  let h = 0;
  for (const ch of name.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return GROUP_COLORS[h % GROUP_COLORS.length]!;
}

/**
 * Pure planner: which ungrouped tabs go into which group.
 * - Only touches unpinned http(s) tabs that are not already in a group (your manual groups are never disturbed).
 * - Joins an existing group with the same title; otherwise creates one when at least `minGroupSize` tabs match.
 */
export function planGroups(
  tabs: TabLike[],
  existing: ExistingGroup[],
  settings: Pick<Settings, 'groupRules' | 'minGroupSize'>,
): GroupPlan[] {
  const buckets = new Map<string, { name: string; ids: number[] }>();
  for (const t of tabs) {
    if (t.id === undefined || t.pinned) continue;
    if (t.groupId !== undefined && t.groupId !== -1) continue;
    const name = groupNameFor(t.url, settings);
    if (!name) continue;
    const key = name.toLowerCase();
    const b = buckets.get(key);
    if (b) b.ids.push(t.id);
    else buckets.set(key, { name, ids: [t.id] });
  }
  const plans: GroupPlan[] = [];
  for (const [key, b] of buckets) {
    const match = existing.find((g) => (g.title ?? '').trim().toLowerCase() === key);
    if (match) plans.push({ name: b.name, color: colorFor(b.name), tabIds: b.ids, existingGroupId: match.id });
    else if (b.ids.length >= settings.minGroupSize) plans.push({ name: b.name, color: colorFor(b.name), tabIds: b.ids });
  }
  return plans;
}
