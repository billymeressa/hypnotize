import { db, getSettings } from '../db';
import type { ChatMessage, Completion, JournalEntry, Profile, QueuedSession, SessionPlan, Settings } from '../types';

export interface Backup {
  app: 'hypnotize';
  schema: 1;
  exported_at: string;
  profile: Profile | undefined;
  settings: Settings;
  chat: ChatMessage[];
  completions: Completion[];
  journal: JournalEntry[];
  sessions: SessionPlan[];
  queue: QueuedSession[];
}

export async function exportAll(): Promise<Backup> {
  const [profile, settings, chat, completions, journal, sessions, queue] = await Promise.all([
    db.profile.get('me'), getSettings(), db.chat.toArray(), db.completions.toArray(),
    db.journal.toArray(), db.sessions.toArray(), db.queue.toArray(),
  ]);
  return {
    app: 'hypnotize', schema: 1, exported_at: new Date().toISOString(),
    profile, settings, chat, completions, journal, sessions, queue,
  };
}

export async function downloadExport() {
  const data = await exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `hypnotize-${data.exported_at.slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export type ImportMode = 'merge' | 'replace';

export async function importBackup(raw: string, mode: ImportMode): Promise<{ counts: Record<string, number> }> {
  const data = JSON.parse(raw) as Backup;
  if (data.app !== 'hypnotize') throw new Error('Not a Hypnotize export.');
  if (data.schema !== 1) throw new Error(`Unsupported export schema: ${data.schema}`);

  await db.transaction('rw', [db.profile, db.settings, db.chat, db.completions, db.journal, db.sessions, db.queue], async () => {
    if (mode === 'replace') {
      await Promise.all([db.profile.clear(), db.chat.clear(), db.completions.clear(), db.journal.clear(), db.sessions.clear(), db.queue.clear()]);
    }
    if (data.profile) {
      if (mode === 'replace') await db.profile.put(data.profile);
      else {
        const cur = await db.profile.get('me');
        const facts = [...(cur?.facts ?? [])];
        for (const f of data.profile.facts) if (!facts.some((x) => x.id === f.id)) facts.push(f);
        await db.profile.put({ id: 'me', facts, updated_at: Date.now() });
      }
    }
    if (data.settings) await db.settings.put({ ...data.settings, id: 'settings' });
    await db.chat.bulkPut(data.chat ?? []);
    await db.completions.bulkPut(data.completions ?? []);
    await db.journal.bulkPut(data.journal ?? []);
    await db.sessions.bulkPut(data.sessions ?? []);
    await db.queue.bulkPut(data.queue ?? []);
  });

  return {
    counts: {
      chat: data.chat?.length ?? 0,
      completions: data.completions?.length ?? 0,
      journal: data.journal?.length ?? 0,
      sessions: data.sessions?.length ?? 0,
      facts: data.profile?.facts.length ?? 0,
    },
  };
}

/** Deletes everything on device. Irreversible — callers must confirm first. */
export async function eraseAll() {
  await Promise.all([
    db.profile.clear(), db.chat.clear(), db.completions.clear(),
    db.journal.clear(), db.sessions.clear(), db.queue.clear(), db.settings.clear(),
  ]);
}
