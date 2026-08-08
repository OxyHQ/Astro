// Spell check.
//
// Two allowlisted preferences and one link. `browser.enable_spellchecking` is
// the master switch and is live; `spellcheck.dictionaries` is the list of
// language codes Hunspell is checking against, allowlisted as a LIST and
// therefore readable here -- but choosing the languages in it means adding and
// removing entries, which upstream does through
// `chrome.languageSettingsPrivate.enableLanguage` / `disableLanguage` rather
// than by writing the list, so the set is edited on the Languages screen and
// reported here.
//
// What each dictionary is CALLED, and whether it has finished downloading, come
// from that same API: the pref holds bare codes, and `en-GB` on its own is not
// a thing to show a person. A dictionary that is still downloading spell-checks
// nothing yet, which is a state worth saying out loud rather than showing an
// enabled-looking row that quietly does not work.
//
// The third control upstream draws here, the Basic/Enhanced radio over
// `spellcheck.use_spelling_service`, is deliberately absent. It is wrapped in
// `<if expr="_google_chrome">` in `spell_check_page.html`, so Chromium itself
// compiles it out of a non-Google build, and the service behind it authenticates
// with `google_apis::GetAPIKey()`, which Astro ships empty (`gn_args/linux.gn`
// sets `google_api_key = ""`). The preference stays allowlisted and stays
// unwritten.

import {
  t,
  useCustomWords,
  useDictionaryStatuses,
  useLanguages,
  usePref,
} from '@astro/platform';

import {InfoRow} from '../components/info-row.tsx';
import {LinkRow} from '../components/link-row.tsx';
import {RowGroup} from '../components/row-group.tsx';
import {SubpageHeader} from '../components/section-header.tsx';
import {ToggleRow} from '../components/toggle-row.tsx';

export function LanguagesSpellCheckScreen() {
  const dictionaries = usePref('spellcheck.dictionaries');
  const value = dictionaries?.value;
  const codes = Array.isArray(value) ? value.filter(entry => typeof entry === 'string') : undefined;
  const known = useLanguages();
  const statuses = useDictionaryStatuses();
  const words = useCustomWords();

  const byCode = new Map((known ?? []).map(language => [language.code, language]));
  const statusFor = (code: string): string | undefined => {
    const status = (statuses ?? []).find(entry => entry.languageCode === code);
    if (!status) {
      return undefined;
    }
    if (status.downloadFailed === true) {
      return t('settings.languages.spellCheck.dictionary.failed');
    }
    if (status.isDownloading === true) {
      return t('settings.languages.spellCheck.dictionary.downloading');
    }
    return status.isReady ? undefined : t('settings.languages.spellCheck.dictionary.notReady');
  };

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
        {codes === undefined ? (
          <InfoRow label="settings.languages.spellCheck.dictionaries" />
        ) : codes.length === 0 ? (
          <InfoRow
            label="settings.languages.spellCheck.dictionaries"
            value={t('settings.languages.spellCheck.dictionaries.none')}
          />
        ) : (
          codes.map(code => (
            <InfoRow
              key={code}
              label="settings.languages.spellCheck.dictionary"
              value={byCode.get(code)?.displayName ?? code}
              sublabel={undefined}
            />
          ))
        )}
      </RowGroup>

      {codes !== undefined && codes.some(code => statusFor(code) !== undefined) ? (
        <RowGroup title="settings.languages.spellCheck.downloads">
          {codes
            .filter(code => statusFor(code) !== undefined)
            .map(code => (
              <InfoRow
                key={code}
                label="settings.languages.spellCheck.dictionary"
                value={`${byCode.get(code)?.displayName ?? code} \u2014 ${statusFor(code) ?? ''}`}
              />
            ))}
        </RowGroup>
      ) : undefined}

      <RowGroup footer="settings.languages.spellCheck.enhanced.footer">
        <LinkRow
          label="settings.languages.editDictionary.link"
          sublabel="settings.languages.editDictionary.link.sublabel"
          value={words === undefined ? undefined : String(words.length)}
          to="/editDictionary"
        />
      </RowGroup>
    </>
  );
}
