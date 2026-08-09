// How every transport in this directory is resolved.
//
// The rule, in order:
//
//   1. If the real browser API is on the page, use it.
//   2. Otherwise, in a dev server run (`import.meta.env.DEV`), dynamically
//      import the mock beside it.
//   3. Otherwise, throw -- naming the API and how a page is supposed to be
//      granted it.
//
// Step 3 is not a formality. Each of these APIs is granted to a page by
// something outside the page: a URL pattern in the extension feature files, a
// Mojo binder registered by the page's C++ controller. When a grant does not
// match, the API is simply absent -- so a soft fallback would render every
// control at its default value and look like the browser's own state. The
// throw is what keeps "this page was served without its grants" from
// presenting as "you have no search engines".
//
// Step 1 is a FEATURE DETECTION, never a guess at the environment. For an
// extension API that is the API object itself (`chrome.settingsPrivate`); for
// Mojo it is the `Mojo` global, which a renderer installs only for a page whose
// controller enabled Mojo bindings. Neither the URL, nor the user agent, nor
// `import.meta.env` can answer the question those answer -- a production bundle
// opened from a file, a dev server reached over the network and a page served
// under the wrong host all look like a browser and have none of the grants.
//
// There is deliberately NO shared helper that performs steps 1-3 for a caller.
// The dynamic `import()` of a mock has to sit literally inside the
// `import.meta.env.DEV` branch at the call site: Vite replaces that expression
// with `false` in a build, the branch is eliminated, and the mock chunk is
// never emitted. Passing `() => import('./mock/x.ts')` into a helper keeps the
// import reachable from a live argument, and the mock -- fixtures, fake policy
// states and all -- ships inside the browser binary. Two call sites of five
// lines each is the price of that guarantee.

/** Thrown when a browser API a page depends on was not granted to its origin. */
export class MissingBrowserApiError extends Error {
  constructor(api: string, grant: string) {
    super(`${api} is unavailable on ${location.origin}. ${grant}`);
    this.name = 'MissingBrowserApiError';
  }
}
