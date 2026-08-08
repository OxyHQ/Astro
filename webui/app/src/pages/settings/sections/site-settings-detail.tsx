// One content-setting type, whichever one the fragment names.
//
// The single screen behind 48 of upstream's routes. It reads the type back out
// of the fragment rather than taking it as a prop, because the registry's other
// screens take no props either -- the router's job is to pick a component, and
// giving one of them a parameter would put route parsing in the registry for
// the sake of a single entry.
//
// The type is the segment straight after `/content/`, NOT the last segment of
// the path: the router picks this screen by longest prefix, so `/content/camera`
// and anything below it both land here, and reading the last segment would make
// `/content/camera/anything` fail to find a type it plainly has.
//
// The fallback is not a default. The registry only routes fragments built from
// this same table, so reaching it means the registry and the table disagree --
// which is worth saying rather than papering over by rendering the first type in
// the list, a screen that would be editing a permission nobody asked for.

import {Text} from '@oxyhq/bloom/typography';

import {SectionCard, t, useHashPath} from '@astro/platform';

import {PendingScreen} from '../components/pending-screen.tsx';
import {SubpageHeader} from '../components/section-header.tsx';
import {contentTypeForSegment} from './site-settings.content-types.ts';

const PREFIX = '/content/';

export function SiteSettingsDetailScreen() {
  const path = useHashPath();
  const rest = path.startsWith(PREFIX) ? path.slice(PREFIX.length) : '';
  const cut = rest.indexOf('/');
  const type = contentTypeForSegment(cut === -1 ? rest : rest.slice(0, cut));

  if (!type) {
    return (
      <>
        <SubpageHeader
          title="settings.siteSettings.title"
          backTo="/content"
          backLabel="settings.nav.siteSettings"
        />
        <SectionCard>
          <Text className="text-body text-text-secondary">
            {t('settings.siteSettings.unknownType', {path})}
          </Text>
        </SectionCard>
      </>
    );
  }

  return (
    <PendingScreen title={type.title} backTo="/content" backLabel="settings.nav.siteSettings" />
  );
}
