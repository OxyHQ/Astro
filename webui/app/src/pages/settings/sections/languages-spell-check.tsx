// Spell check.
//
// Two allowlisted preferences and one link. `browser.enable_spellchecking` is
// the master switch and is live; `spellcheck.dictionaries` is the list of
// language codes Hunspell is checking against, allowlisted as a LIST and
// therefore readable here -- but choosing the languages in it means adding and
// removing entries, which upstream does through
// `chrome.languageSettingsPrivate.enableLanguage` / `disableLanguage` rather
// than by writing the list, so the row reports the set instead of editing it.
//
// The third control upstream draws here, the Basic/Enhanced radio over
// `spellcheck.use_spelling_service`, is deliberately absent. It is wrapped in
// `<if expr="_google_chrome">` in `spell_check_page.html`, so Chromium itself
// compiles it out of a non-Google build, and the service behind it authenticates
// with `google_apis::GetAPIKey()`, which Astro ships empty (`gn_args/linux.gn`
// sets `google_api_key = ""`). The preference stays allowlisted and stays
// unwritten.

import {t, usePref} from '@astro/platform';

import {InfoRow} from '../components/info-row.tsx';
import {LinkRow} from '../components/link-row.tsx';
import {RowGroup} from '../components/row-group.tsx';
import {SubpageHeader} from '../components/section-header.tsx';
import {ToggleRow} from '../components/toggle-row.tsx';

export function LanguagesSpellCheckScreen() {
  const dictionaries = usePref('spellcheck.dictionaries');
  const value = dictionaries?.value;
  const codes = Array.isArray(value) ? value.filter(entry => typeof entry === 'string') : undefined;

  return (
    <>
      <SubpageHeader
        title="settings.languages.spellCheck.title"
        backTo="/languages"
        backLabel="settings.nav.languages"
      />

      <RowGroup footer="settings.languages.spellCheck.footer">
        <ToggleRow
          prefKey="browser.enable_spellchecking"
          label="settings.languages.spellCheck.enabled"
          sublabel="settings.languages.spellCheck.enabled.sublabel"
        />
        <InfoRow
          label="settings.languages.spellCheck.dictionaries"
          value={
            codes === undefined
              ? undefined
              : codes.length === 0
                ? t('settings.languages.spellCheck.dictionaries.none')
                : codes.join(', ')
          }
        />
      </RowGroup>

      <RowGroup footer="settings.languages.spellCheck.enhanced.footer">
        <LinkRow
          label="settings.languages.editDictionary.link"
          sublabel="settings.languages.editDictionary.link.sublabel"
          to="/editDictionary"
        />
      </RowGroup>
    </>
  );
}
