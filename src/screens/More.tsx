import { useLiveQuery } from 'dexie-react-hooks';
import type { Launcher } from '../App';
import { db } from '../db';
import { CONTENT_STATS } from '../lib/content';
import { Glow } from '../components/ui';

const LINKS = [
  { route: 'progress', label: 'Progress', blurb: 'Streak, minutes, mood trend' },
  { route: 'profile', label: 'Profile', blurb: 'What the Guide knows about you' },
  { route: 'toolkits', label: 'Toolkits', blurb: 'Short tools for a specific moment' },
  { route: 'influence', label: 'Influence literacy', blurb: 'How suggestion works, including here' },
  { route: 'views', label: "Teacher's views", blurb: 'Source claims, kept separate' },
  { route: 'settings', label: 'Settings', blurb: 'Voice, pace, reminders, your data' },
  { route: 'about', label: 'About', blurb: 'What this is and is not' },
] as const;

export default function More({ ctx }: { ctx: Launcher }) {
  const facts = useLiveQuery(async () => (await db.profile.get('me'))?.facts.length ?? 0, [], 0);

  return (
    <div className="screen">
      <div className="head">
        <Glow small />
        <h1 style={{ marginTop: 20, textAlign: 'center' }}>Hypnotize</h1>
        <p style={{ textAlign: 'center' }}>
          {CONTENT_STATS.approved} approved library entries · {facts} profile facts
        </p>
      </div>

      <div className="stack">
        {LINKS.map((l) => (
          <button key={l.route} className="card" onClick={() => ctx.go(l.route)}>
            <div className="row-between">
              <div>
                <div className="item-title">{l.label}</div>
                <div className="meta" style={{ marginTop: 4 }}>{l.blurb}</div>
              </div>
              <span className="faint">→</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
