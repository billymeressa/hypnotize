import type { Reminder, Settings } from '../types';

/**
 * Reminders are local notifications only — scheduled while the page/service worker is alive.
 * A PWA cannot wake itself reliably on iOS, so the honest position is: these fire when the app
 * has been opened that day. See README "Going native" for what would change.
 */

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Quiet hours may wrap midnight. */
export function inQuietHours(s: Settings, at = new Date()): boolean {
  const now = at.getHours() * 60 + at.getMinutes();
  const start = toMinutes(s.quiet_start);
  const end = toMinutes(s.quiet_end);
  return start <= end ? now >= start && now < end : now >= start || now < end;
}

export function activeReminders(s: Settings): Reminder[] {
  return s.reminders
    .filter((r) => r.enabled)
    .sort((a, b) => toMinutes(a.time) - toMinutes(b.time))
    .slice(0, Math.min(8, s.max_reminders_per_day));
}

export async function requestPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission !== 'default') return Notification.permission;
  return Notification.requestPermission();
}

let timers: number[] = [];

/** Schedules today's remaining reminders. Cheap to call again after a settings change. */
export function scheduleToday(s: Settings) {
  clearScheduled();
  if (!s.reminders_enabled) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const now = new Date();
  for (const r of activeReminders(s)) {
    const [h, m] = r.time.split(':').map(Number);
    const when = new Date(now);
    when.setHours(h, m, 0, 0);
    const delay = when.getTime() - now.getTime();
    if (delay <= 0) continue;
    if (inQuietHours(s, when)) continue;
    timers.push(
      window.setTimeout(() => {
        // No badge count and no action buttons — a plain line, dismissible, nothing to clear.
        new Notification('Hypnotize', { body: r.text, silent: false, tag: r.id });
      }, delay),
    );
  }
}

export function clearScheduled() {
  for (const t of timers) clearTimeout(t);
  timers = [];
}
