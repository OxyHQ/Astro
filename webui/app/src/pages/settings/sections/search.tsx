// Search engine.
//
// The one thing almost everyone comes to this section for is which engine the
// address bar uses, so that choice is on the section itself rather than behind
// the dialog upstream puts it in. It is drawn by `DefaultEngineChooser`, which
// lives next to the handler store it reads (`search-engines.tsx`).
//
// The managed case is read from a PREF while the list comes from a HANDLER, and
// the two are not interchangeable: an enterprise policy that fixes the default
// engine reports itself on `default_search_provider_data.template_url_data`
// (allowlisted in prefs_util.cc as a dictionary, and special-cased there to
// carry the controlling extension's name), while the engines themselves only
// exist in `SearchEnginesHandler`. Reading the enforcement from the pref is
// what lets the chooser refuse input that the browser would refuse anyway.
//
// NOT here, on purpose: `search.suggest_enabled`. Upstream puts it on the
// privacy page (`personalization_options.html`), and Astro's privacy section
// already renders it. A second copy would give the page's search field two hits
// for one setting, and two switches that must agree.

import {ControlAnchor} from '../components/control-anchor.tsx';
import {SectionHeader} from '../components/section-header.tsx';
import {LinkRow} from '../components/link-row.tsx';
import {RowGroup} from '../components/row-group.tsx';

import {SectionCard, t, usePref} from '@astro/platform';

import {DefaultEngineChooser} from './search-engines.tsx';

/** The pref a policy or an extension reports a forced default engine on. */
const DEFAULT_ENGINE_PREF = 'default_search_provider_data.template_url_data';

export function SearchSection() {
  const provider = usePref(DEFAULT_ENGINE_PREF);
  const enforced = provider?.enforcement === 'ENFORCED';

  return (
    <>
      <SectionHeader title="settings.searchEngine.title" />

      <ControlAnchor id="settings.searchEngine.default">
        <SectionCard
          title={t('settings.searchEngine.default')}
          description={
            enforced && provider?.controlledByName
              ? t('pref.enforcedBy', {controller: provider.controlledByName})
              : t('settings.searchEngine.default.description')
          }
        >
          <DefaultEngineChooser enforced={enforced} />
        </SectionCard>
      </ControlAnchor>

      <RowGroup>
        <LinkRow label="settings.searchEngine.manage" to="/searchEngines" />
      </RowGroup>
    </>
  );
}
