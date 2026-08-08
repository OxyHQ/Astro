// Ad blocking -- Astro's own section, with no upstream equivalent and, today,
// no transport.
//
// This screen deliberately draws no control, and the reason is three separate
// facts about the browser rather than one missing feature. All three are stated
// on the screen as well as here, because a section that looked like a settings
// page and changed nothing would be worse than one that says so.
//
//  1. The whole Oxy overlay compiles to zero objects. No `BUILD.gn` outside
//     `chrome/browser/oxy/` declares a dependency on it, so
//     `AstroAdBlockService`, the engine and the filter-list updater are not
//     linked into the browser at all. This is a declared defect of the build,
//     owned by issue #7, not a gap in this page.
//  2. The four preferences the service reads -- `oxy.adblock.enabled`,
//     `oxy.adblock.site_overrides`, `oxy.adblock.custom_rules` and
//     `oxy.adblock.lifetime_blocked_count`, registered by
//     `patches/astro/046-adblock-prefs.patch` -- are absent from
//     `chrome/browser/extensions/api/settings_private/prefs_util.cc`. A pref
//     outside that allowlist is invisible to `chrome.settingsPrivate` however
//     correctly it is spelled, so a `ToggleRow` bound to
//     `oxy.adblock.enabled` would work against a dev fixture and do nothing in
//     the browser. That is the same reason the theme uses typed Mojo.
//  3. `AstroAdBlockUIHandler` does exist and registers `getAdBlockState`,
//     `removeSiteOverride` and `saveCustomRules` -- but it is added by
//     `AstroAdBlockUI`, the controller for `astro://adblock`, not by the
//     controller this page is served from. A message no installed handler
//     registered is a CHECK failure in a real build, so those three names are
//     not usable here.
//
// There is no Mojo interface for the ad blocker anywhere: `find src -name
// '*.mojom'` in the Astro overlay returns nothing. Nothing below invents one.
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

import {SectionCard, t, type MessageId} from '@astro/platform';

import {InfoRow} from '../components/info-row.tsx';
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

      <SectionCard
        title={t('settings.adblock.status.title')}
        description={t('settings.adblock.status.body')}
      />

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
