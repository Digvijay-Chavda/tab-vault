import { describe, expect, it } from 'vitest';
import { backupDue } from '../../src/core/backup-schedule';
import { describeDays, dueSchedules, markFired, parseTime, sanitizeSchedules, WEEKDAYS } from '../../src/core/schedule';

describe('parseTime', () => {
  it.each([['9:5', '09:05'], ['09:30', '09:30'], ['9.05', '09:05'], ['24:00', null], ['9:60', null], ['nine', null]])('%s', (i, o) => expect(parseTime(i)).toBe(o));
});

describe('describeDays', () => {
  it('names common patterns', () => {
    expect(describeDays(WEEKDAYS)).toBe('weekdays');
    expect(describeDays([0, 1, 2, 3, 4, 5, 6])).toBe('every day');
    expect(describeDays([3, 1])).toBe('Mon, Wed');
  });
});

describe('dueSchedules', () => {
  const s = [{ workspaceId: 1, time: '09:00', days: WEEKDAYS }];
  const monday = (h: number, m: number) => new Date(2026, 10, 23, h, m); // Mon 23 Nov 2026
  it('fires on time, within the grace window, once a day', () => {
    expect(dueSchedules(s, {}, monday(8, 59))).toEqual([]);
    expect(dueSchedules(s, {}, monday(9, 0))).toHaveLength(1);
    expect(dueSchedules(s, {}, monday(9, 8))).toHaveLength(1);
    expect(dueSchedules(s, {}, monday(9, 11))).toEqual([]);
    expect(dueSchedules(s, markFired({}, 1, monday(9, 0)), monday(9, 1))).toEqual([]);
  });
  it('skips days that are not selected', () => {
    expect(dueSchedules(s, {}, new Date(2026, 10, 22, 9, 0))).toEqual([]); // Sunday
  });
});

describe('sanitizeSchedules', () => {
  it('drops invalid and duplicate entries', () => {
    const out = sanitizeSchedules([
      { workspaceId: 1, time: '9:00', days: [1, 1, 2, 9] }, { workspaceId: 1, time: '10:00', days: [1] },
      { workspaceId: 2, time: 'bad', days: [1] }, { workspaceId: 3, time: '10:00', days: [] }, null,
    ]);
    expect(out).toEqual([{ workspaceId: 1, time: '09:00', days: [1, 2] }]);
  });
});

describe('backupDue', () => {
  const day = 86_400_000;
  it('is due after N days, never when off', () => {
    expect(backupDue(undefined, 7, 1000)).toBe(true);
    expect(backupDue(0, 7, 6 * day)).toBe(false);
    expect(backupDue(0, 7, 7 * day)).toBe(true);
    expect(backupDue(undefined, 0, 1000)).toBe(false);
  });
});
