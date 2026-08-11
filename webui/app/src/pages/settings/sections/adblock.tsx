// Ad blocking -- Astro's own section, with no upstream equivalent.
//
// The CONTROLS live on `astro://adblock`, not here, and the row at the top of
// this section is the way to them. That split is a grant, not a layout
// preference: `astro.adblock.mojom.PageHandlerFactory` is registered in the
// WebUI frame binder map for `AstroAdBlockUI` alone (patch 063), so this page
// cannot reach the ad blocker's data plane at all. Binding it here as well
// would hand the surface that holds the `settingsPrivate` grant a second one it
// has no need of.
//
// Two facts about the browser keep this section a report even so, and both are
// stated on the screen as well as here:
//
//  1. The four preferences the service reads -- `oxy.adblock.enabled`,
//     `oxy.adblock.site_overrides`, `oxy.adblock.custom_rules` and
//     `oxy.adblock.lifetime_blocked_count`, registered by
//     `patches/astro/046-adblock-prefs.patch` -- are absent from
//     `chrome/browser/extensions/api/settings_private/prefs_util.cc`. A pref
//     outside that allowlist is invisible to `chrome.settingsPrivate` however
//     correctly it is spelled, so a `ToggleRow` bound to `oxy.adblock.enabled`
//     would work against a dev fixture and do nothing in the browser. That is
//     the same reason the theme uses typed Mojo, and the reason the ad blocker
//     page does too.
//  2. There is no per-list preference anywhere in the browser, so the
//     catalogue below is a report on both pages. A switch beside a list would
//     have nowhere to store its answer.
//
// What this comment used to say, and why it is worth recording that it was
// wrong: it claimed the whole Oxy overlay compiled to zero objects, so the
// service was not linked into the browser at all. That was true when it was
// written and stopped being true with `057-oxy-webui-build-edge.patch`, which
// gave the overlay the dependency edge it was missing. It also claimed there
// was no Mojo interface for the ad blocker anywhere; there is one now, and this
// section deliberately does not bind it.
//
// What the screen DOES show is the filter-list catalogue, which is a fact about
// the build rather than a state of the profile: the entries below mirror
// `GetFilterListCatalog()` in
// `src/chrome/browser/oxy/adblock/astro_adblock_filter_list_catalog.cc`, in its
// order, with `default_enabled` as the reported state. `CheckForUpdatesNow()`
// iterates `GetDefaultFilterLists()` only, which is why the other nine are
// reported as shipped rather than as available to switch on. The update numbers
// are `kUpdateInterval` and `kInitialDelay` from
// `astro_adblock_filter_list_updater.cc`.

import {t, type MessageId} from '@astro/platform';

import {InfoRow} from '../components/info-row.tsx';
import {LinkRow} from '../components/link-row.tsx';
import {RowGroup} from '../components/row-group.tsx';
import {SectionHeader} from '../components/section-header.tsx';

interface CatalogueEntry {
  readonly label: MessageId;
  /** `default_enabled` in the C++ catalogue, which is also "is it fetched". */
  readonly fetched: boolean;
}

const CATALOGUE: readonly CatalogueEntry[] = [
  {label: 'settings.adblock.list.easylist', fetched: true},
  {label: 'settings.adblock.list.easyprivacy', fetched: true},
  {label: 'settings.adblock.list.fanboyAnnoyance', fetched: false},
  {label: 'settings.adblock.list.fanboySocial', fetched: false},
  {label: 'settings.adblock.list.peterLowe', fetched: false},
  {label: 'settings.adblock.list.germany', fetched: false},
  {label: 'settings.adblock.list.spain', fetched: false},
  {label: 'settings.adblock.list.france', fetched: false},
  {label: 'settings.adblock.list.china', fetched: false},
  {label: 'settings.adblock.list.dutch', fetched: false},
  {label: 'settings.adblock.list.italy', fetched: false},
];

export function AdblockSection() {
  return (
    <>
      <SectionHeader title="settings.adblock.title" description="settings.adblock.description" />

      <RowGroup title="settings.adblock.group.controls" footer="settings.adblock.status.body">
        <LinkRow
          label="settings.adblock.open"
          sublabel="settings.adblock.open.sublabel"
          route="adBlock"
        />
      </RowGroup>

      <RowGroup title="settings.adblock.group.lists" footer="settings.adblock.lists.footer">
        {CATALOGUE.map(entry => (
          <InfoRow
            key={entry.label}
            label={entry.label}
            value={t(entry.fetched ? 'settings.adblock.list.on' : 'settings.adblock.list.off')}
          />
        ))}
      </RowGroup>

      <RowGroup title="settings.adblock.group.updates" footer="settings.adblock.updates.footer">
        <InfoRow
          label="settings.adblock.interval"
          value={t('settings.adblock.interval.value')}
        />
        <InfoRow
          label="settings.adblock.firstCheck"
          value={t('settings.adblock.firstCheck.value')}
        />
      </RowGroup>
    </>
  );
}
