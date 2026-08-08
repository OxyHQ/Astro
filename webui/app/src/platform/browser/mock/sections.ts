// Every section's dev fixtures, collected. DEV ONLY -- see ./state.ts.
//
// The one place that knows the whole set. Written once, in the commit that
// created the sections, and never edited to fill one in: a section contributes
// by editing its OWN `sections/<name>.fixtures.ts`, which is the point of the
// split (see ./fixtures.ts).
//
// A section is named here whether or not it has any fixtures yet. An empty
// contribution costs an import; a MISSING one costs a section whose fixtures
// were written, committed, and silently never loaded.

import {mergeUnique, type HandlerAction, type HandlerReply, type SectionFixtures} from './fixtures.ts';
import type {Pref} from '../settings-private.ts';

import {aboutFixtures} from '../../../pages/settings/sections/about.fixtures.ts';
import {accessibilityFixtures} from '../../../pages/settings/sections/accessibility.fixtures.ts';
import {adblockFixtures} from '../../../pages/settings/sections/adblock.fixtures.ts';
import {aliaFixtures} from '../../../pages/settings/sections/alia.fixtures.ts';
import {appearanceFixtures} from '../../../pages/settings/sections/appearance.fixtures.ts';
import {autofillFixtures} from '../../../pages/settings/sections/autofill.fixtures.ts';
import {defaultBrowserFixtures} from '../../../pages/settings/sections/default-browser.fixtures.ts';
import {downloadsFixtures} from '../../../pages/settings/sections/downloads.fixtures.ts';
import {languagesFixtures} from '../../../pages/settings/sections/languages.fixtures.ts';
import {onStartupFixtures} from '../../../pages/settings/sections/on-startup.fixtures.ts';
import {performanceFixtures} from '../../../pages/settings/sections/performance.fixtures.ts';
import {privacyFixtures} from '../../../pages/settings/sections/privacy.fixtures.ts';
import {resetFixtures} from '../../../pages/settings/sections/reset.fixtures.ts';
import {searchFixtures} from '../../../pages/settings/sections/search.fixtures.ts';
import {siteSettingsFixtures} from '../../../pages/settings/sections/site-settings.fixtures.ts';
import {systemFixtures} from '../../../pages/settings/sections/system.fixtures.ts';
import {youAndAstroFixtures} from '../../../pages/settings/sections/you-and-astro.fixtures.ts';

/** Section id and contribution, so a collision can name who declared it twice. */
const CONTRIBUTIONS: readonly (readonly [string, SectionFixtures])[] = [
  ['appearance', appearanceFixtures],
  ['search', searchFixtures],
  ['privacy', privacyFixtures],
  ['siteSettings', siteSettingsFixtures],
  ['autofill', autofillFixtures],
  ['onStartup', onStartupFixtures],
  ['downloads', downloadsFixtures],
  ['defaultBrowser', defaultBrowserFixtures],
  ['youAndAstro', youAndAstroFixtures],
  ['adblock', adblockFixtures],
  ['alia', aliaFixtures],
  ['performance', performanceFixtures],
  ['languages', languagesFixtures],
  ['accessibility', accessibilityFixtures],
  ['system', systemFixtures],
  ['reset', resetFixtures],
  ['about', aboutFixtures],
];

/**
 * Every pref the dev browser serves.
 *
 * Refuses a key two sections both declare, for the same reason the handler
 * merge does: last-wins would leave one section's control rendering from a
 * value it did not write, with nothing to say why.
 */
export function fixturePrefs(): readonly Pref[] {
  const byKey = new Map<string, string>();
  const prefs: Pref[] = [];
  for (const [section, fixtures] of CONTRIBUTIONS) {
    for (const pref of fixtures.prefs ?? []) {
      const owner = byKey.get(pref.key);
      if (owner !== undefined) {
        throw new Error(
          `dev fixtures: pref "${pref.key}" is declared by both the ${owner} and ` +
            `${section} sections. One of them owns it; delete the other.`,
        );
      }
      byKey.set(pref.key, section);
      prefs.push(pref);
    }
  }
  return prefs;
}

/** Every handler message the dev browser answers. */
export function fixtureReplies(): Record<string, HandlerReply> {
  return mergeUnique(
    'handler message',
    CONTRIBUTIONS.map(([section, fixtures]) => [section, fixtures.replies ?? {}] as const),
  );
}

/** Every handler message the dev browser accepts without answering. */
export function fixtureActions(): Record<string, HandlerAction> {
  return mergeUnique(
    'handler message',
    CONTRIBUTIONS.map(([section, fixtures]) => [section, fixtures.actions ?? {}] as const),
  );
}
