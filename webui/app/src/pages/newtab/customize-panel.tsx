// Customizing the new tab page, from the new tab page.
//
// These controls EXISTED in the page this replaces and could not be reached.
// Its markup carried the whole panel — wallpaper, engine, seven widget
// toggles, a link editor, a temperature unit — and the two buttons that were
// supposed to open it (`Settings` in the rail, `Edit` on the links card) both
// navigated to chrome://settings instead, which had no new-tab controls
// either. So the browser shipped with its widget prefs registered, watched,
// pushed to the page live, and adjustable by nobody.
//
// It is here rather than in settings because a second grant is a real cost:
// astro_ntp.mojom is bound by this page and no other, and moving these
// controls to astro://settings would mean handing the settings page the new
// tab page's whole data plane to draw seven switches.
//
// Reordering is buttons, not drag. The gesture is the one thing that did not
// survive the port, and not for want of trying: react-native-web forwards no
// HTML5 drag props, and `onLayout` never fires for a className'd component on
// this NativeWind preview's web runtime, so the measurement a pointer-driven
// drag needs does not arrive. Buttons are also the only version of this that
// was ever reachable from a keyboard — the drag had no keyboard path at all.

import {
  PlusLarge_Stroke2_Corner0_Rounded,
  Trash_Stroke2_Corner0_Rounded,
} from '@oxyhq/bloom/icons';
import {useThemeColor} from '@oxyhq/bloom/theme';
import {Switch} from '@oxyhq/bloom/switch';
import {Text} from '@oxyhq/bloom/typography';
import {useState, type ReactNode} from 'react';
import {Pressable, ScrollView, TextInput, View} from 'react-native';

import {t, type MessageId} from '@astro/platform';

import {
  addQuickLink,
  moveWidget,
  removeQuickLink,
  setDefaultSearchEngine,
  setWidgetVisible,
  updateQuickLink,
  useNtp,
  type QuickLink,
  type WidgetId,
} from './ntp-store.ts';

const WIDGET_LABELS: Readonly<Record<WidgetId, MessageId>> = {
  weather: 'newtab.widget.weather',
  clock: 'newtab.widget.clock',
  quickLinks: 'newtab.widget.quickLinks',
  notes: 'newtab.widget.notes',
  discover: 'newtab.widget.discover',
  alia: 'newtab.widget.alia',
  sites: 'newtab.widget.sites',
};

function PanelSection({
  title,
  hint,
  children,
}: {
  title: MessageId;
  hint: MessageId;
  children: ReactNode;
}) {
  return (
    <View className="gap-3">
      <View className="gap-1">
        <Text className="text-bodyTitleSmall text-foreground">{t(title)}</Text>
        <Text className="text-caption text-text-tertiary">{t(hint)}</Text>
      </View>
      {children}
    </View>
  );
}

/**
 * One editable link.
 *
 * Committed on blur rather than on every keystroke, because a URL is invalid
 * for most of the time it is being typed and the browser answers a refusal by
 * storing nothing — a per-keystroke commit would spend the whole edit in the
 * rejected state.
 */
function LinkRow({index, link}: {index: number; link: QuickLink}) {
  const [title, setTitle] = useState(link.title);
  const [url, setUrl] = useState(link.url);
  const [rejected, setRejected] = useState(false);
  const iconColor = useThemeColor('textSecondary');

  function commit() {
    if (title === link.title && url === link.url) {
      return;
    }
    void updateQuickLink(index, title, url).then(accepted => {
      setRejected(!accepted);
      if (!accepted) {
        // Back to what the browser actually holds. Leaving the refused text in
        // the field would show a link the page does not have.
        setTitle(link.title);
        setUrl(link.url);
      }
    });
  }

  return (
    <View className="gap-1">
      <View className="flex-row items-center gap-2">
        <TextInput
          value={title}
          onChangeText={setTitle}
          onBlur={commit}
          accessibilityLabel={t('newtab.customize.linkTitle')}
          placeholder={t('newtab.customize.linkTitle')}
          className="text-bodySmall text-foreground w-32 rounded-radius-12 border border-border px-3 py-2"
        />
        <TextInput
          value={url}
          onChangeText={setUrl}
          onBlur={commit}
          accessibilityLabel={t('newtab.customize.linkUrl')}
          placeholder={t('newtab.customize.linkUrl')}
          className="text-bodySmall text-foreground min-w-0 flex-1 rounded-radius-12 border border-border px-3 py-2"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('newtab.customize.linkRemove', {title: link.title})}
          onPress={() => removeQuickLink(index)}
          className="rounded-radius-max p-2 hover:bg-fill-hover"
        >
          <Trash_Stroke2_Corner0_Rounded size="sm" fill={iconColor} />
        </Pressable>
      </View>
      {rejected ? (
        <Text className="text-caption text-destructive">
          {t('newtab.customize.linkRejected')}
        </Text>
      ) : undefined}
    </View>
  );
}

function AddLinkRow() {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [rejected, setRejected] = useState(false);
  const iconColor = useThemeColor('primary');

  return (
    <View className="gap-1">
      <View className="flex-row items-center gap-2">
        <TextInput
          value={title}
          onChangeText={setTitle}
          accessibilityLabel={t('newtab.customize.linkTitle')}
          placeholder={t('newtab.customize.linkTitle')}
          className="text-bodySmall text-foreground w-32 rounded-radius-12 border border-border border-dashed px-3 py-2"
        />
        <TextInput
          value={url}
          onChangeText={setUrl}
          accessibilityLabel={t('newtab.customize.linkUrl')}
          placeholder="https://"
          className="text-bodySmall text-foreground min-w-0 flex-1 rounded-radius-12 border border-border border-dashed px-3 py-2"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('newtab.customize.linkAdd')}
          onPress={() => {
            void addQuickLink(title.trim() || url, url.trim()).then(accepted => {
              setRejected(!accepted);
              if (accepted) {
                setTitle('');
                setUrl('');
              }
            });
          }}
          className="rounded-radius-max p-2 hover:bg-fill-hover"
        >
          <PlusLarge_Stroke2_Corner0_Rounded size="sm" fill={iconColor} />
        </Pressable>
      </View>
      {rejected ? (
        <Text className="text-caption text-destructive">
          {t('newtab.customize.linkRejected')}
        </Text>
      ) : undefined}
    </View>
  );
}

export function CustomizePanel({onClose}: {onClose: () => void}) {
  const {widgets, quickLinks, searchEngines} = useNtp();

  return (
    // A scrim over the page, dismissable by clicking away from the panel. Not
    // Bloom's Dialog: this panel is the page's own surface rather than a
    // modal decision, and it stays open while the grid behind it visibly
    // rearranges — which is the point of the reorder buttons.
    <View className="absolute inset-0 z-10 flex-row justify-end">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('newtab.customize.close')}
        onPress={onClose}
        className="flex-1 bg-black/30"
      />
      <View className="h-full w-full max-w-md border-l border-border bg-background">
        <View className="h-16 shrink-0 flex-row items-center justify-between border-b border-border px-4">
          <Text className="text-headerBold text-foreground">
            {t('newtab.customize.title')}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            className="rounded-radius-max px-3 py-2 hover:bg-fill-hover"
          >
            <Text className="text-bodySmall text-primary">
              {t('newtab.customize.close')}
            </Text>
          </Pressable>
        </View>

        <ScrollView className="flex-1" contentContainerClassName="gap-6 p-4">
          <PanelSection title="newtab.customize.widgets" hint="newtab.customize.widgetsHint">
            {widgets.map((widget, index) => (
              <View key={widget.id} className="flex-row items-center gap-2">
                <Text className="text-body text-foreground flex-1">
                  {t(WIDGET_LABELS[widget.id])}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('newtab.customize.moveUp', {
                    widget: t(WIDGET_LABELS[widget.id]),
                  })}
                  disabled={index === 0}
                  onPress={() => moveWidget(widgets, widget.id, -1)}
                  className="rounded-radius-max px-2 py-1 hover:bg-fill-hover"
                >
                  <Text className="text-body text-text-secondary">↑</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('newtab.customize.moveDown', {
                    widget: t(WIDGET_LABELS[widget.id]),
                  })}
                  disabled={index === widgets.length - 1}
                  onPress={() => moveWidget(widgets, widget.id, 1)}
                  className="rounded-radius-max px-2 py-1 hover:bg-fill-hover"
                >
                  <Text className="text-body text-text-secondary">↓</Text>
                </Pressable>
                <Switch
                  value={widget.visible}
                  onValueChange={(next: boolean) => setWidgetVisible(widget.id, next)}
                />
              </View>
            ))}
          </PanelSection>

          <PanelSection title="newtab.customize.links" hint="newtab.customize.linksHint">
            {quickLinks.map((link, index) => (
              <LinkRow key={`${index}:${link.url}`} index={index} link={link} />
            ))}
            {quickLinks.length < 8 ? <AddLinkRow /> : undefined}
          </PanelSection>

          <PanelSection title="newtab.customize.engines" hint="newtab.customize.enginesHint">
            {searchEngines.map(engine => (
              <Pressable
                key={engine.id}
                accessibilityRole="radio"
                aria-checked={engine.isDefault}
                disabled={!engine.selectable}
                onPress={() => void setDefaultSearchEngine(engine.id)}
                className={
                  engine.isDefault
                    ? 'flex-row items-baseline gap-2 rounded-radius-12 bg-primary-subtle px-3 py-2'
                    : 'flex-row items-baseline gap-2 rounded-radius-12 px-3 py-2 hover:bg-fill-hover'
                }
              >
                <Text className="text-body text-foreground flex-1">{engine.name}</Text>
                <Text className="text-caption text-text-tertiary">{engine.keyword}</Text>
              </Pressable>
            ))}
          </PanelSection>
        </ScrollView>
      </View>
    </View>
  );
}
