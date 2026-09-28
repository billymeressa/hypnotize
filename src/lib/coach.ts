import type { ChatMessage, ProfileFact, SessionType } from '../types';
import { uid } from '../db';
import { toSuggestionLanguage } from './compose';

/**
 * Change Coach — the conversational half of the Guide.
 *
 * v1 runs entirely on device: reflective questioning driven by what the user actually wrote,
 * plus a fact extractor that PROPOSES durable facts for confirmation. Nothing is saved without
 * the user pressing save on a specific proposal.
 *
 * If a hosted model is wired in later, it replaces `coachReply` and `proposeFacts` only. The
 * confirmation gate, the Preview step, and the Stop control are not negotiable parts of the flow
 * and must stay on this side of the boundary.
 */

const PUSHED_LANGUAGE = /\b(should|need to|have to|must|ought to|trying to|try to)\b/i;
const FEAR = /\b(afraid|scared|fear|anxious|anxiety|nervous|terrified|dread|worry|worried)\b/i;
const IDENTITY = /\b(i am|i'm|kind of person|type of person|i'm not|i've always been)\b/i;
const CRAVING = /\b(scroll|scrolling|phone|instagram|tiktok|porn|smoke|vape|drink|sugar|snack|binge|doom)\b/i;
const PROCRASTINATION = /\b(procrastinat|put off|avoid|avoiding|delay|can't start|cant start)\b/i;
const SLEEP = /\b(sleep|insomnia|awake at night|can't sleep|cant sleep|tired)\b/i;
const GOAL = /\b(i want|i'd like|my goal|i'm working on|im working on|i wish)\b/i;
const CRISIS = /\b(kill myself|suicide|suicidal|end my life|self harm|self-harm|hurt myself|want to die)\b/i;

export const CRISIS_RESPONSE =
  "I'm going to step out of coach mode for a moment. What you just described is beyond what a " +
  "self-guided hypnosis app should be handling. Please talk to a person today — a crisis line, a " +
  "doctor, or someone you trust. In the US and Canada you can call or text 988; in the UK, 111 or " +
  "Samaritans on 116 123; elsewhere, findahelpline.com lists local numbers. I'll still be here " +
  "afterwards, and nothing you've written has been sent anywhere.";

export function looksLikeCrisis(text: string) { return CRISIS.test(text); }

const OPENERS = [
  "Tell me what you want to be different. Not the polished version — however it actually sounds in your head.",
  "What would you change about how you operate, if it were simply done?",
  "Who do you want to be, and where does the current version fall short?",
];

/** Reflective, question-led replies. Deliberately short — the user should be doing most of the typing. */
export function coachReply(history: ChatMessage[], userText: string): string {
  const t = userText.trim();
  if (looksLikeCrisis(t)) return CRISIS_RESPONSE;

  const userTurns = history.filter((m) => m.role === 'user').length + 1;
  const lines: string[] = [];

  if (PUSHED_LANGUAGE.test(t)) {
    const swapped = toSuggestionLanguage(t.split(/[.!?]/)[0] || t);
    lines.push(`You said that in pushed language. Try it as: “${swapped}.” Does that still read as true, or does it change something?`);
  }

  if (FEAR.test(t)) {
    lines.push("Name the worst case plainly — what specifically happens, and to whom? Fears tend to shrink once they're stated in full sentences rather than held as a feeling.");
  } else if (CRAVING.test(t)) {
    lines.push("When the urge arrives, what's the feeling just before it? Usually it's a specific one — bored, tired, anxious, or avoiding one particular task.");
  } else if (PROCRASTINATION.test(t)) {
    lines.push("What's the very first physical action of the thing you're avoiding — the one that takes under a minute? And what are you expecting to feel once you start?");
  } else if (SLEEP.test(t)) {
    lines.push("At night, is it your body that won't settle or your mind that won't stop? They need different sessions.");
  } else if (IDENTITY.test(t)) {
    lines.push("Where did you first learn that about yourself? Not to argue with it — I want to know whether it's a conclusion or an observation.");
  } else if (GOAL.test(t)) {
    lines.push("Make it concrete for me: what's the first hour of having that like? What have you stopped doing by then?");
  } else if (userTurns <= 1) {
    lines.push("Say more about when this shows up. A specific recent moment is more useful than the general shape of it.");
  } else {
    lines.push("What's the cost of it staying exactly as it is for another year? And what's the first thing that would look different if it shifted?");
  }

  if (userTurns >= 3) {
    lines.push("When you're ready, I can turn this into a session — you'll see every suggestion before it starts.");
  }
  return lines.join('\n\n');
}

export const coachOpener = () => OPENERS[Math.floor(Math.random() * OPENERS.length)];

/** A proposed fact, pending the user's confirmation. */
export interface FactProposal {
  id: string;
  kind: ProfileFact['kind'];
  text: string;
  because: string;      // why this was picked out, shown in the confirm list
}

function sentences(text: string) {
  return text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length > 8);
}

/** Pull durable-looking facts out of a conversation. Proposals only — never saved here. */
export function proposeFacts(messages: ChatMessage[], conversationId: string): FactProposal[] {
  const out: FactProposal[] = [];
  const seen = new Set<string>();
  const push = (kind: ProfileFact['kind'], text: string, because: string) => {
    const clean = text.replace(/\s+/g, ' ').trim().replace(/[,;]$/, '');
    if (clean.length < 10 || clean.length > 220) return;
    const dedupe = clean.toLowerCase();
    if (seen.has(dedupe)) return;
    seen.add(dedupe);
    out.push({ id: uid(), kind, text: clean, because });
  };

  for (const m of messages.filter((x) => x.role === 'user')) {
    for (const s of sentences(m.text)) {
      if (/\b(i want|my goal|i'd like|i am working on|i'm working on)\b/i.test(s)) push('goal', s, 'stated as something you want');
      else if (/\b(i am|i'm|i've always been|i'm not|i am not)\b/i.test(s)) push('identity', s, 'a statement about who you are');
      else if (FEAR.test(s) || /\b(i struggle|i can't|i cant|i keep|the problem is)\b/i.test(s)) push('struggle', s, 'described as a struggle or fear');
      else if (/\b(when|every time|after|whenever|as soon as)\b/i.test(s) && (CRAVING.test(s) || /\b(i end up|i always|i reach for)\b/i.test(s))) push('trigger', s, 'reads like a trigger — a situation followed by a behaviour');
      else if (PUSHED_LANGUAGE.test(s)) push('language', s, 'pushed language worth swapping (should / need to / try)');
    }
  }
  // Keep the confirm list short enough to actually read.
  return out.slice(0, 8).map((p) => ({ ...p, id: `${conversationId}-${p.id}` }));
}

/** Which session type best fits what the conversation has been about. */
export function suggestSessionType(messages: ChatMessage[], facts: ProfileFact[]): SessionType {
  const text = [...messages.filter((m) => m.role === 'user').map((m) => m.text), ...facts.map((f) => f.text)]
    .join(' ').toLowerCase();
  if (SLEEP.test(text)) return 'pre-sleep';
  if (CRAVING.test(text)) return 'habit-craving';
  if (FEAR.test(text)) return 'fear-screen';
  if (/\b(always been|i'm not the kind|never been able)\b/i.test(text)) return 'ftl-deletion';
  if (PROCRASTINATION.test(text) || /\bfocus|distract/.test(text)) return 'focus-flow';
  if (/\bvague|not sure what i want|direction\b/.test(text)) return 'goal-clarity';
  if (IDENTITY.test(text)) return 'act-as-if';
  return 'morning-rehearsal';
}

/** One-line summary of a conversation for the history list. */
export function conversationTitle(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === 'user');
  if (!first) return 'New conversation';
  const t = first.text.replace(/\s+/g, ' ').trim();
  return t.length > 58 ? `${t.slice(0, 55)}…` : t;
}
