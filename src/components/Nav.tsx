import type { Route } from '../routes';

const ICONS: Record<string, JSX.Element> = {
  today: <><circle cx="12" cy="12" r="8.2" /><path d="M12 7.6v4.4l2.8 1.8" /></>,
  library: <><path d="M4.5 5.5h6v13h-6z" /><path d="M13.5 5.5h6v13h-6z" /><path d="M4.5 10h6M13.5 10h6" /></>,
  coach: <><path d="M4.5 12.4a7.5 6.4 0 1 1 3.4 5.3l-3.4.9.9-2.7a6.2 6.2 0 0 1-.9-3.5z" /></>,
  journal: <><path d="M6 4.5h12v15H6z" /><path d="M9 9h6M9 12.5h6M9 16h3" /></>,
  more: <><circle cx="6" cy="12" r="1.1" /><circle cx="12" cy="12" r="1.1" /><circle cx="18" cy="12" r="1.1" /></>,
};

const TABS: { route: Route; label: string; icon: string }[] = [
  { route: 'today', label: 'Today', icon: 'today' },
  { route: 'library', label: 'Library', icon: 'library' },
  { route: 'coach', label: 'Coach', icon: 'coach' },
  { route: 'journal', label: 'Journal', icon: 'journal' },
  { route: 'more', label: 'More', icon: 'more' },
];

export default function Nav({ route, go }: { route: Route; go: (r: Route) => void }) {
  return (
    <nav className="nav">
      {TABS.map((t) => (
        <button
          key={t.route}
          className={`nav-item${route === t.route ? ' on' : ''}`}
          onClick={() => go(t.route)}
          aria-current={route === t.route ? 'page' : undefined}
        >
          <svg viewBox="0 0 24 24">{ICONS[t.icon]}</svg>
          {t.label}
        </button>
      ))}
    </nav>
  );
}
