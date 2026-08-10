// What's New -- an entry of the single Astro WebUI app.
//
// WHAT IT REPLACED
//
// `webui/whats-new` was 956 lines of hand-written HTML, CSS and TypeScript with
// its own palette, its own Astro logo pasted inline, an IntersectionObserver
// reveal animation, a scroll-driven progress line and eight animated sparkles
// on its button. None of it was reachable: `chrome://whats-new` is UPSTREAM's
// host, upstream's `WhatsNewUIConfig::IsWebUIEnabled` returns
// `whats_new::IsEnabled()`, and in a build with `google_chrome_branding =
// false` that reads a feature flag which is `FEATURE_DISABLED_BY_DEFAULT`.
// Measured against the shipped binary: navigating to chrome://whats-new
// answers net::ERR_INVALID_URL and commits chrome-error://chromewebdata/.
// `071-whats-new-webui-takeover.patch` is what makes this page exist at all.
//
// WHAT THE CONTENT SAYS NOW, AND WHY IT CHANGED
//
// Four of the six entries were REWRITTEN. Editorial copy is not exempt from
// being true, and these had drifted:
//
//   account   claimed sign-in would "sync bookmarks, passwords, and settings
//             across all your devices". `oxy_auth_service.h` has no sync of any
//             kind -- it stores a token and an identity. A browser promising to
//             carry your passwords somewhere it does not is the worst kind of
//             wrong sentence to ship.
//   theme     offered "wallpapers". The new tab page port removed the wallpaper
//             setting because its apply function was empty; it never painted
//             anything. What is real is the colour preset, which repaints the
//             native UI and every astro:// page at once.
//   alia      said "Ask Alia anything from the sidebar. Get summaries,
//             explanations, and answers". The panel cannot answer -- see
//             pages/alia -- so this now says there is a place for it and that
//             what it can do is being built.
//   degoogled cited "155 patches applied". The series carries 178 (112
//             ungoogled + 66 Astro), a number that moves with every commit and
//             that nothing on this page could keep current. It is gone rather
//             than corrected.
//
// The version is the browser's own, by the same route and with the same limit
// as the About section: Chromium's user-agent reduction reports
// `Chrome/<major>.0.0.0`, so the MAJOR is all there is here, and it is shown as
// a major. The previous page hard-coded "146.0.7680.177" in a TypeScript file
// that no Chromium roll would ever have updated -- correct on the day it was
// written and a lie from the next roll onward. Its "April 4, 2026" release date
// has no source in the browser at all and is dropped rather than invented
// again.
//
// The reveal animations, the stagger, the pulsing timeline dots and the button
// sparkles are dropped as decoration. The timeline itself is kept, as layout: a
// rule down the left with a dot per entry, which is what it looked like once
// every animation had finished anyway.

import {
  Bot_Stroke,
  ColorPalette_Stroke2_Corner0_Rounded,
  Lock_Stroke2_Corner0_Rounded,
  MagnifyingGlass_Stroke2_Corner0_Rounded,
  Shield_Stroke2_Corner0_Rounded,
  ShieldCheck_Stroke2_Corner0_Rounded,
} from '@oxyhq/bloom/icons';
import {useThemeColor} from '@oxyhq/bloom/theme';
import {Text} from '@oxyhq/bloom/typography';
import {useEffect} from 'react';
import {Pressable, ScrollView, View} from 'react-native';

import {AstroMark, navigateTo, t, type MessageId, type NavIcon} from '@astro/platform';

/**
 * The browser's major version, read once.
 *
 * Safe at module scope for the same reason the About section's read is: a
 * document's user agent cannot change while it is loaded.
 *
 * `undefined` rather than a guess when the pattern does not match. A version
 * badge is a claim about the binary, and a badge that invents one is worse than
 * a badge that says only the product name.
 */
const MAJOR_VERSION = /Chrome\/(\d+)\./.exec(navigator.userAgent)?.[1];

interface Feature {
  readonly icon: NavIcon;
  readonly title: MessageId;
  readonly body: MessageId;
}

/**
 * The six entries, in the order they are read.
 *
 * Ordered by what a person notices first, not by how the browser is built: the
 * blocker is visible on the first page load, the assistant and the account are
 * the two things in the toolbar, and the last two are the reasons underneath.
 */
const FEATURES: readonly Feature[] = [
  {
    icon: ShieldCheck_Stroke2_Corner0_Rounded,
    title: 'whatsNew.feature.adblock',
    body: 'whatsNew.feature.adblock.body',
  },
  {
    icon: Bot_Stroke,
    title: 'whatsNew.feature.alia',
    body: 'whatsNew.feature.alia.body',
  },
  {
    icon: Lock_Stroke2_Corner0_Rounded,
    title: 'whatsNew.feature.account',
    body: 'whatsNew.feature.account.body',
  },
  {
    icon: ColorPalette_Stroke2_Corner0_Rounded,
    title: 'whatsNew.feature.theme',
    body: 'whatsNew.feature.theme.body',
  },
  {
    icon: MagnifyingGlass_Stroke2_Corner0_Rounded,
    title: 'whatsNew.feature.search',
    body: 'whatsNew.feature.search.body',
  },
  {
    icon: Shield_Stroke2_Corner0_Rounded,
    title: 'whatsNew.feature.degoogled',
    body: 'whatsNew.feature.degoogled.body',
  },
];

/**
 * One entry on the timeline.
 *
 * The rule and the dot are drawn by the row rather than by a container behind
 * it, so a row added or removed cannot leave the line the wrong length -- which
 * is what a single absolutely-positioned rule behind the list would allow.
 */
function FeatureRow({feature, last}: {feature: Feature; last: boolean}) {
  const accent = useThemeColor('primary');
  const Icon = feature.icon;
  return (
    <View className="flex-row gap-4">
      <View className="w-6 shrink-0 items-center">
        <View className="size-3 rounded-radius-max bg-primary" />
        {/* The last row has no rule below its dot: a line running past the end
            of the list reads as content that failed to load. */}
        {last ? undefined : <View className="w-px flex-1 bg-border" />}
      </View>
      <View className="min-w-0 flex-1 gap-2 rounded-2xl bg-card p-4">
        <View className="flex-row items-center gap-2.5">
          {/* Icons take a colour, not a class: on web react-native-css hands
              the component `{$$css: true, className}` rather than resolved
              styles, so the `style.color` an icon reads as its fallback fill is
              never there. */}
          <Icon size="md" fill={accent} />
          <Text className="text-bodyTitleSmall text-foreground">{t(feature.title)}</Text>
        </View>
        <Text className="text-bodySmall text-text-secondary">{t(feature.body)}</Text>
      </View>
    </View>
  );
}

/** One external link in the footer. */
function FooterLink({label, href}: {label: MessageId; href: string}) {
  return (
    <View
      href={href}
      // Opened in a new tab, as they were: this page is shown after an update
      // and losing it to a website is not what the click meant. `noopener`
      // because the opener would be a WebUI page.
      hrefAttrs={{target: '_blank', rel: 'noopener noreferrer'}}
      accessibilityRole="link"
      className="rounded-radius-8 px-2 py-1 hover:bg-fill-hover"
    >
      <Text className="text-bodySmall text-text-secondary">{t(label)}</Text>
    </View>
  );
}

export function WhatsNewPage() {
  const markColor = useThemeColor('primary');

  // Enter and Escape both leave for the new tab page, which is what the page
  // this replaces did. A document-level listener is the only shape that can
  // hear a key pressed with nothing focused, so this is one of the few effects
  // in the app; it is removed on unmount so a page swap cannot leave a second
  // one behind.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape' || (event.key === 'Enter' && !event.repeat)) {
        // Enter belongs to whatever is focused. Without this, tabbing to a
        // footer link and pressing Enter would follow the link AND navigate
        // away, and the two would race.
        const target = event.target;
        if (event.key === 'Enter' && target instanceof HTMLElement && target !== document.body) {
          return;
        }
        navigateTo('newTab');
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <View className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerClassName="items-center px-6 py-16">
        <View className="w-full max-w-2xl gap-10">
          <View className="items-center gap-4">
            <AstroMark size={72} fill={markColor} />
            <View className="rounded-radius-max border border-border px-3 py-1">
              <Text className="text-caption text-text-secondary">
                {MAJOR_VERSION === undefined
                  ? t('whatsNew.version.unknown')
                  : t('whatsNew.version', {version: MAJOR_VERSION})}
              </Text>
            </View>
            <Text className="text-headerBold text-foreground text-center">
              {t('whatsNew.title')}
            </Text>
            <Text className="text-body text-text-secondary text-center">
              {t('whatsNew.subtitle')}
            </Text>
          </View>

          <View className="gap-3">
            {FEATURES.map((feature, index) => (
              <FeatureRow
                key={feature.title}
                feature={feature}
                last={index === FEATURES.length - 1}
              />
            ))}
          </View>

          <View className="items-center">
            <Pressable
              accessibilityRole="link"
              onPress={() => navigateTo('newTab')}
              className="rounded-radius-max bg-primary px-6 py-3 hover:opacity-90"
            >
              <Text className="text-body font-semibold text-onPrimary">
                {t('whatsNew.getStarted')}
              </Text>
            </Pressable>
          </View>

          <View className="items-center gap-2">
            <Text className="text-bodySmall text-text-tertiary">{t('whatsNew.footer')}</Text>
            <View className="flex-row items-center gap-2">
              <FooterLink label="whatsNew.footer.website" href="https://oxy.so" />
              <FooterLink label="whatsNew.footer.github" href="https://github.com/OxyHQ" />
              <FooterLink label="whatsNew.footer.privacy" href="https://oxy.so/privacy" />
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
