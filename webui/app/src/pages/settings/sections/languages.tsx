// Languages.
//
// Two transports, joined here, and the split is the browser's rather than this
// page's. WHICH languages are enabled, and in what order, is the
// `intl.accept_languages` pref -- allowlisted, so it arrives through
// `chrome.settingsPrivate` carrying its policy metadata. WHAT a language is
// called, and whether a dictionary exists for it, is
// `chrome.languageSettingsPrivate`, which carries no policy metadata at all.
//
// That is why the enforcement check reads the PREF and not the API: an
// organisation that fixes the accepted languages does it by policy on that
// pref, and every write below goes through it, so a managed profile locks the
// whole list from one place. An API-shaped check would have found nothing to
// look at and offered controls the browser then refused.
//
// LanguagesHandler is not a fallback for any of this. `settings_ui.cc` installs
// it only under `IS_CHROMEOS` and `IS_WIN`, so on Linux the handler does not
// exist and its two messages would be a CHECK failure. There is no
// display-language control on this platform for the same reason upstream has
// none.

import {Button, SettingsListItem} from '@oxyhq/bloom';
import {TextFieldInput} from '@oxyhq/bloom';
import {useState} from 'react';
import {View} from 'react-native';

import {
  disableLanguage,
  enableLanguage,
  moveLanguage,
  t,
  useLanguages,
  usePref,
  type LanguageInfo,
} from '@astro/platform';

import {CollapsibleGroup} from '../components/collapsible-group.tsx';
import {InfoRow} from '../components/info-row.tsx';
import {LinkRow} from '../components/link-row.tsx';
import {RowGroup} from '../components/row-group.tsx';
import {SectionHeader} from '../components/section-header.tsx';

/** The pref that holds the enabled codes, comma-joined and in priority order. */
const ACCEPT_LANGUAGES = 'intl.accept_languages';

/** How many un-enabled languages the picker shows before asking for a filter. */
const PICKER_LIMIT = 40;

function LanguageRow({
  language,
  code,
  position,
  total,
  locked,
}: {
  language: LanguageInfo | undefined;
  code: string;
  position: number;
  total: number;
  locked: boolean;
}) {
  // A code with no entry in the browser's own list: the profile carries a
  // language this build does not know. Showing the bare code is the honest
  // answer -- inventing a name would be worse, and hiding the row would make a
  // list the user cannot account for.
  const title = language ? language.displayName : code;
  const native =
    language && language.nativeDisplayName !== language.displayName
      ? language.nativeDisplayName
      : undefined;

  return (
    <SettingsListItem
      title={title}
      description={native}
      value={position === 0 ? t('settings.languages.primary') : undefined}
      showChevron={false}
      rightElement={
        <View className="flex-row items-center gap-1">
          <Button
            variant="text"
            size="small"
            disabled={locked || position === 0}
            onPress={() => moveLanguage(code, 'UP')}
          >
            {t('settings.languages.moveUp')}
          </Button>
          <Button
            variant="text"
            size="small"
            // The browser refuses to leave the list empty: a profile with no
            // accepted language has no UI language to fall back to.
            disabled={locked || total <= 1}
            onPress={() => disableLanguage(code)}
          >
            {t('settings.languages.remove')}
          </Button>
        </View>
      }
    />
  );
}

export function LanguagesSection() {
  const accepted = usePref(ACCEPT_LANGUAGES);
  const known = useLanguages();
  const [filter, setFilter] = useState('');

  const locked = accepted?.enforcement === 'ENFORCED';
  const raw = typeof accepted?.value === 'string' ? accepted.value : undefined;
  const codes = raw === undefined || raw === '' ? [] : raw.split(',');
  const byCode = new Map((known ?? []).map(language => [language.code, language]));

  const query = filter.trim().toLowerCase();
  const addable = (known ?? []).filter(
    language =>
      !codes.includes(language.code) &&
      !language.isProhibitedLanguage &&
      (query === '' ||
        language.displayName.toLowerCase().includes(query) ||
        language.nativeDisplayName.toLowerCase().includes(query) ||
        language.code.toLowerCase().includes(query)),
  );

  return (
    <>
      <SectionHeader
        title="settings.languages.title"
        description="settings.languages.description"
      />

      <RowGroup
        title="settings.languages.group.preferred"
        footer={locked ? 'settings.languages.preferred.locked' : 'settings.languages.preferred.footer'}
      >
        {accepted === undefined || known === undefined ? (
          <InfoRow label="settings.languages.preferred" />
        ) : (
          codes.map((code, index) => (
            <LanguageRow
              key={code}
              code={code}
              language={byCode.get(code)}
              position={index}
              total={codes.length}
              locked={locked}
            />
          ))
        )}
      </RowGroup>

      {locked || known === undefined ? undefined : (
        <CollapsibleGroup title="settings.languages.add">
          <TextFieldInput
            label={t('settings.languages.add.filter')}
            value={filter}
            onChangeText={setFilter}
          />
          <RowGroup
            footer={
              addable.length > PICKER_LIMIT ? 'settings.languages.add.narrow' : undefined
            }
          >
            {/* Capped, and the footer says so when the cap bites. The browser
                knows some six hundred languages; a list that long is not a
                picker, and silently truncating it would be a list that lies
                about what is available. */}
            {addable.slice(0, PICKER_LIMIT).map(language => (
              <SettingsListItem
                key={language.code}
                title={language.displayName}
                description={
                  language.nativeDisplayName === language.displayName
                    ? undefined
                    : language.nativeDisplayName
                }
                showChevron={false}
                rightElement={
                  <Button
                    variant="secondary"
                    size="small"
                    onPress={() => enableLanguage(language.code)}
                  >
                    {t('settings.languages.add.action')}
                  </Button>
                }
              />
            ))}
          </RowGroup>
        </CollapsibleGroup>
      )}

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
