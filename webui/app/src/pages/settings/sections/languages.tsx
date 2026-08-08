// Languages.
//
// The thinnest section on the page, and the reason is a grant rather than a
// gap. Upstream's languages page is driven almost entirely by
// `chrome.languageSettingsPrivate` -- the language list, the ordering, the
// per-language translate state, the dictionary download status and the custom
// dictionary are all its methods, not preferences. That API IS granted to this
// host (`chrome/common/extensions/api/_api_features.json` lists
// `chrome://settings/*` under a `contexts: ["webui"]` alternative with no
// permission dependency), but it is a DIFFERENT grant from `settingsPrivate`
// and the app's browser API layer does not wrap it yet. Everything that needs
// it is reported rather than offered.
//
// LanguagesHandler is not the fallback it looks like. `settings_ui.cc` installs
// it only under `IS_CHROMEOS` and `IS_WIN`, so on Linux the handler does not
// exist at all and its two messages -- `getProspectiveUILanguage` and
// `setProspectiveUILanguage` -- would be a CHECK failure. There is no
// display-language control on this platform for the same reason upstream has
// none.
//
// What IS reachable through settingsPrivate is the Accept-Language string and
// the spell-check preferences, and those are what this section and its
// spell-check subpage render.

import {usePref} from '@astro/platform';

import {InfoRow} from '../components/info-row.tsx';
import {LinkRow} from '../components/link-row.tsx';
import {RowGroup} from '../components/row-group.tsx';
import {SectionHeader} from '../components/section-header.tsx';

export function LanguagesSection() {
  // `intl.accept_languages` is allowlisted as a STRING and holds the codes
  // comma-joined with no spaces, which is the form the Accept-Language header
  // wants and not the form a person reads.
  const accepted = usePref('intl.accept_languages');
  const codes = typeof accepted?.value === 'string' ? accepted.value : undefined;

  return (
    <>
      <SectionHeader
        title="settings.languages.title"
        description="settings.languages.description"
      />

      <RowGroup
        title="settings.languages.group.preferred"
        footer="settings.languages.preferred.footer"
      >
        <InfoRow
          label="settings.languages.preferred"
          sublabel="settings.languages.preferred.sublabel"
          value={codes === undefined ? undefined : codes.split(',').join(', ')}
        />
      </RowGroup>

      <RowGroup title="settings.languages.group.more" footer="settings.languages.translate.footer">
        <LinkRow
          label="settings.languages.spellCheck.link"
          sublabel="settings.languages.spellCheck.link.sublabel"
          to="/spellCheck"
        />
      </RowGroup>
    </>
  );
}
