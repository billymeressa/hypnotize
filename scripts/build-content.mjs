#!/usr/bin/env node
/**
 * Content pipeline build step. See CONTENT.md.
 *
 * Validates every content/sources/*.json, then emits src/content/generated.ts containing
 * ONLY status: "approved" entries. Draft entries are pipeline-only and never reach the app.
 *
 *   node scripts/build-content.mjs          validate + write
 *   node scripts/build-content.mjs --check  validate only
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'content', 'sources');
const outFile = join(root, 'src', 'content', 'generated.ts');
const checkOnly = process.argv.includes('--check');

const TYPES = ['principle', 'practice', 'prompt', 'script', 'reminder'];
const STAGES = ['open', 'deepen', 'depth_check', 'suggestion', 'ftl', 'return'];
const SESSION_TYPES = [
  'morning-rehearsal', 'act-as-if', 'fear-screen', 'ftl-deletion',
  'pre-sleep', 'focus-flow', 'goal-clarity', 'habit-craving',
];
const BANNED = ['cure', 'heal your', 'guaranteed', 'instantly', 'overnight', 'will make you rich'];

const errors = [];
const warnings = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

if (!existsSync(srcDir)) {
  console.error(`No ${srcDir}. See CONTENT.md.`);
  process.exit(1);
}

const files = readdirSync(srcDir).filter((f) => f.endsWith('.json')).sort();
const sources = [];
const seenSourceIds = new Set();

for (const file of files) {
  const where = `content/sources/${file}`;
  let src;
  try {
    src = JSON.parse(readFileSync(join(srcDir, file), 'utf8'));
  } catch (e) {
    err(where, `invalid JSON — ${e.message}`);
    continue;
  }
  for (const k of ['id', 'title', 'creator', 'date_added']) {
    if (typeof src[k] !== 'string' || !src[k]) err(where, `missing required field "${k}"`);
  }
  if (!Array.isArray(src.entries)) { err(where, 'entries must be an array'); continue; }
  if (seenSourceIds.has(src.id)) err(where, `duplicate source id "${src.id}"`);
  seenSourceIds.add(src.id);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(src.date_added || '')) err(where, 'date_added must be YYYY-MM-DD');

  const seenEntryIds = new Set();
  for (const [i, e] of src.entries.entries()) {
    const ew = `${where} entry[${i}] (${e.id ?? 'no id'})`;
    if (typeof e.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(e.id || '')) err(ew, 'id must be kebab-case');
    if (seenEntryIds.has(e.id)) err(ew, `duplicate entry id "${e.id}" within source`);
    seenEntryIds.add(e.id);
    if (!TYPES.includes(e.type)) err(ew, `type must be one of ${TYPES.join(', ')}`);
    if (typeof e.title !== 'string' || !e.title) err(ew, 'title required');
    if (typeof e.body !== 'string' || e.body.length < 10) err(ew, 'body required (>=10 chars)');
    if (typeof e.duration_sec !== 'number' || e.duration_sec < 0) err(ew, 'duration_sec must be a number >= 0');
    if (!Array.isArray(e.tags) || e.tags.some((t) => typeof t !== 'string' || t !== t.toLowerCase()))
      err(ew, 'tags must be an array of lowercase strings');
    if (typeof e.timestamp !== 'string') err(ew, 'timestamp required (may be "")');
    if (e.timestamp && !/^(\d{1,2}:)?\d{1,2}:\d{2}$/.test(e.timestamp)) err(ew, 'timestamp must be MM:SS or HH:MM:SS');
    if (e.status !== 'draft' && e.status !== 'approved') err(ew, 'status must be draft or approved');
    if ((e.type === 'principle' || e.type === 'reminder') && e.duration_sec !== 0)
      warn(ew, 'principle/reminder normally has duration_sec 0');

    const lower = (e.body || '').toLowerCase();
    for (const b of BANNED) {
      if (lower.includes(b)) err(ew, `body contains banned phrase "${b}" (outcome promise — see CONTENT.md)`);
    }

    if (e.type === 'script') {
      if (!STAGES.includes(e.stage)) err(ew, `script entries need stage: ${STAGES.join(', ')}`);
      if (!Array.isArray(e.session_types) || e.session_types.length === 0)
        err(ew, 'script entries need a non-empty session_types array');
      else for (const st of e.session_types) {
        if (!SESSION_TYPES.includes(st)) err(ew, `unknown session_type "${st}"`);
      }
      if (e.hypnosis === false) err(ew, 'a script entry cannot be hypnosis: false');
      if (e.duration_sec < 10) err(ew, 'script entries need duration_sec >= 10');
    }
    if (e.type !== 'script' && e.hypnosis === true)
      warn(ew, 'hypnosis: true on a non-script entry — the app only treats scripts as hypnosis');
  }
  sources.push({ file, src });
}

// Cross-source duplicate-title check — a nudge toward rule 2 rather than a hard failure.
const titleIndex = new Map();
for (const { src } of sources) {
  for (const e of src.entries) {
    const key = `${e.type}:${e.title.toLowerCase().trim()}`;
    if (titleIndex.has(key)) {
      warn(`${src.id}/${e.id}`, `same type+title as ${titleIndex.get(key)} — flag as a conflict or merge (CONTENT.md rule 2)`);
    } else titleIndex.set(key, `${src.id}/${e.id}`);
  }
}

// teachers_views.json
const tvPath = join(root, 'content', 'teachers_views.json');
let views = { claims: [] };
if (existsSync(tvPath)) {
  try {
    views = JSON.parse(readFileSync(tvPath, 'utf8'));
    if (!Array.isArray(views.claims)) err('teachers_views.json', 'claims must be an array');
    else for (const [i, c] of views.claims.entries()) {
      const cw = `teachers_views.json claims[${i}] (${c.id ?? 'no id'})`;
      for (const k of ['id', 'claim', 'evidence_note']) {
        if (typeof c[k] !== 'string' || !c[k].trim()) err(cw, `missing "${k}" — a claim without an evidence note cannot ship`);
      }
    }
  } catch (e) { err('teachers_views.json', `invalid JSON — ${e.message}`); }
}

for (const w of warnings) console.warn(`  warn  ${w}`);
if (errors.length) {
  console.error(`\ncontent validation failed (${errors.length}):`);
  for (const e of errors) console.error(`  error ${e}`);
  process.exit(1);
}

// ---- emit ----
const approvedEntries = [];
const counts = { draft: 0, approved: 0 };
for (const { src } of sources) {
  for (const e of src.entries) {
    counts[e.status]++;
    if (e.status !== 'approved') continue;
    const { notes, status, ...rest } = e;
    approvedEntries.push({
      ...rest,
      hypnosis: e.hypnosis ?? e.type === 'script',
      source_id: src.id,
      key: `${src.id}/${e.id}`,
    });
  }
}
const approvedViews = (views.claims || []).filter((c) => c.status === 'approved');
const sourceMeta = sources.map(({ src }) => ({
  id: src.id, title: src.title, url: src.url ?? '', creator: src.creator, date_added: src.date_added,
}));

if (checkOnly) {
  console.log(`content ok — ${counts.approved} approved, ${counts.draft} draft, ${sources.length} sources`);
  process.exit(0);
}

const banner = `// GENERATED by scripts/build-content.mjs — do not edit.
// Source of truth: content/sources/*.json. Run \`npm run content\`.
// Contains approved entries only; drafts are pipeline-only (see CONTENT.md).\n`;

const ts = `${banner}
import type { Entry, SourceMeta, TeacherView } from '../types';

export const SOURCES: SourceMeta[] = ${JSON.stringify(sourceMeta, null, 2)};

export const ENTRIES: Entry[] = ${JSON.stringify(approvedEntries, null, 2)};

export const TEACHER_VIEWS: TeacherView[] = ${JSON.stringify(approvedViews, null, 2)};

export const CONTENT_STATS = { approved: ${counts.approved}, draft: ${counts.draft}, sources: ${sources.length} };
`;

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, ts);
console.log(`content ok — wrote ${approvedEntries.length} approved entries (${counts.draft} drafts withheld), ${approvedViews.length} approved teacher views`);
