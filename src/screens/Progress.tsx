import { useLiveQuery } from 'dexie-react-hooks';
import type { Launcher } from '../App';
import { db } from '../db';
import { minutesThisWeek, moodShift, moodTrend, streak, totalMinutes } from '../lib/stats';
import { Sparkline } from '../components/ui';

/** Deliberately a few numbers, not a dashboard. No graphs of adherence, no scores. */
export default function Progress({ ctx }: { ctx: Launcher }) {
  const completions = useLiveQuery(() => db.completions.toArray(), [], []);
  const sessions = completions.filter((c) => c.kind === 'session');
  const shift = moodShift(completions);
  const trend = moodTrend(completions);

  return (
    <div className="screen">
      <div className="head">
        <button className="btn-text" onClick={() => ctx.go('more')}>← More</button>
        <h1 style={{ marginTop: 12 }}>Progress</h1>
        <p>Repetition is the mechanism. These numbers are here to show it's happening, not to score you.</p>
      </div>

      <div className="stat-row" style={{ marginBottom: 26 }}>
        <div className="card stat">
          <div className="stat-n">{streak(completions)}</div>
          <div className="stat-l">day streak</div>
        </div>
        <div className="card stat">
          <div className="stat-n">{totalMinutes(completions)}</div>
          <div className="stat-l">minutes</div>
        </div>
        <div className="card stat">
          <div className="stat-n">{sessions.length}</div>
          <div className="stat-l">sessions</div>
        </div>
      </div>

      <div className="card stack" style={{ marginBottom: 26 }}>
        <div className="row-between">
          <p className="eyebrow">Mood, last 14 days</p>
          <span className="meta">after sessions</span>
        </div>
        <Sparkline values={trend} />
        <p className="small dim" style={{ margin: 0 }}>
          {shift == null
            ? 'A few more rated sessions and a before/after difference will show here.'
            : shift > 0
              ? `Sessions leave you about ${shift} points better on a 5-point scale, on average.`
              : shift === 0
                ? 'No average change before to after so far. Worth noting which session types do more.'
                : `Sessions currently average ${shift} — worth changing what you're running, or when.`}
        </p>
      </div>

      <div className="card stack">
        <p className="eyebrow">This week</p>
        <p style={{ margin: 0 }}>{minutesThisWeek(completions)} minutes across {completions.filter((c) => c.started_at > Date.now() - 7 * 86400000).length} items.</p>
        {completions.some((c) => !c.finished) && (
          <p className="small dim" style={{ margin: 0 }}>
            {completions.filter((c) => !c.finished).length} stopped early — those count too.
          </p>
        )}
      </div>
    </div>
  );
}
