import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getSettings } from './db';
import type { SessionPlan } from './types';
import { parseHash, type Route } from './routes';
import Nav from './components/Nav';
import Player from './screens/Player';
import Today from './screens/Today';
import Library from './screens/Library';
import Coach from './screens/Coach';
import Journal from './screens/Journal';
import Progress from './screens/Progress';
import More from './screens/More';
import Profile from './screens/Profile';
import SettingsScreen from './screens/SettingsScreen';
import Toolkits from './screens/Toolkits';
import Influence from './screens/Influence';
import Views from './screens/Views';
import About from './screens/About';
import { scheduleToday } from './lib/reminders';

export interface Launcher { launch: (plan: SessionPlan) => void; go: (r: Route) => void }

export default function App() {
  const [route, setRoute] = useState<Route>(parseHash);
  const [plan, setPlan] = useState<SessionPlan | null>(null);
  const settings = useLiveQuery(() => getSettings(), [], undefined);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => { if (settings) scheduleToday(settings); }, [settings]);

  const go = (r: Route) => { location.hash = `#/${r}`; setRoute(r); window.scrollTo(0, 0); };
  const launch = (p: SessionPlan) => setPlan(p);
  const ctx: Launcher = { launch, go };

  if (!settings) return <div className="app" />;

  const tab: Route = ['today', 'library', 'coach', 'journal', 'more'].includes(route)
    ? route
    : route === 'progress' || route === 'profile' ? 'more' : 'more';

  return (
    <div className="app">
      {route === 'today' && <Today ctx={ctx} settings={settings} />}
      {route === 'library' && <Library ctx={ctx} />}
      {route === 'coach' && <Coach ctx={ctx} />}
      {route === 'journal' && <Journal />}
      {route === 'progress' && <Progress ctx={ctx} />}
      {route === 'more' && <More ctx={ctx} />}
      {route === 'profile' && <Profile ctx={ctx} />}
      {route === 'settings' && <SettingsScreen settings={settings} />}
      {route === 'toolkits' && <Toolkits ctx={ctx} />}
      {route === 'influence' && <Influence />}
      {route === 'views' && <Views />}
      {route === 'about' && <About />}

      <Nav route={tab} go={go} />

      {plan && (
        <Player
          plan={plan}
          settings={settings}
          onClose={async (completed) => {
            setPlan(null);
            if (completed) await db.queue.where('id').equals(plan.id).delete();
          }}
        />
      )}
    </div>
  );
}
