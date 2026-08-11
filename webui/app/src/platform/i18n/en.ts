// Every string the app renders, in one place.
//
// The browser's own strings live in `.grd` files and reach a WebUI page
// through `loadTimeData`, which is worth bridging only for a page that adopts
// an upstream handler surface wholesale. Astro's pages are its own, so they
// carry their own catalog: a flat record with no runtime lookup table, which
// makes a missing or misspelled id a type error rather than a page that shows
// its own key back to the user.
//
// The settings sections contribute their own catalogues rather than adding to
// the record below. That is not tidiness: settings is filled in section by
// section, often by several people at once, and a single flat file is a file
// every one of them edits. A section owns `sections/<name>.strings.ts`, and
// this file names it once and is never touched again for it.

import {aboutStrings} from '../../pages/settings/sections/about.strings.ts';
import {accessibilityStrings} from '../../pages/settings/sections/accessibility.strings.ts';
// The ad blocker PAGE, which is an entry of its own; the settings section
// about ad blocking is `sections/adblock.strings.ts` below, and the two are
// deliberately separate catalogues because they are separate surfaces.
import {adblockPageStrings} from '../../pages/adblock/adblock.strings.ts';
import {adblockStrings} from '../../pages/settings/sections/adblock.strings.ts';
// The Alia PANEL, which is a page of its own; the settings section about it is
// `alia.strings.ts` below, and the two are deliberately separate catalogues
// because they are separate surfaces.
import {aliaPageStrings} from '../../pages/alia/alia.strings.ts';
import {aliaStrings} from '../../pages/settings/sections/alia.strings.ts';
import {appearanceStrings} from '../../pages/settings/sections/appearance.strings.ts';
import {autofillStrings} from '../../pages/settings/sections/autofill.strings.ts';
import {defaultBrowserStrings} from '../../pages/settings/sections/default-browser.strings.ts';
import {downloadsStrings} from '../../pages/settings/sections/downloads.strings.ts';
import {languagesStrings} from '../../pages/settings/sections/languages.strings.ts';
// The new tab page is not a settings section; it is an entry of its own, so
// its catalogue lives beside its components rather than under sections/.
import {newTabStrings} from '../../pages/newtab/newtab.strings.ts';
import {onStartupStrings} from '../../pages/settings/sections/on-startup.strings.ts';
import {performanceStrings} from '../../pages/settings/sections/performance.strings.ts';
import {privacyStrings} from '../../pages/settings/sections/privacy.strings.ts';
import {resetStrings} from '../../pages/settings/sections/reset.strings.ts';
import {searchStrings} from '../../pages/settings/sections/search.strings.ts';
import {siteSettingsStrings} from '../../pages/settings/sections/site-settings.strings.ts';
import {systemStrings} from '../../pages/settings/sections/system.strings.ts';
// Same reason as the new tab page's: an entry of its own, so its catalogue
// lives beside its components rather than under sections/.
import {whatsNewStrings} from '../../pages/whatsnew/whatsnew.strings.ts';
import {youAndAstroStrings} from '../../pages/settings/sections/you-and-astro.strings.ts';

/**
 * What every page shares: the shell, the search field, and the sentences a
 * pref-bound control says about the policy that is overriding it.
 */
const common = {
  'app.unknownHost.title': 'No Astro page for this address',
  'app.unknownHost.body':
    'The browser served this bundle to a host it does not implement. Either a ' +
    'WebUIConfig is registered for a page that does not exist yet, or this page ' +
    'was removed and its registration was not.',
  'app.devIndex.title': 'Astro pages',
  'app.devIndex.body': 'Development server. Choose a page.',

  'settings.title': 'Settings',

  'settings.group.astro': 'Astro',
  'settings.group.advanced': 'Advanced',

  'settings.search.label': 'Search settings',
  'settings.search.results': 'Search results',
  'settings.search.sectionContext': 'Section',
  'settings.search.none': 'Nothing in this page matches "{query}".',
  'settings.search.noSection': 'No section matches.',

  'settings.backTo': 'Back to {section}',

  'settings.notBuilt':
    'This screen is part of the browser but is not built into this page yet, ' +
    'so nothing here is editable. It is listed rather than hidden so the page ' +
    'does not imply it covers more than it does.',

  'pref.unavailable': 'Not available in this profile',
  'pref.pending': 'Not reported yet',
  'pref.enforced': 'Managed by your organisation',
  'pref.enforcedBy': 'Managed by {controller}',
  'pref.recommendedOn': 'Your organisation recommends this setting on',
  'pref.recommendedOff': 'Your organisation recommends this setting off',
  'pref.recommendedValue': 'Your organisation recommends {value}',
} as const;

export const en = {
  ...common,
  ...aboutStrings,
  ...accessibilityStrings,
  ...adblockPageStrings,
  ...adblockStrings,
  ...aliaPageStrings,
  ...aliaStrings,
  ...appearanceStrings,
  ...autofillStrings,
  ...defaultBrowserStrings,
  ...downloadsStrings,
  ...languagesStrings,
  ...newTabStrings,
  ...onStartupStrings,
  ...performanceStrings,
  ...privacyStrings,
  ...resetStrings,
  ...searchStrings,
  ...siteSettingsStrings,
  ...systemStrings,
  ...whatsNewStrings,
  ...youAndAstroStrings,
} as const;

export type MessageId = keyof typeof en;
