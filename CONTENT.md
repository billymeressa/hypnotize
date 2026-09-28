# Content pipeline

Hypnotize's library is built from source videos. This file is the **contract**: any Claude Code
session that is handed a new transcript follows it exactly, without re-deriving the process.

## Why it exists

The app must never contain verbatim transcript text, and must never present an anecdote as a
practice or a promised outcome. The pipeline enforces both mechanically: the build step refuses
to ship anything that fails validation, and only `approved` entries reach the running app.

---

## Directory layout

```
content/
  schema.json              Machine-readable shape of a source file (documentation + validator)
  sources/<id>.json        One file per source video
  teachers_views.json      Anecdotal / unverified claims, quarantined (never a practice)
src/content/generated.ts   Build output — approved entries only. Never edit by hand.
```

## Source file format — `content/sources/<id>.json`

```json
{
  "id": "vid-0003-identity-shift",
  "title": "Short descriptive title of the video",
  "url": "https://www.youtube.com/watch?v=...",
  "creator": "Channel name",
  "date_added": "2026-09-28",
  "entries": [ /* Entry objects */ ]
}
```

`id` must be unique across all source files and stable forever — completions and journal
entries reference entries by `<source id>/<entry id>`, so renaming an id orphans user data.

### Entry object

| Field | Type | Notes |
|---|---|---|
| `id` | string | Unique **within** the source file. kebab-case. Stable forever. |
| `type` | `principle` \| `practice` \| `prompt` \| `script` \| `reminder` | See below. |
| `title` | string | Short, plain, no hype. |
| `body` | string | **Paraphrased in your own words.** Never verbatim transcript text. |
| `duration_sec` | number | Time to read/perform. `0` for `principle`/`reminder`. |
| `tags` | string[] | Lowercase kebab-case. See the tag vocabulary below. |
| `timestamp` | string | `"MM:SS"` or `"HH:MM:SS"` where it appears in the source. |
| `status` | `draft` \| `approved` | **New entries are always `draft`.** |
| `session_types` | string[] | *(optional, `script` only)* which session types may use it. |
| `stage` | string | *(optional, `script` only)* `open` \| `deepen` \| `depth_check` \| `suggestion` \| `ftl` \| `return`. |
| `hypnosis` | boolean | *(optional)* `false` marks a non-hypnosis item. Defaults to `true` for `script`, `false` otherwise. |
| `notes` | string | *(optional)* Reviewer notes, conflict flags. Not shown in the app. |

### Entry types

- **principle** — a claim about how mind/change works. Informational; shown in the library as reading.
- **practice** — something the user *does* while awake (a language swap, an ad filter). Not hypnosis.
- **prompt** — a journal or reflection question.
- **script** — hypnosis copy the Guide can speak. This is the only type the session player composes from.
- **reminder** — a one-line cue suitable for a notification.

### Tag vocabulary

Goals: `identity`, `fear`, `confidence`, `focus`, `sleep`, `craving`, `money-mindset`, `clarity`,
`relationships`, `procrastination`.
Mechanics: `induction`, `deepening`, `suggestion`, `ftl`, `rehearsal`, `act-as-if`, `screen-technique`,
`language`, `attention`, `influence-literacy`.
Time of day: `morning`, `midday`, `evening`.

---

## Extraction rules — follow these in order

1. **Extract candidates.** Read the transcript and pull out discrete, reusable ideas. Paraphrase
   every one; if a phrase is distinctive enough that it only works in the teacher's exact words,
   either rewrite it until it stands on its own or drop it. Record the timestamp.
2. **Flag overlaps — do not duplicate.** Before adding, check existing entries (all sources,
   including `approved` ones). If a candidate restates, extends, or contradicts an existing entry,
   do not add a near-copy. Instead add the candidate with a `notes` field naming the conflict, e.g.
   `"notes": "Overlaps vid-0001/eye-fixation-open; this version adds a breath count. Merge or drop one."`
   Report every flag in the session summary so the reviewer can decide.
3. **Everything new is `status: "draft"`.**
4. **Never auto-approve.** Approval is the reviewer's act. Flip `draft` → `approved` only when the
   reviewer explicitly says so, either in general or per entry. A session that approves its own
   extraction has broken the pipeline.
5. **Quarantine anecdotal claims.** Any income figure, instant cure, "this happened in 60 seconds",
   before/after story, or unverifiable personal result goes in `content/teachers_views.json` — never
   as a `practice`, never as a promised outcome, never in a `script`. Each gets a short
   `evidence_note` stating plainly what is and isn't known.
6. **Name nothing.** Entries must not use the source teacher's name, likeness, voice, or catchphrases
   as branding. The in-app Guide is an original character. Attribution lives in the source file's
   `creator`/`url` fields, which the library shows as "source", and in Teacher's Views.

## Safety rules the content must satisfy (enforced by the build)

- No `script` entry may contain a suggestion the user has not seen. Every script entry's `body` is
  shown verbatim in the session Preview.
- No entry may promise a medical, psychiatric, or financial outcome. Banned in `body`: "cure",
  "heal your", "guaranteed", "instantly", "overnight", "will make you rich".
- No script may instruct the user to drive, operate machinery, or ignore distress.
- Non-hypnosis items must be marked `"hypnosis": false` so the app can label them before they start.

## Build step

```bash
npm run content        # validate + regenerate src/content/generated.ts
npm run content:check  # validate only, non-zero exit on failure
```

The generator:
- validates every source file against the rules above,
- drops every `draft` entry (drafts are pipeline-only and are never readable by the live app),
- drops `teachers_views.json` claims that lack an `evidence_note`,
- writes `src/content/generated.ts`, which is the *only* path the app imports content through.

`npm run dev` and `npm run build` run it automatically, so a validation failure stops the app
rather than shipping unreviewed content.

## Session checklist for a new transcript

When the user pastes a transcript:

1. Ask for (or infer from the paste) the video `url` and `title`; pick the next `vid-NNNN-slug` id.
2. Extract into `content/sources/<id>.json` with every entry `status: "draft"`.
3. Move anecdotes into `content/teachers_views.json`.
4. Run `npm run content:check`.
5. Report: how many entries per type, every overlap/conflict flag, every quarantined claim.
6. Stop. Wait for the reviewer to approve.
