// About Astro.
//
// No preferences: upstream's about page binds none either. It has AboutHandler,
// installed unguarded by `chrome/browser/ui/webui/settings/settings_ui.cc:443`,
// which on a Linux non-Google build registers exactly four messages --
// `aboutPageReady`, `refreshUpdateStatus`, `openFeedbackDialog` and
// `openHelpPage`. Everything else in that handler is behind `IS_CHROMEOS` or
// `IS_MAC`.
//
// Two of the four are not called. `openFeedbackDialog` opens Chrome's feedback
// dialog, which posts to a Google endpoint, and `openHelpPage` opens
// support.google.com.
//
// What the version row does NOT read, and why. Upstream renders its version
// from `loadTimeData`, whose `aboutBrowserVersion` key is written into the page
// by `settings_localized_strings_provider.cc`. This app has no loadTimeData
// bridge -- it carries its own message catalogue precisely so it does not need
// one -- so the version comes from the user agent instead. That string is the
// browser's own report of itself, it needs no grant and no round trip, and in a
// build with `use_unofficial_version_number = false` it carries the real
// Chromium revision. It is a smaller fact than upstream's, which is why the row
// says where it came from.
//
// The update row is real, and is worded for what the Linux updater actually is.
// `chrome/browser/ui/BUILD.gn:3398` compiles `version_updater_basic.cc` for
// every Linux build, branded or not, and that class is thirty-five lines: it
// asks `UpgradeDetector` whether a newer binary is already on disk and answers
// `nearly_updated` or `disabled` synchronously, downloading nothing. So this
// row asks a question that can be answered truthfully -- "is one waiting?" --
// rather than offering a check for updates that has no updater behind it.

import {SectionCard, addWebUIListener, send, t} from '@astro/platform';
import {useState, useSyncExternalStore} from 'react';

import {ActionRow} from '../components/action-row.tsx';
import {InfoRow} from '../components/info-row.tsx';
import {RowGroup} from '../components/row-group.tsx';
import {SectionHeader} from '../components/section-header.tsx';

/**
 * The browser's own version, read once.
 *
 * A module-level read is safe here where an out-of-band read normally is not:
 * the user agent cannot change for the life of the document, so there is no
 * later value for a memoising compiler to miss.
 *
 * It is the MAJOR version and nothing else, and the row says so. Chromium's user
 * agent reduction writes `Chrome/<major>.0.0.0`, verified in a real browser
 * here: a 150.0.7723.x binary reports `HeadlessChrome/150.0.0.0`. The exact
 * build number exists only in `loadTimeData`, which this app has no bridge to,
 * and on `astro://version`, where the row points instead of guessing.
 */
const CHROMIUM_VERSION = /Chrome\/([\d.]+)/.exec(navigator.userAgent)?.[1];

/** The `update-status-changed` payload, as much of it as this screen reads. */
interface UpdateStatusEvent {
  readonly status?: unknown;
  readonly message?: unknown;
}

function isUpdateStatusEvent(value: unknown): value is UpdateStatusEvent {
  return typeof value === 'object' && value !== null;
}

/**
 * The browser's last word on the update state.
 *
 * AboutHandler pushes this rather than replying to the call -- `chrome.send`
 * out, `FireWebUIListener` back -- so it is an external event source and is
 * read through `useSyncExternalStore` like every other one in this app. The
 * snapshot is a string rather than an object so an unchanged status re-renders
 * nobody.
 */
let updateStatus: string | undefined;
const updateListeners = new Set<() => void>();
let attached = false;

function subscribeUpdate(listener: () => void): () => void {
  if (!attached) {
    attached = true;
    // Never removed: the subscription belongs to the module, not to a mount,
    // and a screen the user leaves and comes back to should still be holding
    // the answer the browser already gave.
    addWebUIListener('update-status-changed', (...args: unknown[]) => {
      const [payload] = args;
      updateStatus = isUpdateStatusEvent(payload) && typeof payload.status === 'string'
        ? payload.status
        : '';
      for (const each of updateListeners) {
        each();
      }
    });
  }
  updateListeners.add(listener);
  return () => {
    updateListeners.delete(listener);
  };
}

function readUpdate(): string | undefined {
  return updateStatus;
}

/**
 * The wire status, in words.
 *
 * `UpdateStatusToString` in `about_handler.cc:241-285` is the full list; only
 * the three a Linux `VersionUpdaterBasic` can produce are named. Anything else
 * would mean the browser grew a real updater, so it is reported verbatim rather
 * than mistranslated.
 */
function describeUpdate(status: string | undefined): string {
  switch (status) {
    case undefined:
      return t('settings.about.update.pending');
    case 'checking':
      return t('settings.about.update.checking');
    case 'disabled':
      return t('settings.about.update.none');
    case 'nearly_updated':
    case 'updated':
      return t('settings.about.update.ready');
    case '':
      return t('settings.about.update.failed');
    default:
      return status;
  }
}

export function AboutSection() {
  const status = useSyncExternalStore(subscribeUpdate, readUpdate);
  // Whether the user has asked at all. Distinct from the status: the handler
  // answers synchronously enough that "checking" is rarely seen, and a row that
  // said "not asked yet" after a press would read as a button that did nothing.
  const [asked, setAsked] = useState(false);

  return (
    <>
      <SectionHeader title="settings.about.title" />

      <RowGroup title="settings.about.group.build" footer="settings.about.build.footer">
        <InfoRow
          label="settings.about.version"
          sublabel="settings.about.version.sublabel"
          value={CHROMIUM_VERSION}
        />
        <InfoRow label="settings.about.userAgent" value={navigator.userAgent} />
      </RowGroup>

      <RowGroup title="settings.about.group.updates" footer="settings.about.updates.footer">
        <ActionRow
          label="settings.about.update"
          sublabel="settings.about.update.sublabel"
          actionLabel="settings.about.update.action"
          onPress={() => {
            setAsked(true);
            send('refreshUpdateStatus');
          }}
        />
        {asked ? (
          <InfoRow label="settings.about.update.state" value={describeUpdate(status)} />
        ) : undefined}
      </RowGroup>

      <SectionCard
        title={t('settings.about.group.attribution')}
        description={t('settings.about.attribution.body')}
      />
    </>
  );
}
