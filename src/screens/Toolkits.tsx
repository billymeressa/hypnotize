import type { Launcher } from '../App';
import type { SessionType } from '../types';
import { getProfile } from '../db';
import { composeSession } from '../lib/compose';

type Tool = {
  id: string;
  label: string;
  when: string;
  sessionType: SessionType;
  minutes: number;
  focus?: string;
};

const TOOLS: Tool[] = [
  { id: 't-panic',    label: 'Something is frightening me',      when: 'Right before or during it',                sessionType: 'fear-screen',    minutes: 4 },
  { id: 't-urge',     label: 'An urge is pulling at me',          when: 'Craving, reaching, wanting to escape',     sessionType: 'habit-craving',  minutes: 4, focus: 'let the wave rise and come down without acting on it' },
  { id: 't-start',    label: "I can't start",                      when: 'Staring at the task',                       sessionType: 'focus-flow',     minutes: 3, focus: 'start with the first physical move and nothing else' },
  { id: 't-wired',    label: "I'm wired and it's late",            when: 'In bed, mind running',                      sessionType: 'pre-sleep',      minutes: 8 },
  { id: 't-flat',     label: 'I need to be the other version of me', when: 'Before something that matters',          sessionType: 'act-as-if',      minutes: 5 },
  { id: 't-clarity',  label: 'I know what I want but keep drifting', when: 'When the goal feels abstract',          sessionType: 'goal-clarity',   minutes: 6 },
];

export default function Toolkits({ ctx }: { ctx: Launcher }) {
  const run = async (t: Tool) => {
    const p = await getProfile();
    const plan = composeSession({
      sessionType: t.sessionType,
      targetMinutes: t.minutes,
      facts: p.facts,
      focus: t.focus,
      rationale: `Opened from Quick sessions: "${t.label}".`,
    });
    ctx.launch(plan);
  };

  return (
    <div className="screen">
      <div className="head">
        <button className="btn-text" onClick={() => (location.hash = '#/more')}>← More</button>
        <h1 style={{ marginTop: 12 }}>Quick sessions</h1>
        <p>Targeted hypnosis for a specific moment. Three to eight minutes each.</p>
      </div>

      <div className="stack">
        {TOOLS.map((t) => (
          <button key={t.id} className="card" onClick={() => void run(t)}>
            <div className="grow">
              <div className="item-title">{t.label}</div>
              <div className="meta" style={{ marginTop: 4 }}>{t.when} · {t.minutes} min</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
