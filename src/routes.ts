export const ROUTES = [
  'today', 'library', 'coach', 'journal', 'more',
  'progress', 'profile', 'settings', 'toolkits', 'about',
] as const;

export type Route = (typeof ROUTES)[number];

export const parseHash = (): Route => {
  const h = location.hash.replace(/^#\/?/, '').split('?')[0] as Route;
  return ROUTES.includes(h) ? h : 'today';
};

export const hashParams = () =>
  new URLSearchParams(location.hash.split('?')[1] ?? '');
