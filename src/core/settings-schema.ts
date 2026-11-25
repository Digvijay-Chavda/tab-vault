import { DEFAULT_SETTINGS, type Settings } from './types';

export const MAX_IDLE_MINUTES = 7 * 24 * 60;

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
  };
}
