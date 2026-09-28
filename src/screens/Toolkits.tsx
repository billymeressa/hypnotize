import { useState } from 'react';
import type { Launcher } from '../App';
import type { SessionType } from '../types';
import { getProfile, db, today, uid } from '../db';
import { composeSession } from '../lib/compose';
import { entry } from '../lib/content';
import { Sheet } from '../components/ui';

/**
 * Short, situation-specific tools. Hypnosis tools compose a 3-4 minute session and go through the
 * same Preview/Stop path; waking tools are labelled before they open.
 */

type Tool =
  | { id: string; label: string; when: string; kind: 'session'; sessionType: SessionType; minutes: number; focus?: string }
  | { id: string; label: string; when: string; kind: 'practice'; entryKey: string };

const TOOLS: Tool[] = [
  { id: 't-panic', label: 'Something is frightening me', when: 'Right before or during it', kind: 'session', sessionType: 'fear-screen', minutes: 4 },
  { id: 't-urge', label: 'An urge is here', when: 'Craving, scrolling, reaching for something', kind: 'session', sessionType: 'habit-craving', minutes: 4, focus: 'let the wave rise and come down without acting on it' },
  { id: 't-start', label: "I can't start", when: 'Staring at the task', kind: 'session', sessionType: 'focus-flow', minutes: 3, focus: 'start with the first physical move and nothing else' },
  { id: 't-wired', label: "I'm wired and it's late", when: 'In bed, mind running', kind: 'session', sessionType: 'pre-sleep', minutes: 8 },
  { id: 't-flat', label: 'I need to be the other version of me', when: 'Before something that matters', kind: 'session', sessionType: 'act-as-if', minutes: 5 },
  { id: 't-language', label: 'Language swap', when: 'When you catch a should', kind: 'practice', entryKey: 'original-starter/language-swap' },
  { id: 't-ad', label: 'Ad filter', when: 'After something got you', kind: 'practice', entryKey: 'original-starter/ad-filter' },
];

export default function Toolkits({ ctx }: { ctx: Launcher }) {
  const [practice, setPractice] = useState<string | null>(null);

  const run = async (t: Tool) => {
    if (t.kind === 'practice') { setPractice(t.entryKey); return; }
    const p = await getProfile();
    const plan = composeSession({
      sessionType: t.sessionType, targetMinutes: t.minutes, facts: p.facts, focus: t.focus,
      rationale: `Opened from the toolkit: “${t.label}”.`,
    });
    ctx.launch(plan);
  };

  const e = practice ? entry(practice) : null;

  return (
    <div className="screen">
      <div className="head">
        <button className="btn-text" onClick={() => ctx.go('more')}>← More</button>
        <h1 style={{ marginTop: 12 }}>Toolkits</h1>
        <p>For a specific moment rather than a daily slot. Three to eight minutes each.</p>
      </div>

      <div className="stack">
        {TOOLS.map((t) => (
          <button key={t.id} className="card" onClick={() => run(t)}>
            <div className="row-between">
              <div className="grow">
                <div className="item-title">{t.label}</div>
                <div className="meta" style={{ marginTop: 4 }}>
                  {t.when} · {t.kind === 'session' ? `${t.minutes} min session` : '2 min'}
                </div>
              </div>
              {t.kind === 'practice' && <span className="badge badge-note">not hypnosis</span>}
            </div>
          </button>
        ))}
      </div>

      {e && (
        <Sheet title={e.title} onClose={() => setPractice(null)}>
          <div className="stack-lg">
            <p className="notice">A waking exercise — no induction, no suggestions.</p>
            <p className="serif-lead">{e.body}</p>
            <button
              className="btn btn-block"
              onClick={async () => {
                await db.completions.put({
                  id: uid(), ref: e.key, kind: 'practice', title: e.title, date: today(),
                  started_at: Date.now(), ended_at: Date.now(), seconds: e.duration_sec || 60, finished: true,
                });
                setPractice(null);
              }}
            >
              Done
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
