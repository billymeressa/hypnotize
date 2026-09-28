import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Launcher } from '../App';
import type { RoutineItem, Settings } from '../types';
import { db, getProfile, today } from '../db';
import { composeSession } from '../lib/compose';
import type { SessionType } from '../types';
import ScrollSwap from './ScrollSwap';
import { hashParams } from '../routes';

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
  const [scrollSwap, setScrollSwap] = useState(false);

  useEffect(() => {
    if (hashParams().get('swap') === '1') {
      setScrollSwap(true);
      history.replaceState(null, '', '#/today');
    }
  }, []);

  const items = settings.routine.filter((r) => r.enabled && r.kind === 'session');
  const doneRefs = new Set(completions.map((c) => c.ref));
  const isDone = (it: RoutineItem) =>
    doneRefs.has(it.id) || completions.some((c) => c.title === it.title);

  const remaining = items.filter((it) => !isDone(it));
  const allDone = items.length > 0 && remaining.length === 0;
  const slot = slotOf();

  const startSession = async (sessionType: SessionType, minutes: number, itemId: string) => {
    const profile = await getProfile();
    const plan = composeSession({ sessionType, targetMinutes: minutes, facts: profile.facts });
    plan.id = itemId;
    ctx.launch(plan);
  };

  return (
    <div className="screen">
      <div className="head">
        <p className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        <h1 style={{ marginTop: 10 }}>{GREETING[slot]}</h1>
        <p>
          {allDone
            ? 'All done — tap any session to go again.'
            : slot === 'morning'
              ? 'Session first — before the phone opens anything else.'
              : `${remaining.length} left today.`}
        </p>
      </div>

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
                    onClick={() => void startSession(it.ref as SessionType, it.minutes, it.id)}
                  >
                    <div className="row-between">
                      <div className="grow">
                        <div className="item-title">{it.title}</div>
                        <div className="meta" style={{ marginTop: 4 }}>{it.minutes} min</div>
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

      {scrollSwap && <ScrollSwap ctx={ctx} onClose={() => setScrollSwap(false)} />}
    </div>
  );
}
