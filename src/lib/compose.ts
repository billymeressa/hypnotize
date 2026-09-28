import type { Entry, ProfileFact, SessionPlan, SessionStep, SessionType, Stage } from '../types';
import { scriptsFor, SESSION_TYPE_META } from './content';
import { uid } from '../db';

/**
 * The Guide's session generator.
 *
 * v1 composes sessions deterministically from approved `script` entries and the user's Profile.
 * That keeps the app fully offline and means every line delivered is reviewable content, not
 * model output that could invent a suggestion the user never saw. src/lib/coach.ts notes where
 * a hosted model could be substituted later; if one ever is, its output must still pass through
 * `plan.suggestions` and the Preview step before delivery.
 *
 * Structure is fixed by the technique, not by content availability:
 *   open -> deepen(1-2) -> depth_check -> [ftl] -> suggestion(1-2) -> personal suggestions -> return
 */

const STAGE_ORDER: Stage[] = ['open', 'deepen', 'depth_check', 'ftl', 'suggestion', 'return'];

/** Deterministic pick so the same day + type yields the same session; rotates across days. */
function pick<T>(items: T[], seed: number): T | undefined {
  if (!items.length) return undefined;
  return items[seed % items.length];
}

function dayIndex(d = new Date()) {
  return Math.floor(d.getTime() / 86_400_000);
}

/**
 * A fact that states a limitation, fear, or negative self-description. These must never be fed
 * back as suggestions — doing so would reinforce exactly what the user came to change. They are
 * routed to the FTL step instead, where they are named and then inverted.
 */
const LIMITING = /\b(never|always|can't|cant|cannot|won't|afraid|scared|fear|terrified|anxious|hate|fail(ing|ure)?|not good enough|too (late|old|slow|much|little)|struggle|useless|hopeless|no good|bad at|rubbish at)\b/i;

/** Conditional or narrative openings that turn into nonsense when prefixed with "I want to". */
const NOT_A_SUGGESTION = /^(every time|when|whenever|after|as soon as|if|because|sometimes|it's|its|there'?s)\b/i;

export const isLimiting = (text: string) => LIMITING.test(text);

/** Facts that can be phrased as a forward-looking suggestion without distorting them. */
export function suitableAsSuggestion(text: string): boolean {
  const t = text.trim();
  if (t.endsWith('?')) return false;
  if (NOT_A_SUGGESTION.test(t)) return false;
  return !isLimiting(t);
}

/** Turn a profile fact into first-person suggestion language. */
export function toSuggestionLanguage(text: string): string {
  const t = text.trim().replace(/\.$/, '');
  if (/^(i am|i want to|i get to)\b/i.test(t)) return t;
  const stripped = t
    .replace(/^i (should|need to|have to|must|ought to|try to|am trying to)\s+/i, 'I want to ')
    .replace(/^(should|need to|have to|must|try to)\s+/i, 'I want to ');
  if (/^i\b/i.test(stripped)) return stripped;
  return `I want to ${stripped.charAt(0).toLowerCase()}${stripped.slice(1)}`;
}

export interface ComposeOptions {
  sessionType: SessionType;
  targetMinutes: number;
  facts?: ProfileFact[];
  /** Free-text focus for this one session (from the Coach or the session setup screen). */
  focus?: string;
  /** For ftl-deletion / fear-screen: the belief or fear, in the user's own words. */
  belief?: string;
  origin?: 'library' | 'coach';
  rationale?: string;
  seed?: number;
}

export function composeSession(opts: ComposeOptions): SessionPlan {
  const {
    sessionType, targetMinutes, facts = [], focus, belief,
    origin = 'library', rationale, seed = dayIndex(),
  } = opts;
  const meta = SESSION_TYPE_META[sessionType];
  const targetSec = Math.max(180, Math.min(20 * 60, Math.round(targetMinutes * 60)));

  const steps: SessionStep[] = [];
  const add = (e: Entry | undefined) => {
    if (e) steps.push({ stage: e.stage!, title: e.title, body: e.body, duration_sec: e.duration_sec, entry_key: e.key });
  };

  // open
  add(pick(scriptsFor(sessionType, 'open'), seed));

  // deepen — one at 3-6 min, two above that
  const deepeners = scriptsFor(sessionType, 'deepen');
  add(pick(deepeners, seed));
  if (targetSec > 6 * 60 && deepeners.length > 1) add(pick(deepeners, seed + 1));

  // trance-depth check
  add(pick(scriptsFor(sessionType, 'depth_check'), seed));

  // FTL step when the technique calls for it, or when the user named a belief
  const ftl = scriptsFor(sessionType, 'ftl');
  // When the technique calls for an FTL step and the user hasn't typed a belief, the most recent
  // limiting belief in the profile is used — and shown in the Preview like everything else.
  const chosenBelief =
    belief?.trim() ||
    ((sessionType === 'ftl-deletion' || sessionType === 'fear-screen') ? limitingBeliefs(facts)[0] : undefined);
  if (ftl.length && (sessionType === 'ftl-deletion' || sessionType === 'fear-screen' || chosenBelief)) {
    add(pick(ftl, seed));
    if (chosenBelief) {
      steps.push({
        stage: 'ftl',
        title: 'Your words',
        body: `The belief you named: “${chosenBelief.trim()}”. Say it once, plainly, and notice where in your body it lands. Now the opposite, in the same plain words, and stay with it while the objection rises and passes.`,
        duration_sec: 90,
      });
    }
  }

  // suggestion
  const suggestions = scriptsFor(sessionType, 'suggestion');
  add(pick(suggestions, seed));
  if (targetSec > 9 * 60 && suggestions.length > 1) add(pick(suggestions, seed + 1));

  // personal suggestions from the profile, in I am / I want to / I get to language, tied to emotion
  const personal = personalSuggestions(facts, sessionType, focus);
  if (personal.length) {
    steps.push({
      stage: 'suggestion',
      title: 'Your suggestions',
      body:
        personal.map((s) => `${s} — and let yourself feel what that is like, not just hear it.`).join('\n\n') +
        '\n\nStay with the feeling for a few breaths. The feeling is the part that carries it.',
      duration_sec: Math.min(180, 40 * personal.length),
    });
  }

  // return
  add(pick(scriptsFor(sessionType, 'return'), seed));

  // Fit to the target length by scaling step durations, never by dropping structure.
  const base = steps.reduce((n, s) => n + s.duration_sec, 0);
  if (base > 0) {
    const scale = targetSec / base;
    const clamped = Math.max(0.55, Math.min(2.2, scale));
    for (const s of steps) s.duration_sec = Math.max(15, Math.round(s.duration_sec * clamped));
  }
  steps.sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage));

  const plainSuggestions = [
    ...steps
      .filter((s) => s.stage === 'suggestion' && s.title !== 'Your suggestions')
      .map((s) => `${s.title} — ${firstSentence(s.body)}`),
    ...personal,
    ...(chosenBelief ? [`Name the belief “${chosenBelief.trim()}” out loud, then hold its opposite`] : []),
  ];

  return {
    id: uid(),
    title: focus ? `${meta.label} — ${focus}` : meta.label,
    session_type: sessionType,
    target_sec: steps.reduce((n, s) => n + s.duration_sec, 0),
    steps,
    suggestions: plainSuggestions,
    origin,
    created_at: Date.now(),
    rationale,
  };
}

/** The opening sentence of a script step, used to state a suggestion plainly in the Preview. */
function firstSentence(body: string): string {
  const s = body.trim().split(/(?<=[.!?])\s+/)[0] ?? body;
  return s.length > 150 ? `${s.slice(0, 147)}…` : s;
}

/**
 * Choose profile facts relevant to this session type and phrase them as suggestions.
 * Only goals and positive identity statements qualify — a struggle, trigger, or limiting belief
 * is material for the FTL step, never for a suggestion.
 */
export function personalSuggestions(facts: ProfileFact[], sessionType: SessionType, focus?: string): string[] {
  const out: string[] = [];
  if (focus && suitableAsSuggestion(focus)) out.push(toSuggestionLanguage(focus));

  const prefer: Record<SessionType, ProfileFact['kind'][]> = {
    'morning-rehearsal': ['goal', 'identity'],
    'act-as-if': ['identity', 'goal'],
    'fear-screen': ['goal', 'identity'],
    'ftl-deletion': ['identity', 'goal'],
    'pre-sleep': ['identity', 'goal'],
    'focus-flow': ['goal'],
    'goal-clarity': ['goal'],
    'habit-craving': ['goal', 'identity'],
  };
  for (const kind of prefer[sessionType]) {
    for (const f of facts.filter((x) => x.kind === kind && suitableAsSuggestion(x.text))) {
      const s = toSuggestionLanguage(f.text);
      if (!out.includes(s)) out.push(s);
      if (out.length >= 3) return out;
    }
  }
  return out;
}

/** Limiting beliefs from the profile, most recent first — candidates for the FTL step. */
export function limitingBeliefs(facts: ProfileFact[]): string[] {
  return facts
    .filter((f) => (f.kind === 'struggle' || f.kind === 'identity') && isLimiting(f.text))
    .sort((a, b) => b.created_at - a.created_at)
    .map((f) => f.text);
}

/** Session length in words-per-second terms, used to pace on-screen text without TTS. */
export const PACE_WPS = { slow: 1.6, natural: 2.2, brisk: 2.8 } as const;
