export const ROUTES = [
  'today', 'library', 'coach', 'journal', 'more',
  'progress', 'profile', 'settings', 'toolkits', 'influence', 'views', 'about',
] as const;

export type Route = (typeof ROUTES)[number];

export const parseHash = (): Route => {
  const h = location.hash.replace(/^#\/?/, '') as Route;
  return ROUTES.includes(h) ? h : 'today';
};
