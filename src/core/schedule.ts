export interface Schedule {
  workspaceId: number;
  /** 24h local time, "HH:MM". */
  time: string;
  /** 0 = Sunday ... 6 = Saturday. */
  days: number[];
}

export const WEEKDAYS = [1, 2, 3, 4, 5];
export const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "9:5", "09:05", "9.05" -> "09:05"; invalid -> null. */
export function parseTime(text: string): string | null {
  const m = /^\s*(\d{1,2})\s*[:.]\s*(\d{1,2})\s*$/.exec(text);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function describeDays(days: number[]): string {
  const d = [...new Set(days)].sort();
  if (d.length === 7) return 'every day';
  if (d.join() === WEEKDAYS.join()) return 'weekdays';
  return d.map((x) => DAY_NAMES[x]).join(', ');
}

export function sanitizeSchedules(raw: unknown): Schedule[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<number>();
  const out: Schedule[] = [];
  for (const r of raw as Array<Partial<Schedule>>) {
    const time = typeof r?.time === 'string' ? parseTime(r.time) : null;
    const days = Array.isArray(r?.days) ? [...new Set(r.days.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))] : [];
    if (typeof r?.workspaceId !== 'number' || !time || days.length === 0 || seen.has(r.workspaceId)) continue;
    seen.add(r.workspaceId);
    out.push({ workspaceId: r.workspaceId, time, days });
  }
  return out;
}

const localDay = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

/**
 * Schedules that should fire now: today is one of the days, the time has passed (within a 10 minute grace, so a
 * sleeping laptop or a late alarm still opens it), and it has not already fired today.
 * `lastFired` maps workspaceId -> local day string.
 */
export function dueSchedules(schedules: Schedule[], lastFired: Record<string, string>, now: Date): Schedule[] {
  const today = localDay(now);
  return schedules.filter((s) => {
    if (!s.days.includes(now.getDay()) || lastFired[String(s.workspaceId)] === today) return false;
    const [h, m] = s.time.split(':').map(Number) as [number, number];
    const at = new Date(now);
    at.setHours(h, m, 0, 0);
    const late = now.getTime() - at.getTime();
    return late >= 0 && late <= 10 * 60_000;
  });
}

export const markFired = (lastFired: Record<string, string>, id: number, now: Date) => ({ ...lastFired, [String(id)]: localDay(now) });

const SCHEDULES_KEY = 'schedules';
const FIRED_KEY = 'schedulesFired';

export async function getSchedules(): Promise<Schedule[]> {
  return sanitizeSchedules((await chrome.storage.local.get(SCHEDULES_KEY))[SCHEDULES_KEY]);
}

export async function setSchedule(s: Schedule | { workspaceId: number; remove: true }): Promise<void> {
  const rest = (await getSchedules()).filter((x) => x.workspaceId !== s.workspaceId);
  await chrome.storage.local.set({ [SCHEDULES_KEY]: 'remove' in s ? rest : [...rest, s] });
}

export async function getFired(): Promise<Record<string, string>> {
  return ((await chrome.storage.local.get(FIRED_KEY))[FIRED_KEY] as Record<string, string> | undefined) ?? {};
}

export const saveFired = (m: Record<string, string>) => chrome.storage.local.set({ [FIRED_KEY]: m });
