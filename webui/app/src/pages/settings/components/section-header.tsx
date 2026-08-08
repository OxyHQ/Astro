// The first thing in a section, and the first thing in a subpage.
//
// Two components rather than one prop, because the two differ in a way that
// matters: a SECTION is chosen from the rail, which stays on screen and shows
// where the user is, so its header is a title. A SUBPAGE is reached from a row
// inside a section, the rail still highlights the PARENT, and without a way
// back the only exit is the browser's Back button — a dead end for anyone who
// arrived by deep link. `SubpageHeader` is that way back.

import {ChevronLeft_Stroke2_Corner0_Rounded} from '@oxyhq/bloom/icons';
import {useThemeColor} from '@oxyhq/bloom/theme';
import {Text} from '@oxyhq/bloom/typography';
import {Pressable, View} from 'react-native';

import {setHashPath, t, type MessageId} from '@astro/platform';

export interface SectionHeaderProps {
  title: MessageId;
  /** The sentence that says what the whole section is for. Most need none. */
  description?: MessageId;
}

export function SectionHeader({title, description}: SectionHeaderProps) {
  return (
    <View className="gap-1">
      <Text className="text-sectionTitle text-foreground">{t(title)}</Text>
      {description ? (
        <Text className="text-body text-text-secondary">{t(description)}</Text>
      ) : undefined}
    </View>
  );
}

export interface SubpageHeaderProps {
  title: MessageId;
  description?: MessageId;
  /** The fragment of the section this subpage belongs to. */
  backTo: string;
  /** That section's own name, so the control says where it goes. */
  backLabel: MessageId;
}

export function SubpageHeader({title, description, backTo, backLabel}: SubpageHeaderProps) {
  // Icons take a colour, not a class: on web react-native-css hands the
  // component `{$$css: true, className}` rather than resolved styles, so the
  // `style.color` an icon reads as its fallback fill is never there.
  const iconColor = useThemeColor('textSecondary');
  return (
    <View className="gap-2">
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={t('settings.backTo', {section: t(backLabel)})}
        onPress={() => setHashPath(backTo)}
        className="-ml-2 flex-row items-center gap-1 self-start rounded-radius-max px-2 py-1 hover:bg-fill-hover"
      >
        <ChevronLeft_Stroke2_Corner0_Rounded size="sm" fill={iconColor} />
        <Text className="text-bodySmall text-text-secondary">{t(backLabel)}</Text>
      </Pressable>
      <Text className="text-sectionTitle text-foreground">{t(title)}</Text>
      {description ? (
        <Text className="text-body text-text-secondary">{t(description)}</Text>
      ) : undefined}
    </View>
  );
}
