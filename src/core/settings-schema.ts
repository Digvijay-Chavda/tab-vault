import { DEFAULT_SETTINGS, type GroupRule, type Settings } from './types';

export const MAX_IDLE_MINUTES = 7 * 24 * 60;
export const MAX_GROUP_RULES = 100;

/** Parses lines like "github.com = Work" into rules. Invalid lines are skipped. */
export function parseGroupRules(text: string): GroupRule[] {
  return sanitizeGroupRules(
    text.split('\n').map((line) => {
      const i = line.indexOf('=');
      return i < 0 ? null : { host: line.slice(0, i), name: line.slice(i + 1) };
    }),
  );
}

export function formatGroupRules(rules: GroupRule[]): string {
  return rules.map((r) => `${r.host} = ${r.name}`).join('\n');
}

export function sanitizeGroupRules(raw: unknown): GroupRule[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: GroupRule[] = [];
  for (const r of raw) {
    const host = normalizeHost(typeof (r as GroupRule)?.host === 'string' ? (r as GroupRule).host : '');
    const name = typeof (r as GroupRule)?.name === 'string' ? (r as GroupRule).name.trim().slice(0, 30) : '';
    if (!host || !name || seen.has(host)) continue;
    seen.add(host);
    out.push({ host, name });
    if (out.length >= MAX_GROUP_RULES) break;
  }
  return out;
}

/** Accepts "example.com", "https://Example.com/path", "*.example.com" and returns "example.com". */
export function normalizeHost(input: string): string {
  let v = input.trim().toLowerCase();
  if (!v) return '';
  v = v.replace(/^[a-z][a-z0-9+.-]*:\/\//, ''); // protocol
  v = v.replace(/^\*\./, '').replace(/^www\./, '');
  v = v.split(/[/?#]/)[0] ?? '';
  v = v.replace(/:\d+$/, ''); // port
  const valid = (/^[a-z0-9.-]+$/.test(v) && v.includes('.')) || v === 'localhost';
  return valid ? v : '';
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v);
  return v !== null && v !== '' && Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
}

/** Coerces anything (storage, imports, form input) into a valid Settings object. */
export function sanitizeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const idle = Number(r.idleMinutes);
  const whitelist = Array.isArray(r.whitelist)
    ? [...new Set(r.whitelist.filter((x): x is string => typeof x === 'string').map(normalizeHost).filter(Boolean))]
    : DEFAULT_SETTINGS.whitelist;
  return {
    idleMinutes: Number.isFinite(idle) ? Math.min(MAX_IDLE_MINUTES, Math.max(0, Math.round(idle))) : DEFAULT_SETTINGS.idleMinutes,
    suspendPinned: typeof r.suspendPinned === 'boolean' ? r.suspendPinned : DEFAULT_SETTINGS.suspendPinned,
    suspendAudible: typeof r.suspendAudible === 'boolean' ? r.suspendAudible : DEFAULT_SETTINGS.suspendAudible,
    whitelist,
    autoSnapshots: typeof r.autoSnapshots === 'boolean' ? r.autoSnapshots : DEFAULT_SETTINGS.autoSnapshots,
    autoGroup: typeof r.autoGroup === 'boolean' ? r.autoGroup : DEFAULT_SETTINGS.autoGroup,
    minGroupSize: Number.isFinite(Number(r.minGroupSize))
      ? Math.min(10, Math.max(2, Math.round(Number(r.minGroupSize))))
      : DEFAULT_SETTINGS.minGroupSize,
    warnDuplicates: typeof r.warnDuplicates === 'boolean' ? r.warnDuplicates : DEFAULT_SETTINGS.warnDuplicates,
    dupeAction: r.dupeAction === 'switch' ? 'switch' : DEFAULT_SETTINGS.dupeAction,
    archiveDays: clampInt(r.archiveDays, 0, 365, DEFAULT_SETTINGS.archiveDays),
    backupDays: clampInt(r.backupDays, 0, 90, DEFAULT_SETTINGS.backupDays),
    theme: r.theme === 'light' || r.theme === 'dark' ? r.theme : DEFAULT_SETTINGS.theme,
    density: r.density === 'compact' ? 'compact' : DEFAULT_SETTINGS.density,
    groupRules: sanitizeGroupRules(r.groupRules),
  };
}
