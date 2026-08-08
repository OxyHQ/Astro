// What a section declares its search field can find.
//
// A section's `*.strings.ts` exports the controls it renders, and the page's
// registry reads that list to build the search index. The list used to be flat
// message ids, and every hit built from one carried the SECTION's fragment --
// so a control that lives one level down was either unfindable or, worse,
// found and then not on the screen the hit opened. `Secure DNS` is on
// `/security`, the time range is on `/clearBrowserData`, five font families
// are on `/fonts`; the hit landed on `/privacy` and `/appearance` and left the
// user to go looking.
//
// An entry may now name the screen it renders on. The bare-id form still means
// "on the section's own screen", which is what most controls are -- that is
// why this could be added without rewriting seventeen strings modules in one
// go, and why a section that grows a subpage control does not have to touch
// any file but its own.

import type {MessageId} from '@astro/platform';

/**
 * One thing the search field can find inside a section.
 *
 * The object form names the FRAGMENT the control is rendered on. It must be a
 * fragment the control's own section routes -- the section's path, one of its
 * aliases, or one of its subpages -- and
 * `tools/tests/cases/settings-controls-name-a-routed-screen.sh` fails the build
 * when it is not. The failure that gate prevents is a silent one: a fragment
 * nothing claims resolves to the DEFAULT section, so a mistyped `on` sends
 * someone searching for a privacy setting to the appearance page, and nothing
 * anywhere reports an error.
 */
export type SettingsControl = MessageId | {readonly id: MessageId; readonly on: string};

/** The message id, whichever form the entry was written in. */
export function controlId(control: SettingsControl): MessageId {
  return typeof control === 'string' ? control : control.id;
}

/** The fragment a hit on this control opens; the section's own by default. */
export function controlPath(control: SettingsControl, sectionPath: string): string {
  return typeof control === 'string' ? sectionPath : control.on;
}
