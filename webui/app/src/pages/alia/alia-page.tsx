// Alia -- the shell, and an honest account of what is not behind it.
//
// WHAT THIS REPLACED, AND WHY NONE OF IT CAME ACROSS
//
// `webui/alia` was a chat client: a transcript, a markdown renderer, a
// streaming SSE reader against https://api.alia.onl, an abortable send button,
// three canned prompts and a token read out of `chrome.storage.local`. None of
// it worked in a build this pipeline produced, and that is measured rather than
// inferred:
//
//   * The page's own CSP declared `connect-src 'self' https://api.alia.oxy.so`
//     while the code called api.alia.onl. In the shipped binary the browser
//     answered every send with "Refused to connect because it violates the
//     document's Content Security Policy" -- so the transcript could never
//     receive a reply.
//   * `chrome.storage` does not exist on a WebUI page. `Object.keys(chrome)` on
//     the live page is `["loadTimes", "csi", "app"]`, so the access token was
//     always null and every request would have gone out unauthenticated even if
//     one had gone out at all.
//   * The context bar listened for a `postMessage` nobody sends. Its element
//     carried the `hidden` class on the live page, always.
//
// So there was nothing to preserve, and porting the input box would have been
// worse than dropping it: a control that looks live and answers nothing is the
// failure this whole migration exists to end. Issue #17 owns the replacement --
// a trusted shell hosting an unprivileged `astro-untrusted://alia-content`
// document, a typed bridge to a browser-process broker, and a permission model
// for the tab context. This page states that, and says which parts are
// missing, in the same spirit as the new tab page's weather card.
//
// WHAT IT DOES DO THAT THE OLD PAGE DID NOT
//
// It shows the tab context. `oxy_alia_side_panel.cc` passes it as query
// parameters (`context_url`, `context_title`) and the old page never read
// them -- it waited on a message instead. Worse, appending them BROKE the page:
// the disk-serving handler fell back to index.html only for paths with no dot
// in them, and `context_url=https%3A%2F%2Fexample.com%2F...` has several, so
// the side panel's own URL answered net::ERR_FAILED on every ordinary web page.
// Measured in the shipped binary, both halves. Serving from the pak has no such
// heuristic, so the panel's URL resolves and the value it carries is finally
// readable.

import {useThemeColor} from '@oxyhq/bloom/theme';
import {Text} from '@oxyhq/bloom/typography';
import {ScrollView, View} from 'react-native';

import {AstroMark, SectionCard, t, type MessageId} from '@astro/platform';

/**
 * The tab the browser told this panel about.
 *
 * Read once at module scope: a document's own URL cannot change without a
 * navigation, so there is no later value for a memoising compiler to miss --
 * the same reasoning the About section's user-agent read carries.
 *
 * Absent is the normal case, not an error: `BuildAliaUrlWithContext` appends
 * these only for an http or https tab, so opening the panel over a browser page
 * -- or opening astro://alia directly -- legitimately passes nothing.
 */
const TAB_CONTEXT = (() => {
  const parameters = new URLSearchParams(location.search);
  const url = parameters.get('context_url');
  return url === null ? undefined : {url, title: parameters.get('context_title') ?? ''};
})();

/** One of the three things #17 has to build before this page can answer. */
function Requirement({title, body}: {title: MessageId; body: MessageId}) {
  return (
    <View className="gap-1">
      <Text className="text-bodySmall font-semibold text-foreground">{t(title)}</Text>
      <Text className="text-bodySmall text-text-secondary">{t(body)}</Text>
    </View>
  );
}

/** A label above the value it names, for a fact rather than a control. */
function Fact({label, value}: {label: MessageId; value: string}) {
  return (
    <View className="gap-0.5">
      <Text className="text-caption text-text-tertiary uppercase">{t(label)}</Text>
      {/* Not `numberOfLines`: an address the panel was handed is evidence, and
          a truncated one cannot be checked against the tab it came from. */}
      <Text className="text-bodySmall text-foreground">{value}</Text>
    </View>
  );
}

function Header() {
  const markColor = useThemeColor('primary');
  return (
    <View className="h-14 shrink-0 flex-row items-center gap-2.5 border-b border-border px-4">
      <AstroMark size={20} fill={markColor} />
      <Text className="text-bodyTitleSmall text-foreground">{t('alia.title')}</Text>
      <View className="rounded-radius-max bg-fill-hover px-1.5 py-0.5">
        <Text className="text-caption text-text-tertiary">{t('alia.badge')}</Text>
      </View>
    </View>
  );
}

export function AliaPage() {
  const markColor = useThemeColor('primary');
  return (
    <View className="flex-1 bg-background">
      <Header />

      {/* The panel is narrow -- it is a side panel first and a tab second -- so
          the column is capped well below the settings page's and every row
          inside it stacks rather than sitting label-beside-value. */}
      <ScrollView className="flex-1" contentContainerClassName="items-center px-4 py-6">
        <View className="w-full max-w-xl gap-4">
          <View className="items-center gap-3 pb-2">
            <AstroMark size={44} fill={markColor} />
            <Text className="text-headerBold text-foreground text-center">
              {t('alia.pending.title')}
            </Text>
            <Text className="text-bodySmall text-text-secondary text-center">
              {t('alia.pending.body')}
            </Text>
          </View>

          <SectionCard title={t('alia.pending.waiting')}>
            <View className="gap-4">
              <Requirement
                title="alia.pending.isolation"
                body="alia.pending.isolation.body"
              />
              <Requirement title="alia.pending.bridge" body="alia.pending.bridge.body" />
              <Requirement title="alia.pending.consent" body="alia.pending.consent.body" />
            </View>
          </SectionCard>

          <SectionCard title={t('alia.context.title')}>
            {TAB_CONTEXT === undefined ? (
              <Text className="text-bodySmall text-text-secondary">
                {t('alia.context.none')}
              </Text>
            ) : (
              <View className="gap-3">
                <Fact
                  label="alia.context.pageTitle"
                  value={TAB_CONTEXT.title === '' ? t('alia.context.untitled') : TAB_CONTEXT.title}
                />
                <Fact label="alia.context.pageUrl" value={TAB_CONTEXT.url} />
                <Text className="text-caption text-text-tertiary">
                  {t('alia.context.note')}
                </Text>
              </View>
            )}
          </SectionCard>
        </View>
      </ScrollView>
    </View>
  );
}
