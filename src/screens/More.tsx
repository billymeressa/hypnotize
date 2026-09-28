import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Launcher } from '../App';
import { db } from '../db';
import { Glow } from '../components/ui';
import { isStandalone, onInstallAvailable, promptInstall } from '../lib/platform';

const LINKS = [
  { route: 'progress', label: 'Progress', blurb: 'Streak, session history, mood trend' },
  { route: 'profile', label: 'Profile', blurb: 'What the Guide knows about you' },
  { route: 'toolkits', label: 'Quick sessions', blurb: 'Targeted sessions for a specific moment' },
  { route: 'settings', label: 'Settings', blurb: 'Voice, pace, reminders, your data' },
  { route: 'about', label: 'About', blurb: 'Sources and safety information' },
] as const;

export default function More({ ctx }: { ctx: Launcher }) {
  const facts = useLiveQuery(async () => (await db.profile.get('me'))?.facts.length ?? 0, [], 0);
  const [canInstall, setCanInstall] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => onInstallAvailable(setCanInstall), []);
  const showInstall = canInstall && !dismissed && !isStandalone();

  return (
    <div className="screen">
      <div className="head">
        <Glow small />
        <h1 style={{ marginTop: 20, textAlign: 'center' }}>Hypnotize</h1>
        <p style={{ textAlign: 'center', marginTop: 6 }}>
          {facts > 0 ? `${facts} things the Guide knows about you` : 'Your personal hypnosis guide'}
        </p>
      </div>

      {showInstall && (
        <div className="card stack" style={{ marginBottom: 18 }}>
          <div>
            <div className="item-title">Install to your home screen</div>
            <p className="small dim" style={{ margin: '6px 0 0' }}>
              Runs full-screen and works offline. Your data stays on this device.
            </p>
          </div>
          <div className="row">
            <button
              className="btn btn-sm"
              onClick={async () => {
                const outcome = await promptInstall();
                if (outcome !== 'accepted') setDismissed(true);
              }}
            >
              Install
            </button>
            <button className="btn-text" onClick={() => setDismissed(true)}>Not now</button>
          </div>
        </div>
      )}

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
