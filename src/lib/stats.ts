import type { Completion } from '../types';
import { today } from '../db';

const dayBefore = (date: string) => {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return today(d);
};

/** Consecutive days ending today (or yesterday, so a day in progress doesn't read as a break). */
export function streak(completions: Completion[]): number {
  const days = new Set(completions.map((c) => c.date));
  let cursor = today();
  if (!days.has(cursor)) {
    cursor = dayBefore(cursor);
    if (!days.has(cursor)) return 0;
  }
  let n = 0;
  while (days.has(cursor)) { n++; cursor = dayBefore(cursor); }
  return n;
}

export function totalMinutes(completions: Completion[]): number {
  return Math.round(completions.reduce((n, c) => n + c.seconds, 0) / 60);
}

export function minutesThisWeek(completions: Completion[]): number {
  const cutoff = Date.now() - 7 * 86_400_000;
  return Math.round(
    completions.filter((c) => c.started_at >= cutoff).reduce((n, c) => n + c.seconds, 0) / 60,
  );
}

/** Mood after minus mood before, averaged over sessions that rated both. Null when too few. */
export function moodShift(completions: Completion[]): number | null {
  const rated = completions.filter((c) => c.mood_before != null && c.mood_after != null);
  if (rated.length < 3) return null;
  const sum = rated.reduce((n, c) => n + (c.mood_after! - c.mood_before!), 0);
  return Math.round((sum / rated.length) * 10) / 10;
}

/** Last 14 days of average post-session mood, for a sparkline. null = no data that day. */
export function moodTrend(completions: Completion[], days = 14): (number | null)[] {
  const out: (number | null)[] = [];
  let cursor = today();
  const byDay = new Map<string, number[]>();
  for (const c of completions) {
    if (c.mood_after == null) continue;
    byDay.set(c.date, [...(byDay.get(c.date) ?? []), c.mood_after]);
  }
  for (let i = 0; i < days; i++) {
    const vals = byDay.get(cursor);
    out.unshift(vals?.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null);
    cursor = dayBefore(cursor);
  }
  return out;
}
