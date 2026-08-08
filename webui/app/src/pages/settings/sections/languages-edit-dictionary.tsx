// Custom dictionary -- the words the user told Astro to stop underlining.
//
// The one screen on this page with no preference behind it at all. The words
// live in a `SpellcheckCustomDictionary` file and
// `chrome.languageSettingsPrivate` is the only door to them:
// `getSpellcheckWords`, `addSpellcheckWord`, `removeSpellcheckWord`, and
// `onCustomDictionaryChanged` to hear about a change made in another tab or by
// the context menu's "Add to dictionary".
//
// The list is never edited locally. A word is sent, the browser applies it and
// reports back through the observer, and that echo is what moves the store --
// the same rule every other control on this page follows, and the reason two
// settings tabs cannot drift apart.

import {Button, TextFieldInput} from '@oxyhq/bloom';
import {Text} from '@oxyhq/bloom/typography';
import {useState} from 'react';
import {View} from 'react-native';

import {
  SectionCard,
  addCustomWord,
  removeCustomWord,
  t,
  useCustomWords,
  usePref,
} from '@astro/platform';

import {RowGroup} from '../components/row-group.tsx';
import {SubpageHeader} from '../components/section-header.tsx';
import {SettingsListItem} from '@oxyhq/bloom';

export function LanguagesEditDictionaryScreen() {
  const words = useCustomWords();
  // Spell check off means the dictionary is inert. The words are still there
  // and still worth showing; what changes is the sentence at the foot, so the
  // screen does not look broken to someone who turned the feature off.
  const enabled = usePref('browser.enable_spellchecking');
  const [draft, setDraft] = useState('');

  const trimmed = draft.trim();
  const duplicate = trimmed !== '' && (words ?? []).includes(trimmed);
  const add = (): void => {
    if (trimmed === '' || duplicate) {
      return;
    }
    addCustomWord(trimmed);
    setDraft('');
  };

  return (
    <>
      <SubpageHeader
        title="settings.languages.editDictionary.title"
        description="settings.languages.editDictionary.description"
        backTo="/languages"
        backLabel="settings.nav.languages"
      />

      <SectionCard title={t('settings.languages.editDictionary.add')}>
        <View className="flex-row items-end gap-2">
          <View className="flex-1">
            <TextFieldInput
              label={t('settings.languages.editDictionary.add')}
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={add}
            />
          </View>
          <Button variant="primary" size="medium" disabled={trimmed === '' || duplicate} onPress={add}>
            {t('settings.languages.editDictionary.addAction')}
          </Button>
        </View>
        {duplicate ? (
          <Text className="text-bodySmall text-text-secondary">
            {t('settings.languages.editDictionary.duplicate', {word: trimmed})}
          </Text>
        ) : undefined}
      </SectionCard>

      {words === undefined ? (
        <SectionCard>
          <Text className="text-body text-text-secondary">{t('pref.pending')}</Text>
        </SectionCard>
      ) : words.length === 0 ? (
        <SectionCard>
          <Text className="text-body text-text-secondary">
            {t('settings.languages.editDictionary.empty')}
          </Text>
        </SectionCard>
      ) : (
        <RowGroup
          footer={
            enabled?.value === false
              ? 'settings.languages.editDictionary.inert'
              : 'settings.languages.editDictionary.footer'
          }
        >
          {words.map(word => (
            <SettingsListItem
              key={word}
              title={word}
              showChevron={false}
              rightElement={
                <Button variant="text" size="small" onPress={() => removeCustomWord(word)}>
                  {t('settings.languages.editDictionary.remove')}
                </Button>
              }
            />
          ))}
        </RowGroup>
      )}
    </>
  );
}
