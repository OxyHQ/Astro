// Where a page can send the browser.
//
// A route is named, never built. Concatenating a host onto a scheme is how a
// page ends up navigating to `chrome://` after the browser's scheme became
// `astro://`, or to a host nothing serves -- and neither shows up until
// someone clicks the row.
//
// The URLs here are SCHEME-RELATIVE (`//settings/`). That is Chromium's own
// supported form for a WebUI resource and it resolves against whatever scheme
// the page is being served under, so the same table is correct before and
// after the scheme rename. No scheme literal appears in this app at all.

/** Every surface this app serves. Adding an entry means adding a page. */
export const ROUTES = {
  settings: {host: 'settings', title: 'Settings'},
  newTab: {host: 'astro-ntp', title: 'New tab'},
  alia: {host: 'alia', title: 'Alia'},
  adBlock: {host: 'adblock', title: 'Ad blocker'},
  whatsNew: {host: 'whats-new', title: "What's new"},
} as const;

export type RouteId = keyof typeof ROUTES;

/**
 * The URL for a route.
 *
 * On the dev server there is one origin and no WebUI hosts, so a route is the
 * first path segment instead -- the same key `main.tsx` resolves a page from.
 */
export function hrefFor(route: RouteId): string {
  const {host} = ROUTES[route];
  return import.meta.env.DEV ? `/${host}` : `//${host}/`;
}

export function navigateTo(route: RouteId): void {
  location.assign(hrefFor(route));
}
