export const ROUTES = [
  'today', 'library', 'coach', 'journal', 'more',
  'progress', 'profile', 'settings', 'toolkits', 'influence', 'views', 'about',
] as const;

export type Route = (typeof ROUTES)[number];

export const parseHash = (): Route => {
  const h = location.hash.replace(/^#\/?/, '').split('?')[0] as Route;
  return ROUTES.includes(h) ? h : 'today';
};

/** Query params after the hash route, e.g. "#/today?swap=1" (used by launcher shortcuts). */
export const hashParams = () =>
  new URLSearchParams(location.hash.split('?')[1] ?? '');
