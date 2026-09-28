# Hypnotize

A private, single-user hypnosis app. Installable PWA, works offline, no accounts, no backend,
no analytics. All data lives in IndexedDB on the device and can be exported to JSON at any time.

```bash
npm install
npm run dev      # http://localhost:5175
```

Other scripts: `npm run build` (production + service worker), `npm run content` (validate and
regenerate the library), `npm run content:check` (validate only), `npm run typecheck`.

To install it on a phone: serve the build over HTTPS or over your LAN, open it in the phone's
browser, and use Add to Home Screen.

---

## What the app is

The centrepiece is the **Guide**: an original character, rendered as light and a waveform, never as
a person and never using any real teacher's name, voice, or likeness. It does two things:

- **Leads sessions.** Full inductions composed from approved library content —
  open → deepen → depth check → (FTL) → suggestion → return.
- **Runs the Change Coach.** A free-form chat that builds a persistent Profile and generates
  sessions from it.

Everything else — routine, library, journal, progress, reminders — exists to schedule and reinforce
sessions.

### Rules the code enforces, not just documents

| Rule | Where it lives |
|---|---|
| Every session shows every suggestion in plain language before it starts | `src/screens/Player.tsx`, `preview` phase; the list comes from `plan.suggestions` |
| A Stop control is visible in every phase | `Player.tsx` — `StopButton` renders in all five phases |
| Stopping early still records the session, never as a failure | `Player.record(false)` |
| Nothing saves to the Profile without explicit confirmation | `src/screens/Coach.tsx` — `proposeFacts` proposes, `saveChosen` writes |
| A limiting belief is never suggested back to the user | `src/lib/compose.ts` — `isLimiting` / `suitableAsSuggestion`; limiting facts route to the FTL step |
| Non-hypnosis items are labelled before they open | `hypnosis: false` in content → "not hypnosis" badge in Today, Library, Toolkits |
| Only reviewed content reaches the app | `scripts/build-content.mjs` drops every `draft` |
| Reminders capped at 8/day with quiet hours, no badges | `src/lib/reminders.ts`, `saveSettings` |
| The daily set ends | `Today.tsx` — "Nothing else today", no autoplay, no infinite list |

### On "AI"

v1 has no model call and no network. The Guide composes sessions **deterministically** from
approved `script` entries plus your Profile (`src/lib/compose.ts`), and the Coach replies with
reflective questions driven by what you actually wrote (`src/lib/coach.ts`). That keeps it fully
offline and means every line delivered in trance is content that passed review, rather than model
output that could invent a suggestion you never saw.

If a hosted model is added later, it replaces `coachReply` and the wording inside `composeSession`
only. The confirmation gate, the Preview step, and the Stop control stay on this side of that
boundary — generated sessions go through exactly the same path as library ones.

---

## Architecture

```
content/                  source of truth for the library (see CONTENT.md)
scripts/build-content.mjs  validator + generator → src/content/generated.ts (gitignored)
src/
  db.ts                   Dexie schema + defaults. All storage goes through here.
  types.ts                domain types, shared by content and storage
  lib/
    content.ts            typed accessors over the generated content
    compose.ts            session generator — structure, pacing, suggestion safety
    coach.ts              Change Coach replies + fact extraction proposals
    tts.ts  ambient.ts    optional voice; synthesised ambient sound (no audio files)
    reminders.ts          local notifications, quiet hours, daily cap
    stats.ts  backup.ts   streak/minutes/mood; JSON export + import + erase
  screens/                one file per screen; Player.tsx is the centrepiece
  components/             Nav, and the small shared UI pieces
```

Storage tables: `profile`, `chat`, `completions`, `journal`, `settings`, `sessions`, `queue`.
Schema version 1; bump `db.version(...)` in `src/db.ts` for migrations, and `Backup.schema` in
`src/lib/backup.ts` when the export shape changes.

### Adding content

Paste a transcript into a Claude Code session in this repo. **CONTENT.md is the contract** — it
tells that session exactly what to extract, how to flag overlaps, and that nothing may be
auto-approved. New entries land as `draft` and are invisible to the app until you flip them to
`approved` and re-run `npm run content`.

### Adding a session type

1. Add it to `SESSION_TYPES` in `content/schema.json` and `scripts/build-content.mjs`.
2. Add it to the `SessionType` union in `src/types.ts` and to `SESSION_TYPE_META` in
   `src/lib/content.ts`.
3. Tag existing `script` entries with it (at minimum an `open`, a `deepen`, a `depth_check`, a
   `suggestion` and a `return`) and re-run `npm run content`.

---

## Limits of the web version — what would need going native

These are real ceilings, not things left undone out of laziness:

- **Scheduled reminders.** A PWA can only schedule notifications while it is running. On iOS in
  particular there is no reliable background wake, so reminders fire when the app has been opened
  that day. Native (or a push server) is the only fix.
- **OS-level app blocking.** Blocking or delaying social apps during a session, or in the morning
  before the first session, needs platform APIs: Screen Time / `FamilyControls` on iOS,
  `UsageStatsManager` + an accessibility service on Android. Not possible from a web app at all.
  Deliberately not built — it would need a native shell (Capacitor plus native modules, or a real
  native client) and both platforms treat these APIs as privileged.
- **Reliable audio during screen-lock**, background TTS, and lock-screen transport controls for a
  pre-sleep session. Web audio is suspended aggressively when a page is backgrounded.
- **Home-screen widgets / Focus-mode integration** for "first app of the morning".

The storage layer is deliberately plain Dexie with a JSON export, so a native client can adopt the
same schema and import an existing export rather than starting from nothing.

---

## Safety posture

No medical or psychiatric claims. The Coach detects crisis language and steps out of coach mode
with helpline information rather than offering a session (`CRISIS_RESPONSE` in `src/lib/coach.ts`).
The content build rejects outcome-promise wording outright. Anecdotal claims from source videos are
quarantined in `content/teachers_views.json` and shown only in Teacher's Views, with an evidence
note, never as a practice or promise. The Influence literacy screen states plainly how suggestion
works — including where this app itself could be habit-forming.
