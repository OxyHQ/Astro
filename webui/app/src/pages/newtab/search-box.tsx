// The search field, and the engine behind it.
//
// Neither the URL nor the list of engines is spelled in this file, which is
// the whole difference from the page it replaces. That one carried a table of
// five providers, kept its own choice in localStorage and submitted an HTML
// form straight at the endpoint — so a browser whose omnibox searched with one
// engine had a new tab page that searched with another, and removing an engine
// in settings changed nothing here. What the page now knows is a query string;
// the browser resolves it against the profile's own default provider and
// navigates the tab itself.

import {ChevronBottom_Stroke2_Corner0_Rounded, MagnifyingGlass_Stroke2_Corner0_Rounded} from '@oxyhq/bloom/icons';
import {useThemeColor} from '@oxyhq/bloom/theme';
import {Text} from '@oxyhq/bloom/typography';
import {useEffect, useRef, useState} from 'react';
import {Pressable, TextInput, View, type TextInput as TextInputRef} from 'react-native';

import {t} from '@astro/platform';

import {search, setDefaultSearchEngine, useNtp} from './ntp-store.ts';

export function SearchBox() {
  const {searchEngines} = useNtp();
  const [query, setQuery] = useState('');
  const [enginesOpen, setEnginesOpen] = useState(false);
  const input = useRef<TextInputRef | null>(null);
  const iconColor = useThemeColor('textSecondary');

  const current = searchEngines.find(engine => engine.isDefault);
  const pinned = current !== undefined && !current.selectable;

  // A document listener, and one of the few places an effect is the right
  // shape: these shortcuts have to fire while the focus is on the body, which
  // no element in this tree receives.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable === true;

      if (event.key === 'Escape') {
        setEnginesOpen(false);
        input.current?.blur();
        return;
      }
      if ((event.key === '/' && !typing) || (event.key === 'k' && (event.metaKey || event.ctrlKey))) {
        event.preventDefault();
        input.current?.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  function submit() {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      return;
    }
    search(trimmed);
  }

  return (
    <View className="w-full gap-2">
      <View className="w-full flex-row items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2">
        <MagnifyingGlass_Stroke2_Corner0_Rounded size="md" fill={iconColor} />
        <TextInput
          ref={input}
          value={query}
          onChangeText={setQuery}
          // The RN prop for "the Enter key committed this", which
          // react-native-web maps onto the DOM keypress. An HTML <form> would
          // be the web-native answer and is not available: this is a
          // react-native-web tree, and a form's default submit navigates.
          onSubmitEditing={submit}
          returnKeyType="search"
          placeholder={t('newtab.search.placeholder')}
          accessibilityLabel={t('newtab.search.placeholder')}
          // autoFocus is what makes Ctrl+T land in the search field. The
          // omnibox still takes the caret first on a browser-created new tab,
          // which is Chromium's own behaviour and deliberately not fought.
          autoFocus
          className="text-body text-foreground min-w-0 flex-1 py-1"
        />

        {searchEngines.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('newtab.search.engine')}
            aria-expanded={enginesOpen}
            disabled={pinned}
            onPress={() => setEnginesOpen(open => !open)}
            className="flex-row items-center gap-1 rounded-radius-max px-2 py-1 hover:bg-fill-hover"
          >
            <Text className="text-bodySmall text-text-secondary">
              {current?.name ?? t('newtab.search.engine')}
            </Text>
            {pinned ? undefined : (
              <ChevronBottom_Stroke2_Corner0_Rounded size="sm" fill={iconColor} />
            )}
          </Pressable>
        ) : undefined}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('newtab.search.submit')}
          onPress={submit}
          className="rounded-radius-max bg-primary px-4 py-2"
        >
          <Text className="text-bodySmall text-onPrimary">
            {t('newtab.search.submit')}
          </Text>
        </Pressable>
      </View>

      {pinned ? (
        <Text className="text-caption text-text-tertiary px-2">
          {t('newtab.search.enginePinned')}
        </Text>
      ) : undefined}

      {enginesOpen ? (
        // In flow rather than floating. An absolutely positioned menu would
        // need measuring, and `onLayout` does not fire for a className'd
        // component on this NativeWind preview's web runtime — so the popup
        // would be placed from a measurement that never arrives.
        <View
          accessibilityRole="menu"
          className="gap-1 rounded-2xl border border-border bg-card p-2"
        >
          {searchEngines.map(engine => (
            <Pressable
              key={engine.id}
              accessibilityRole="menuitem"
              aria-selected={engine.isDefault}
              disabled={!engine.selectable}
              onPress={() => {
                void setDefaultSearchEngine(engine.id);
                setEnginesOpen(false);
              }}
              className={
                engine.isDefault
                  ? 'flex-row items-baseline gap-2 rounded-radius-12 bg-primary-subtle px-3 py-2'
                  : 'flex-row items-baseline gap-2 rounded-radius-12 px-3 py-2 hover:bg-fill-hover'
              }
            >
              <Text className="text-body text-foreground">{engine.name}</Text>
              <Text className="text-caption text-text-tertiary">{engine.keyword}</Text>
            </Pressable>
          ))}
        </View>
      ) : undefined}
    </View>
  );
}
