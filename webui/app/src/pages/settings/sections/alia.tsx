// Alia -- Astro's own section, with no upstream equivalent.
//
// Like the ad blocker, there is no transport to Alia from this page, and for
// the same underlying reason: the Oxy overlay compiles to zero objects (issue
// #7). Unlike the ad blocker, there would be almost nothing to send even if
// there were. `src/chrome/browser/oxy/oxy_alia_side_panel.cc` includes no
// `PrefService` at all -- it reads the active tab's URL and title, appends them
// to a fixed address, and registers a side-panel entry. Every part of that is a
// constant in the source.
//
// The only Alia preference anywhere is `astro.ntp_show_alia`, registered by
// `patches/astro/020-register-oxy-prefs.patch`, and it governs the New Tab
// page's Alia widget rather than the panel. It is not in
// `chrome/browser/extensions/api/settings_private/prefs_util.cc`, so
// `chrome.settingsPrivate` cannot see it -- a `ToggleRow` bound to it would
// work against a dev fixture and do nothing in the browser. It is left alone
// rather than half-wired, and the New Tab page is where it belongs in any case.
//
// The one live control is the link, which is a real navigation to a real page:
// `astro://alia` is served by `AstroAliaUI`. It goes through the route table
// rather than a composed URL, so it stays correct across a scheme rename.

import {SectionCard, t} from '@astro/platform';

import {InfoRow} from '../components/info-row.tsx';
import {LinkRow} from '../components/link-row.tsx';
import {RowGroup} from '../components/row-group.tsx';
import {SectionHeader} from '../components/section-header.tsx';

export function AliaSection() {
  return (
    <>
      <SectionHeader title="settings.alia.title" description="settings.alia.description" />

      <SectionCard
        title={t('settings.alia.status.title')}
        description={t('settings.alia.status.body')}
      />

      <RowGroup title="settings.alia.group.panel">
        {/* Not a setting, and drawn anyway: `BuildAliaUrlWithContext` appends
            `context_url` and `context_title` only for an http or https tab, and
            what an assistant is told about the page you are on is worth saying
            even where it cannot be changed. */}
        <InfoRow
          label="settings.alia.context"
          sublabel="settings.alia.context.sublabel"
          value={t('settings.alia.context.value')}
        />
        <LinkRow label="settings.alia.open" sublabel="settings.alia.open.sublabel" route="alia" />
      </RowGroup>
    </>
  );
}
