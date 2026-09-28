import Dexie, { type Table } from 'dexie';
import type {
  Profile, ChatMessage, Completion, JournalEntry, Settings, SessionPlan, QueuedSession, RoutineItem,
} from './types';

/**
 * All user data lives here, on device. There is no server in v1.
 * Export/import (src/lib/backup.ts) is the escape hatch so nothing is locked in.
 */
class HypnotizeDB extends Dexie {
  profile!: Table<Profile, string>;
  chat!: Table<ChatMessage, string>;
  completions!: Table<Completion, string>;
  journal!: Table<JournalEntry, string>;
  settings!: Table<Settings, string>;
  sessions!: Table<SessionPlan, string>;
  queue!: Table<QueuedSession, string>;

  constructor() {
    super('hypnotize');
    this.version(1).stores({
      profile: 'id',
      chat: 'id, conversation_id, created_at',
      completions: 'id, date, ref, kind, started_at',
      journal: 'id, date, created_at',
      settings: 'id',
      sessions: 'id, session_type, created_at',
      queue: 'id, slot, created_at',
    });
    // v2: enable TTS by default for users who had it stored as false from v1.
    this.version(2).stores({}).upgrade(async (tx) => {
      const s = await tx.table('settings').get('settings');
      if (s && s.tts_enabled === false) {
        await tx.table('settings').update('settings', { tts_enabled: true });
      }
    });
    // v3: strip checkin/practice/prompt items from the routine; replace with sessions-only defaults.
    this.version(3).stores({}).upgrade(async (tx) => {
      const s = await tx.table('settings').get('settings');
      if (!s) return;
      const sessionItems = (s.routine as RoutineItem[]).filter((r) => r.kind === 'session');
      if (sessionItems.length < s.routine.length) {
        await tx.table('settings').update('settings', { routine: DEFAULT_ROUTINE });
      }
    });
  }
}

export const db = new HypnotizeDB();

export const today = (d = new Date()) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const uid = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const DEFAULT_ROUTINE: RoutineItem[] = [
  { id: 'ri-morning', slot: 'morning', kind: 'session', title: 'Morning session',       ref: 'morning-rehearsal', minutes: 8,  enabled: true },
  { id: 'ri-midday',  slot: 'midday',  kind: 'session', title: 'Midday re-centre',      ref: 'focus-flow',        minutes: 5,  enabled: true },
  { id: 'ri-sleep',   slot: 'evening', kind: 'session', title: 'Pre-sleep session',     ref: 'pre-sleep',         minutes: 10, enabled: true },
];

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  tts_enabled: true,
  tts_voice_uri: null,
  tts_rate: 0.78,
  pace: 'slow',
  ambient: 'off',
  ambient_volume: 0.25,
  reminders_enabled: false,
  quiet_start: '22:30',
  quiet_end: '07:00',
  max_reminders_per_day: 5,
  onboarded: false,
  safety_ack: false,
  ai_api_key: '',
  openai_api_key: '',
  openai_voice: 'onyx',
  voice_engine: 'browser',
  reminders: [
    { id: 'r-morning', slot: 'morning', time: '07:00', text: 'Session first. Email can wait.', enabled: true },
    { id: 'r-mid1', slot: 'midday', time: '11:30', text: 'Language check.', enabled: true },
    { id: 'r-mid2', slot: 'midday', time: '14:30', text: 'Short check-in?', enabled: true },
    { id: 'r-mid3', slot: 'midday', time: '17:00', text: 'One ad filter.', enabled: true },
    { id: 'r-evening', slot: 'evening', time: '22:00', text: 'Wind down.', enabled: true },
  ],
  routine: DEFAULT_ROUTINE,
};

/** Read-only: safe to call from a liveQuery. Missing records fall back to defaults. */
export async function getSettings(): Promise<Settings> {
  const s = await db.settings.get('settings');
  return s ? { ...DEFAULT_SETTINGS, ...s, id: 'settings' } : DEFAULT_SETTINGS;
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch, id: 'settings' as const };
  if (next.max_reminders_per_day > 8) next.max_reminders_per_day = 8;  // hard cap
  await db.settings.put(next);
  return next;
}

/** Read-only: safe to call from a liveQuery. */
export async function getProfile(): Promise<Profile> {
  return (await db.profile.get('me')) ?? { id: 'me', facts: [], updated_at: Date.now() };
}

/** Writes the default records on first run. Call once at startup, never inside a liveQuery. */
export async function ensureSeeded(): Promise<void> {
  if (!(await db.settings.get('settings'))) await db.settings.put(DEFAULT_SETTINGS);
  if (!(await db.profile.get('me'))) await db.profile.put({ id: 'me', facts: [], updated_at: Date.now() });
}
