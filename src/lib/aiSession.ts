import type { ProfileFact, SessionPlan, SessionStep, SessionType, Stage } from '../types';
import { uid } from '../db';
import { SESSION_TYPE_META } from './content';
import { callClaude } from './ai';

const STAGE_ORDER: Stage[] = ['open', 'deepen', 'depth_check', 'ftl', 'suggestion', 'return'];

const SYSTEM = `You are writing a guided hypnosis script for the Hypnotize app. Output ONLY a JSON array of session steps — no markdown, no explanation, just the array.

Each object in the array must have:
  "stage": one of "open" | "deepen" | "depth_check" | "suggestion" | "ftl" | "return"
  "title": a short step name (3-6 words)
  "body": the script text spoken aloud to the user (120-350 words)
  "duration_sec": integer — estimated speaking time at a slow, calm pace (100 words ≈ 60 s)

Script writing rules:
- Use second person ("you", "your") and present tense
- Use permissive, inviting language: "you might notice…", "you can let…", "as you…"
- Avoid commands. No "you must", "you will", "do this".
- open: guide eyes closed and initial body relaxation (one step)
- deepen: deepen trance through counting, imagery, or progressive relaxation (1–2 steps)
- depth_check: a gentle trance-depth test, e.g. heavy eyelids or arm levitation (one step)
- suggestion: the core therapeutic content — weave in the user's goals and focus naturally (1–2 steps)
- ftl: for fear/belief work — name the old belief, hold its opposite, let the contrast dissolve it (include only if the session type calls for it or a belief was provided)
- return: gently count the user back to full awareness, feeling refreshed (one step)
- If the user provided personal facts or a focus, weave them into suggestion steps naturally. Never invent facts.

Output only valid JSON. Example:
[{"stage":"open","title":"Settle in","body":"Find a comfortable…","duration_sec":70}]`;

interface AISessionOptions {
  sessionType: SessionType;
  targetMinutes: number;
  facts?: ProfileFact[];
  focus?: string;
  belief?: string;
  apiKey: string;
}

export async function generateAISession(opts: AISessionOptions): Promise<SessionPlan> {
  const { sessionType, targetMinutes, facts = [], focus, belief, apiKey } = opts;
  const meta = SESSION_TYPE_META[sessionType];

  const profileSummary = facts.length
    ? facts.slice(0, 6).map((f) => `${f.kind}: ${f.text}`).join('\n')
    : 'No profile facts yet.';

  const userMsg = [
    `Session type: ${meta.label} — ${meta.blurb}`,
    `Target length: ${targetMinutes} minutes`,
    focus ? `User focus today: ${focus}` : '',
    belief ? `Core belief/fear to work with: "${belief}"` : '',
    `User profile:\n${profileSummary}`,
    `Include an ftl step: ${sessionType === 'ftl-deletion' || sessionType === 'fear-screen' || !!belief}`,
  ].filter(Boolean).join('\n');

  const raw = await callClaude(apiKey, [{ role: 'user', content: userMsg }], SYSTEM, 2000);

  let steps: SessionStep[];
  try {
    const parsed = JSON.parse(raw.trim()) as Array<{
      stage: Stage; title: string; body: string; duration_sec: number;
    }>;
    steps = parsed.map((s) => ({ stage: s.stage, title: s.title, body: s.body, duration_sec: s.duration_sec }));
  } catch {
    // If Claude returned markdown-fenced JSON, strip the fence and retry
    const match = raw.match(/```(?:json)?\s*([\s\S]+?)```/);
    if (match) {
      const parsed = JSON.parse(match[1]) as Array<{
        stage: Stage; title: string; body: string; duration_sec: number;
      }>;
      steps = parsed.map((s) => ({ stage: s.stage, title: s.title, body: s.body, duration_sec: s.duration_sec }));
    } else {
      throw new Error('AI returned an unexpected format. Try again.');
    }
  }

  steps.sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage));

  const suggestions = steps
    .filter((s) => s.stage === 'suggestion' || s.stage === 'ftl')
    .map((s) => `${s.title} — ${s.body.split(/[.!?]/)[0]?.trim() ?? s.title}`);

  return {
    id: uid(),
    title: focus ? `${meta.label} — ${focus}` : meta.label,
    session_type: sessionType,
    target_sec: steps.reduce((n, s) => n + s.duration_sec, 0),
    steps,
    suggestions,
    origin: 'library',
    created_at: Date.now(),
    rationale: `AI-generated and personalised${focus ? ` around: ${focus}` : ''}${facts.length ? ` using ${Math.min(facts.length, 6)} profile facts` : ''}.`,
  };
}
