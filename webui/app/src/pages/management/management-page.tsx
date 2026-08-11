// Management -- an entry of the single Astro WebUI app, on upstream's own host.
//
// WHAT IT REPLACED, AND WHAT BECAME OF EACH PART
//
// `chrome://management` is upstream's enterprise status page. Astro takes the
// host over with 073 rather than adding a second registration, and adopts
// `ManagementUIHandler` wholesale, so everything factual on this page is still
// the browser's own answer. Measured on the shipped binary before the port,
// with an unmanaged profile: 195 elements, and the whole visible content was
// "Your browser is not managed" plus one notice paragraph.
//
// Of the ten messages that handler registers, this page sends SEVEN and never
// sends three:
//
//   getContextualManagedData   kept -- the managed flag, the status line and
//                              the three section subtitles. Its
//                              `browserManagementNotice` field is deliberately
//                              NOT rendered; see below.
//   getExtensions              kept
//   getApplications            kept
//   getManagedWebsites         kept
//   initBrowserReportingInfo   kept
//   initProfileReportingInfo   kept
//   getThreatProtectionInfo    kept
//   shouldShowPromotion        DROPPED with the banner
//   setBannerDismissed         DROPPED with the banner
//   recordBannerRedirected     DROPPED with the banner
//
// THE BANNER, AND WHY IT IS NOT HERE. Upstream renders a promotion whose button
// runs `window.open('https://admin.google.com/ac/chrome/guides/?ref=browser&
// utm_source=chrome_policy_cec')` and then reports the click through
// `recordBannerRedirected`, with `setBannerDismissed` recording the other
// outcome. A de-Googled browser advertising the Google Admin console from its
// own management page, with a campaign parameter attached, is the plainest
// thing on this page to remove. It is gated behind a feature flag that is
// disabled by default, so on this build it did not render -- which is a reason
// to drop it deliberately rather than to leave it and rely on the flag.
//
// THE NOTICE. `browserManagementNotice` is not a sentence, it is markup: the
// browser sends `…outside of Chromium. <a target="_blank" href="https://
// support.google.com/chrome?p=is_chrome_managed" …>Learn more</a>`. Three
// things wrong with rendering it: the link leaves for Google from the browser's
// own explanation of who controls it, it names Chromium in a browser called
// Astro, and injecting it is exactly the Trusted Types violation that killed
// the old ad blocker page. The fact it states is restated in the page's own
// catalogue instead.
//
// WHAT IS NOT VERIFIED, said plainly rather than implied. Every list here is
// empty on a profile with no enterprise policy, which is the only kind this
// machine has. The managed path -- non-empty reporting rows, extensions,
// applications, websites and threat-protection entries -- is unexercised; the
// store names the command that would exercise it.

import {SettingsListGroup, SettingsListItem} from '@oxyhq/bloom';
import {useThemeColor} from '@oxyhq/bloom/theme';
import {Text} from '@oxyhq/bloom/typography';
import {ScrollView, View} from 'react-native';

import {AstroMark, browserString, t} from '@astro/platform';

import {
  useManagement,
  type ManagedItem,
  type ReportingRow,
  type ThreatProtectionRow,
} from './management-store.ts';

/**
 * A group that draws nothing when it has nothing.
 *
 * Every section on this page is empty on an unmanaged browser, and a column of
 * eight "Nothing." cards would bury the one line that matters. The exception is
 * made by the caller, not here: the page renders the whole set only when the
 * browser reports itself managed.
 */
function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <SettingsListGroup title={title} footer={subtitle}>
      {children}
    </SettingsListGroup>
  );
}

function ItemRows({items}: {items: readonly ManagedItem[]}) {
  if (items.length === 0) {
    return <SettingsListItem title={t('management.empty')} showChevron={false} disabled />;
  }
  return (
    <>
      {items.map(item => (
        <SettingsListItem
          key={item.name}
          title={item.name}
          description={
            item.permissions.length === 0
              ? undefined
              : t('management.permissions', {permissions: item.permissions.join(', ')})
          }
          showChevron={false}
        />
      ))}
    </>
  );
}

function ReportingRows({rows}: {rows: readonly ReportingRow[]}) {
  if (rows.length === 0) {
    return <SettingsListItem title={t('management.empty')} showChevron={false} disabled />;
  }
  return (
    <>
      {rows.map(row => (
        <SettingsListItem
          key={row.messageId}
          // The browser's own wording for the name it sent, from the table its
          // controller filled with `remove_links=true` variants. Falling back
          // to the raw name rather than to a blank row: an unresolvable label
          // must not read as "the browser reports nothing".
          title={
            browserString(row.messageId) ??
            t('management.reporting.unresolved', {id: row.messageId})
          }
          showChevron={false}
        />
      ))}
    </>
  );
}

function ThreatRows({rows}: {rows: readonly ThreatProtectionRow[]}) {
  if (rows.length === 0) {
    return <SettingsListItem title={t('management.empty')} showChevron={false} disabled />;
  }
  return (
    <>
      {rows.map(row => (
        <SettingsListItem
          key={row.title}
          title={row.title}
          description={row.permission}
          showChevron={false}
        />
      ))}
    </>
  );
}

export function ManagementPage() {
  const markColor = useThemeColor('primary');
  const state = useManagement();

  return (
    <View className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerClassName="items-center px-6 py-12">
        <View className="w-full max-w-2xl gap-6">
          <View className="items-center gap-3">
            <AstroMark size={56} fill={markColor} />
            <Text className="text-headerBold text-foreground text-center">
              {/* The browser's own status line, not this page's. It is the one
                  claim on the page a user should be able to trust absolutely,
                  so it comes from the browser verbatim. */}
              {state.ready ? state.pageSubtitle : t('management.pending')}
            </Text>
            {state.ready ? (
              <Text className="text-bodySmall text-text-secondary text-center">
                {t(state.managed ? 'management.notice.managed' : 'management.notice.unmanaged')}
              </Text>
            ) : undefined}
          </View>

          {/* Only a managed browser gets the detail. On an unmanaged one every
              one of these is empty, and eight empty cards say less than the
              sentence above them does. */}
          {state.ready && state.managed ? (
            <>
              <Section title={t('management.group.reporting.browser')}>
                <ReportingRows rows={state.browserReporting} />
              </Section>

              <Section title={t('management.group.reporting.profile')}>
                <ReportingRows rows={state.profileReporting} />
              </Section>

              <Section
                title={t('management.group.extensions')}
                subtitle={state.extensionReportingSubtitle}
              >
                <ItemRows items={state.extensions} />
              </Section>

              <Section
                title={t('management.group.applications')}
                subtitle={state.applicationReportingSubtitle}
              >
                <ItemRows items={state.applications} />
              </Section>

              <Section
                title={t('management.group.websites')}
                subtitle={state.managedWebsitesSubtitle}
              >
                {state.managedWebsites.length === 0 ? (
                  <SettingsListItem
                    title={t('management.empty')}
                    showChevron={false}
                    disabled
                  />
                ) : (
                  state.managedWebsites.map(site => (
                    <SettingsListItem key={site} title={site} showChevron={false} />
                  ))
                )}
              </Section>

              <Section
                title={t('management.group.threats')}
                subtitle={state.threatProtectionDescription}
              >
                <ThreatRows rows={state.threatProtection} />
              </Section>
            </>
          ) : undefined}
        </View>
      </ScrollView>
    </View>
  );
}
