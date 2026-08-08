// Site settings -- the category list.
//
// Every row here is a link, and every link goes to the same parameterised
// screen (`site-settings-detail.tsx`) with a different permission. The rows are
// read out of `site-settings.content-types.ts` rather than written here: the
// table already knows which of the forty-eight types upstream lists and in
// which of its four lists, and a second hand-kept copy of that is how a
// permission comes to be routed and unreachable, or listed twice.
//
// Ordering is alphabetical WITHIN each group, which is a deliberate departure.
// Upstream's order is hand-set and has no rule behind it, so it cannot be
// reproduced from the table; alphabetical is reproducible, and on a list of
// twenty-seven permissions it is also the order a user can actually scan.
//
// Two rows are not permissions. "All sites" and "Protocol handlers" are screens
// of their own that upstream puts in this same list, so they are here too.

import {useMemo} from 'react';

import {t, type MessageId} from '@astro/platform';

import {CollapsibleGroup} from '../components/collapsible-group.tsx';
import {LinkRow} from '../components/link-row.tsx';
import {RowGroup} from '../components/row-group.tsx';
import {SectionHeader} from '../components/section-header.tsx';
import {ToggleRow} from '../components/toggle-row.tsx';
import {CONTENT_TYPES, type CategoryGroup} from './site-settings.content-types.ts';

interface CategoryRow {
  readonly title: MessageId;
  /** The fragment in this page the row opens. */
  readonly to: string;
}

/** The permissions in one of upstream's four lists, by rendered name. */
function categoryRows(group: CategoryGroup, extra: readonly CategoryRow[] = []): CategoryRow[] {
  const rows = CONTENT_TYPES.filter(type => type.group === group).map(type => ({
    title: type.title,
    to: `/content/${type.segment}`,
  }));
  return [...rows, ...extra].sort((left, right) => t(left.title).localeCompare(t(right.title)));
}

function CategoryList({rows}: {rows: readonly CategoryRow[]}) {
  return (
    <RowGroup>
      {rows.map(row => (
        <LinkRow key={row.to} label={row.title} to={row.to} />
      ))}
    </RowGroup>
  );
}

export function SiteSettingsSection() {
  // The four lists depend on nothing but the table and the catalogue, both of
  // which are module constants, so they are computed once rather than on every
  // keystroke in the page's search field.
  const lists = useMemo(
    () => ({
      permissionsBasic: categoryRows('permissionsBasic'),
      // Upstream puts protocol handlers among the advanced permissions, and it
      // is the one entry in that list that is not a content setting.
      permissionsAdvanced: categoryRows('permissionsAdvanced', [
        {title: 'settings.siteSettings.handlers.title', to: '/handlers'},
      ]),
      // The third-party cookie controls are the privacy section's `/cookies`
      // screen, not one of the forty-eight. Upstream links to it from here, so
      // this page does too rather than leaving a gap where a user looks.
      contentBasic: categoryRows('contentBasic', [
        {title: 'settings.siteSettings.thirdPartyCookies', to: '/cookies'},
      ]),
      contentAdvanced: categoryRows('contentAdvanced'),
    }),
    [],
  );

  return (
    <>
      <SectionHeader
        title="settings.siteSettings.title"
        description="settings.siteSettings.description"
      />

      <RowGroup>
        <LinkRow label="settings.siteSettings.allSites.title" to="/content/all" />
      </RowGroup>

      <RowGroup title="settings.siteSettings.group.permissions">
        {lists.permissionsBasic.map(row => (
          <LinkRow key={row.to} label={row.title} to={row.to} />
        ))}
      </RowGroup>
      <CollapsibleGroup title="settings.siteSettings.group.permissionsMore">
        <CategoryList rows={lists.permissionsAdvanced} />
      </CollapsibleGroup>

      <RowGroup title="settings.siteSettings.group.content">
        {lists.contentBasic.map(row => (
          <LinkRow key={row.to} label={row.title} to={row.to} />
        ))}
      </RowGroup>
      <CollapsibleGroup title="settings.siteSettings.group.contentMore">
        <CategoryList rows={lists.contentAdvanced} />
      </CollapsibleGroup>

      <RowGroup>
        <ToggleRow
          prefKey="safety_hub.unused_site_permissions_revocation.enabled"
          label="settings.siteSettings.autoRevoke"
        />
      </RowGroup>
    </>
  );
}
