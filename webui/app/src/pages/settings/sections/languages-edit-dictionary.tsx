// Custom dictionary.
//
// Still pending, and the reason is precise enough to be worth writing down: the
// whole screen is three calls on ONE API -- `getSpellcheckWords`,
// `addSpellcheckWord` and `removeSpellcheckWord`, plus the
// `onCustomDictionaryChanged` event -- and all four are
// `chrome.languageSettingsPrivate`, not `chrome.settingsPrivate` and not a
// WebUI message handler. There is no preference behind the custom dictionary at
// all: `edit_dictionary_page.html` binds none, and the words live in a
// `SpellcheckCustomDictionary` file the API is the only door to.
//
// That API is granted to this host (see the note at the top of `languages.tsx`)
// but is not part of the app's browser API layer, which this section may not
// edit. Half a screen -- a list with no way to add to it -- would be worse than
// this card: the words are exactly the thing a user comes here to change.

import {PendingScreen} from '../components/pending-screen.tsx';

export function LanguagesEditDictionaryScreen() {
  return (
    <PendingScreen
      title="settings.languages.editDictionary.title"
      backTo="/languages"
      backLabel="settings.nav.languages"
    />
  );
}
