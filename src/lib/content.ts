import { ENTRIES, SOURCES, TEACHER_VIEWS, CONTENT_STATS } from '../content/generated';
import type { Entry, EntryType, SessionType, Stage } from '../types';

export { ENTRIES, SOURCES, TEACHER_VIEWS, CONTENT_STATS };

export const byKey = new Map<string, Entry>(ENTRIES.map((e) => [e.key, e]));
export const entry = (key: string) => byKey.get(key);
export const sourceOf = (id: string) => SOURCES.find((s) => s.id === id);

export const ofType = (t: EntryType) => ENTRIES.filter((e) => e.type === t);

export const scriptsFor = (st: SessionType, stage: Stage) =>
  ENTRIES.filter((e) => e.type === 'script' && e.stage === stage && e.session_types?.includes(st));

export const allTags = [...new Set(ENTRIES.flatMap((e) => e.tags))].sort();

export const SESSION_TYPE_META: Record<SessionType, {
  label: string; blurb: string; tags: string[]; defaultMinutes: number; slot: 'morning' | 'midday' | 'evening' | 'any';
}> = {
  'morning-rehearsal': { label: 'Morning induction + day rehearsal', blurb: 'Open the day in trance and run it through once before it runs you.', tags: ['morning', 'rehearsal', 'focus'], defaultMinutes: 8, slot: 'morning' },
  'act-as-if': { label: 'Act as if', blurb: 'Step into the version of you who already does this, and let the body learn the shape.', tags: ['identity', 'act-as-if', 'confidence'], defaultMinutes: 8, slot: 'any' },
  'fear-screen': { label: 'Fear shrinking screen', blurb: 'Put the fear on a screen, then push it back until it is information rather than threat.', tags: ['fear', 'screen-technique'], defaultMinutes: 9, slot: 'any' },
  'ftl-deletion': { label: 'Fear / trauma / limiting belief', blurb: 'Name the belief in plain words, then hold its opposite long enough for the objection to pass.', tags: ['ftl', 'identity'], defaultMinutes: 12, slot: 'any' },
  'pre-sleep': { label: 'Pre-sleep programming', blurb: 'Ends in sleep — no count back up. Start this one in bed.', tags: ['sleep', 'evening'], defaultMinutes: 10, slot: 'evening' },
  'focus-flow': { label: 'Focus / flow', blurb: 'Narrow the beam to one task before you start it.', tags: ['focus', 'attention'], defaultMinutes: 5, slot: 'any' },
  'goal-clarity': { label: 'Goal clarity', blurb: 'Make the thing you say you want concrete enough to recognise.', tags: ['clarity'], defaultMinutes: 9, slot: 'any' },
  'habit-craving': { label: 'Habit / craving reprogramming', blurb: 'Watch the wave rise and come down without acting on it.', tags: ['craving', 'attention'], defaultMinutes: 8, slot: 'any' },
};

export const SESSION_TYPES = Object.keys(SESSION_TYPE_META) as SessionType[];
