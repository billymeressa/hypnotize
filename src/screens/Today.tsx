import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Launcher } from '../App';
import type { Completion, RoutineItem, Settings } from '../types';
import { db, getProfile, today, uid } from '../db';
import { composeSession } from '../lib/compose';
import { entry, SESSION_TYPE_META } from '../lib/content';
import type { SessionType } from '../types';
import { Glow, Sheet, Mood } from '../components/ui';
import ScrollSwap from './ScrollSwap';

const slotOf = (d = new Date()): 'morning' | 'midday' | 'evening' => {
  const h = d.getHours();
  if (h < 11) return 'morning';
  if (h < 19) return 'midday';
  return 'evening';
};

const GREETING = { morning: 'Good morning', midday: 'Afternoon', evening: 'Evening' } as const;

export default function Today({ ctx, settings }: { ctx: Launcher; settings: Settings }) {
  const date = today();
  const completions = useLiveQuery(() => db.completions.where('date').equals(date).toArray(), [date], []);
  const queued = useLiveQuery(() => db.queue.toArray(), [], []);
  const [openItem, setOpenItem] = useState<RoutineItem | null>(null);
  const [scrollSwap, setScrollSwap] = useState(false);
  const [checkin, setCheckin] = useState(false);

  const items = settings.routine.filter((r) => r.enabled);
  const doneRefs = new Set(completions.map((c) => c.ref));
  const isDone = (it: RoutineItem) =>
    doneRefs.has(it.id) || completions.some((c) => c.title === it.title);

  const remaining = items.filter((it) => !isDone(it));
  const allDone = items.length > 0 && remaining.length === 0;
  const slot = slotOf();

  const startSession = async (sessionType: SessionType, minutes: number, itemId: string) => {
    const profile = await getProfile();
    const plan = composeSession({ sessionType, targetMinutes: minutes, facts: profile.facts });
    plan.title = SESSION_TYPE_META[sessionType].label;
    plan.id = itemId;    // so the routine item can be marked done
    ctx.launch(plan);
  };

  const completePractice = async (it: RoutineItem, seconds: number) => {
    const c: Completion = {
      id: uid(), ref: it.id, kind: it.kind === 'checkin' ? 'checkin' : it.kind,
      title: it.title, date, started_at: Date.now() - seconds * 1000, ended_at: Date.now(),
      seconds, finished: true,
    };
    await db.completions.put(c);
  };

  return (
    <div className="screen">
      <div className="head">
        <p className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        <h1 style={{ marginTop: 10 }}>{GREETING[slot]}</h1>
        <p>
          {allDone
            ? "You're done for today."
            : slot === 'morning'
              ? 'Session first — before the phone opens anything else.'
              : `${remaining.length} left today.`}
        </p>
      </div>

      {allDone ? (
        <div className="stack-lg" style={{ marginTop: 40 }}>
          <Glow />
          <div style={{ textAlign: 'center' }}>
            <h2>Nothing else today</h2>
            <p className="dim small" style={{ marginTop: 10 }}>
              There is no extra credit here and nothing more to scroll. Close the app.
            </p>
          </div>
          <button className="btn-text" style={{ textAlign: 'center' }} onClick={() => ctx.go('library')}>
            Browse the library anyway
          </button>
        </div>
      ) : (
        <div className="stack">
          {(['morning', 'midday', 'evening'] as const).map((s) => {
            const group = items.filter((it) => it.slot === s);
            if (!group.length) return null;
            return (
              <div key={s} className="stack" style={{ marginBottom: 12 }}>
                <p className="eyebrow">{s}</p>
                {group.map((it) => {
                  const done = isDone(it);
                  return (
                    <button
                      key={it.id}
                      className={`card${done ? ' done' : ''}`}
                      onClick={() => {
                        if (done) return;
                        if (it.kind === 'session') void startSession(it.ref as SessionType, it.minutes, it.id);
                        else if (it.kind === 'checkin') setCheckin(true);
                        else setOpenItem(it);
                      }}
                    >
                      <div className="row-between">
                        <div className="grow">
                          <div className="item-title">{it.title}</div>
                          <div className="meta" style={{ marginTop: 4 }}>
                            {it.minutes} min
                            {it.kind !== 'session' && <> · <span className="badge badge-note" style={{ padding: '2px 6px' }}>not hypnosis</span></>}
                          </div>
                        </div>
                        {done && <span className="meta">done</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {queued.length > 0 && (
        <div className="stack" style={{ marginTop: 30 }}>
          <p className="eyebrow">Queued by the coach</p>
          {queued.map((q) => (
            <button key={q.id} className="card" onClick={() => ctx.launch(q.plan)}>
              <div className="item-title">{q.plan.title}</div>
              <div className="meta" style={{ marginTop: 4 }}>{Math.round(q.plan.target_sec / 60)} min · from your conversation</div>
            </button>
          ))}
        </div>
      )}

      <div className="divider" style={{ margin: '30px 0 20px' }} />

      <div className="stack">
        <button className="card card-quiet" onClick={() => setScrollSwap(true)}>
          <div className="item-title">I want to scroll</div>
          <div className="meta" style={{ marginTop: 4 }}>Name the feeling underneath it first</div>
        </button>
      </div>

      {openItem && (
        <Sheet title={openItem.title} onClose={() => setOpenItem(null)}>
          <PracticeSheet
            itemRef={openItem.ref}
            onDone={async (sec) => { await completePractice(openItem, sec); setOpenItem(null); }}
          />
        </Sheet>
      )}

      {checkin && (
        <Sheet title="Check-in" onClose={() => setCheckin(false)}>
          <CheckinSheet
            onDone={async (mood) => {
              const item = items.find((i) => i.kind === 'checkin');
              const c: Completion = {
                id: uid(), ref: item?.id ?? 'checkin', kind: 'checkin', title: 'Check-in',
                date, started_at: Date.now(), ended_at: Date.now(), seconds: 30,
                finished: true, mood_after: mood,
              };
              await db.completions.put(c);
              setCheckin(false);
            }}
          />
        </Sheet>
      )}

      {scrollSwap && <ScrollSwap ctx={ctx} onClose={() => setScrollSwap(false)} />}
    </div>
  );
}

function PracticeSheet({ itemRef, onDone }: { itemRef: string; onDone: (sec: number) => void }) {
  const e = entry(itemRef);
  const [text, setText] = useState('');
  if (!e) return <p className="dim small">That item is no longer in the approved library.</p>;
  const isPrompt = e.type === 'prompt';
  return (
    <div className="stack-lg">
      {!e.hypnosis && (
        <p className="notice">
          This is a waking exercise, not a hypnosis session. No induction, no suggestions.
        </p>
      )}
      <p className="serif-lead">{e.body}</p>
      {isPrompt && (
        <label className="field">
          <span>Write it here — this saves to your journal</span>
          <textarea value={text} onChange={(ev) => setText(ev.target.value)} placeholder="…" />
        </label>
      )}
      <button
        className="btn btn-block"
        onClick={async () => {
          if (isPrompt && text.trim()) {
            await db.journal.put({
              id: uid(), date: today(), prompt: e.title, text: text.trim(),
              created_at: Date.now(), updated_at: Date.now(), linked_ref: e.key,
            });
          }
          onDone(e.duration_sec || 60);
        }}
      >
        Done
      </button>
    </div>
  );
}

function CheckinSheet({ onDone }: { onDone: (mood: number) => void }) {
  const [mood, setMood] = useState<number | undefined>();
  return (
    <div className="stack-lg">
      <p className="serif-lead">Where are you at?</p>
      <Mood value={mood} onChange={setMood} />
      <button className="btn btn-block" disabled={!mood} onClick={() => onDone(mood!)}>Log it</button>
    </div>
  );
}
