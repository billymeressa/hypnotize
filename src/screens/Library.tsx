import { useMemo, useState } from 'react';
import type { Launcher } from '../App';
import type { Entry, SessionType } from '../types';
import { getProfile } from '../db';
import { composeSession } from '../lib/compose';
import { ENTRIES, SESSION_TYPES, SESSION_TYPE_META, sourceOf } from '../lib/content';
import { Sheet } from '../components/ui';

type Filter = 'sessions' | 'principles';
const LENGTHS = [3, 5, 8, 12, 20];

export default function Library({ ctx }: { ctx: Launcher }) {
  const [filter, setFilter] = useState<Filter>('sessions');
  const [tag, setTag] = useState<string | null>(null);
  const [setup, setSetup] = useState<SessionType | null>(null);
  const [reading, setReading] = useState<Entry | null>(null);

  const principles = useMemo(() => ENTRIES.filter((e) => e.type === 'principle'), []);

  const visibleTags = useMemo(() => {
    if (filter === 'sessions') {
      const pool = SESSION_TYPES.flatMap((s) => SESSION_TYPE_META[s].tags);
      return [...new Set(pool)].sort();
    }
    const pool = principles.flatMap((e) => e.tags);
    return [...new Set(pool)].sort();
  }, [filter, principles]);

  const sessions = SESSION_TYPES.filter((s) => !tag || SESSION_TYPE_META[s].tags.includes(tag));
  const entries = principles.filter((e) => !tag || e.tags.includes(tag));

  return (
    <div className="screen">
      <div className="head">
        <h1>Sessions</h1>
        <p>Every session type the Guide can lead. Tap one to set it up.</p>
      </div>

      <div className="scroll-x" style={{ marginBottom: 12 }}>
        {(['sessions', 'principles'] as Filter[]).map((f) => (
          <button key={f} className="chip" aria-pressed={filter === f} onClick={() => { setFilter(f); setTag(null); }}>
            {f === 'principles' ? 'How it works' : 'Sessions'}
          </button>
        ))}
      </div>

      <div className="scroll-x" style={{ marginBottom: 22 }}>
        <button className="chip" aria-pressed={tag === null} onClick={() => setTag(null)}>All</button>
        {visibleTags.map((t) => (
          <button key={t} className="chip" aria-pressed={tag === t} onClick={() => setTag(t)}>{t.replace(/-/g, ' ')}</button>
        ))}
      </div>

      {filter === 'sessions' ? (
        <div className="stack">
          {sessions.map((s) => {
            const m = SESSION_TYPE_META[s];
            return (
              <button key={s} className="card" onClick={() => setSetup(s)}>
                <div className="item-title">{m.label}</div>
                <p className="small dim" style={{ margin: '6px 0 0' }}>{m.blurb}</p>
                <div className="meta" style={{ marginTop: 8 }}>{m.defaultMinutes} min · {m.tags.join(' · ')}</div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="stack">
          {entries.length === 0 && <p className="empty-state">Nothing here yet.</p>}
          {entries.map((e) => (
            <button key={e.key} className="card" onClick={() => setReading(e)}>
              <div className="item-title">{e.title}</div>
              <div className="meta" style={{ marginTop: 5 }}>
                {sourceOf(e.source_id)?.creator ?? e.source_id}
              </div>
            </button>
          ))}
        </div>
      )}

      {setup && <SessionSetup type={setup} ctx={ctx} onClose={() => setSetup(null)} />}

      {reading && (
        <Sheet title={reading.title} onClose={() => setReading(null)}>
          <div className="stack-lg">
            <p className="serif-lead">{reading.body}</p>
            <div>
              <p className="tag">
                Source: {sourceOf(reading.source_id)?.title ?? reading.source_id}
                {reading.timestamp && ` · ${reading.timestamp}`}
              </p>
              {sourceOf(reading.source_id)?.url && (
                <a className="small" href={sourceOf(reading.source_id)!.url} target="_blank" rel="noreferrer">
                  Open source
                </a>
              )}
            </div>
          </div>
        </Sheet>
      )}
    </div>
  );
}

export function SessionSetup({ type, ctx, onClose }: { type: SessionType; ctx: Launcher; onClose: () => void }) {
  const meta = SESSION_TYPE_META[type];
  const [minutes, setMinutes] = useState(meta.defaultMinutes);
  const [focus, setFocus] = useState('');
  const [belief, setBelief] = useState('');
  const needsBelief = type === 'ftl-deletion' || type === 'fear-screen';

  const start = async () => {
    const profile = await getProfile();
    const plan = composeSession({
      sessionType: type,
      targetMinutes: minutes,
      facts: profile.facts,
      focus: focus.trim() || undefined,
      belief: belief.trim() || undefined,
    });
    onClose();
    ctx.launch(plan);
  };

  return (
    <Sheet title={meta.label} onClose={onClose}>
      <div className="stack-lg">
        <p className="small dim">{meta.blurb}</p>

        <div>
          <p className="eyebrow" style={{ marginBottom: 10 }}>Length</p>
          <div className="scroll-x">
            {LENGTHS.map((m) => (
              <button key={m} className="chip" aria-pressed={minutes === m} onClick={() => setMinutes(m)}>{m} min</button>
            ))}
          </div>
        </div>

        {needsBelief && (
          <label className="field">
            <span>{type === 'fear-screen' ? 'What is the fear, in your own words?' : 'The belief, in the plainest words you have'}</span>
            <input type="text" value={belief} onChange={(e) => setBelief(e.target.value)} placeholder="…" />
          </label>
        )}

        <label className="field">
          <span>Anything specific for today? (optional)</span>
          <input type="text" value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="e.g. finish the proposal without stalling" />
        </label>

        <button className="btn btn-block" onClick={start}>Preview the session</button>
        <p className="tiny faint" style={{ textAlign: 'center' }}>
          You'll see every suggestion before anything starts.
        </p>
      </div>
    </Sheet>
  );
}
