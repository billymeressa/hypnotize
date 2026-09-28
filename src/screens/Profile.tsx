import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Launcher } from '../App';
import type { ProfileFact } from '../types';
import { db, getProfile, uid } from '../db';
import { isLimiting, suitableAsSuggestion, toSuggestionLanguage } from '../lib/compose';
import { Sheet } from '../components/ui';

const KINDS: ProfileFact['kind'][] = ['goal', 'identity', 'struggle', 'trigger', 'language', 'note'];

const KIND_BLURB: Record<ProfileFact['kind'], string> = {
  goal: 'What you want. Sessions turn these into "I want to" suggestions.',
  identity: 'Who you are or intend to be. Used by act-as-if sessions.',
  struggle: 'What keeps getting in the way. Used by FTL and fear sessions.',
  trigger: 'Situations that reliably precede a behaviour. Used by craving sessions.',
  language: 'Phrasing worth swapping out. Used by the midday language check.',
  note: 'Anything else you want the Guide to know.',
};

export default function Profile({ ctx }: { ctx: Launcher }) {
  const profile = useLiveQuery(() => getProfile(), [], undefined);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ProfileFact | null>(null);

  const facts = profile?.facts ?? [];

  const save = async (next: ProfileFact[]) => {
    await db.profile.put({ id: 'me', facts: next, updated_at: Date.now() });
  };

  return (
    <div className="screen">
      <div className="head">
        <button className="btn-text" onClick={() => ctx.go('more')}>← More</button>
        <h1 style={{ marginTop: 12 }}>Profile</h1>
        <p>
          Everything the Guide knows about you, in full. Edit or delete any of it — sessions built
          after a change use the new version.
        </p>
      </div>

      {facts.length === 0 ? (
        <div className="empty-state">
          <p>Nothing saved yet.</p>
          <p className="small" style={{ marginTop: 8 }}>
            Talk to the Change Coach, or add something here by hand.
          </p>
        </div>
      ) : (
        <div className="stack-lg">
          {KINDS.map((kind) => {
            const group = facts.filter((f) => f.kind === kind);
            if (!group.length) return null;
            return (
              <div key={kind} className="stack">
                <div>
                  <p className="eyebrow">{kind}</p>
                  <p className="tiny faint" style={{ marginTop: 5 }}>{KIND_BLURB[kind]}</p>
                </div>
                {group.map((f) => (
                  <button key={f.id} className="card" onClick={() => setEditing(f)}>
                    <p style={{ margin: 0, fontSize: 15 }}>{f.text}</p>
                    <p className="tiny faint" style={{ margin: '8px 0 0' }}>
                      {suitableAsSuggestion(f.text)
                        ? `as a suggestion: ${toSuggestionLanguage(f.text)}`
                        : isLimiting(f.text)
                          ? 'used as material for the FTL step — named, then inverted. Never suggested back to you as-is.'
                          : 'kept as context; not phrased as a suggestion.'}
                    </p>
                    <p className="tiny faint" style={{ margin: '4px 0 0' }}>
                      {f.source === 'coach' ? 'from a conversation' : 'added by you'} · {new Date(f.created_at).toLocaleDateString()}
                    </p>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}

      <div className="stack" style={{ marginTop: 30 }}>
        <button className="btn btn-ghost btn-block" onClick={() => setAdding(true)}>Add something</button>
        {facts.length > 0 && (
          <button
            className="btn btn-ghost btn-danger btn-block"
            onClick={async () => {
              if (confirm('Delete the entire profile? This cannot be undone.')) await save([]);
            }}
          >
            Delete the whole profile
          </button>
        )}
      </div>

      {(adding || editing) && (
        <FactSheet
          fact={editing}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSave={async (f) => {
            const next = editing
              ? facts.map((x) => (x.id === f.id ? f : x))
              : [...facts, f];
            await save(next);
            setAdding(false); setEditing(null);
          }}
          onDelete={editing ? async () => {
            await save(facts.filter((x) => x.id !== editing.id));
            setEditing(null);
          } : undefined}
        />
      )}
    </div>
  );
}

function FactSheet({
  fact, onClose, onSave, onDelete,
}: {
  fact: ProfileFact | null;
  onClose: () => void;
  onSave: (f: ProfileFact) => void;
  onDelete?: () => void;
}) {
  const [kind, setKind] = useState<ProfileFact['kind']>(fact?.kind ?? 'goal');
  const [text, setText] = useState(fact?.text ?? '');

  return (
    <Sheet title={fact ? 'Edit' : 'Add to profile'} onClose={onClose}>
      <div className="stack-lg">
        <div>
          <p className="eyebrow" style={{ marginBottom: 10 }}>Kind</p>
          <div className="scroll-x">
            {KINDS.map((k) => (
              <button key={k} className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>{k}</button>
            ))}
          </div>
          <p className="tiny faint" style={{ marginTop: 10 }}>{KIND_BLURB[kind]}</p>
        </div>
        <label className="field">
          <span>In your own words</span>
          <textarea value={text} onChange={(e) => setText(e.target.value)} style={{ minHeight: 90 }} />
        </label>
        {text.trim() && (
          <p className="notice">
            {suitableAsSuggestion(text)
              ? `Sessions will phrase this as: ${toSuggestionLanguage(text)}`
              : isLimiting(text)
                ? 'This reads as a limiting belief, so sessions will name it and work its opposite rather than suggest it back to you.'
                : 'Kept as context. Sessions will not phrase this one as a suggestion.'}
          </p>
        )}
        <button
          className="btn btn-block"
          disabled={!text.trim()}
          onClick={() => onSave({
            id: fact?.id ?? uid(),
            kind,
            text: text.trim(),
            created_at: fact?.created_at ?? Date.now(),
            source: fact?.source ?? 'manual',
            from_conversation: fact?.from_conversation,
          })}
        >
          Save
        </button>
        {onDelete && (
          <button className="btn btn-ghost btn-danger btn-block" onClick={onDelete}>Delete this</button>
        )}
      </div>
    </Sheet>
  );
}
