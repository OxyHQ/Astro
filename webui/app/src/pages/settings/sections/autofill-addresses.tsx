// Addresses -- what the browser has saved and offers to fill in.
//
// `chrome.autofillPrivate` is the only door to these. There is no preference
// holding them and no WebUI message handler that answers for them: the records
// live in the profile's PersonalDataManager and the API is how a settings page
// reads it. What IS a pref is whether address filling is on at all
// (`autofill.profile_enabled`), and that pref is what carries the policy
// metadata -- so an organisation that switches address filling off does it
// there, and this screen reads it to decide whether deleting is offered.
//
// The browser composes each row's label itself, in `metadata.summaryLabel` and
// `summarySublabel`. Reassembling one here from the address fields would mean
// this page deciding how an address reads in every country the browser
// supports, and getting it wrong for most of them.

import {Button, SettingsListItem} from '@oxyhq/bloom';
import {Text} from '@oxyhq/bloom/typography';

import {SectionCard, removeAddress, t, usePersonalData, usePref} from '@astro/platform';

import {RowGroup} from '../components/row-group.tsx';
import {SubpageHeader} from '../components/section-header.tsx';

export function AutofillAddressesScreen() {
  const data = usePersonalData();
  const enabled = usePref('autofill.profile_enabled');
  const locked = enabled?.enforcement === 'ENFORCED';

  return (
    <>
      <SubpageHeader
        title="settings.autofill.addresses.title"
        description="settings.autofill.addresses.description"
        backTo="/autofill"
        backLabel="settings.nav.autofill"
      />

      {data === undefined ? (
        <SectionCard>
          <Text className="text-body text-text-secondary">{t('pref.pending')}</Text>
        </SectionCard>
      ) : data.addresses.length === 0 ? (
        <SectionCard>
          <Text className="text-body text-text-secondary">
            {t('settings.autofill.addresses.empty')}
          </Text>
        </SectionCard>
      ) : (
        <RowGroup
          footer={
            locked
              ? 'settings.autofill.addresses.locked'
              : 'settings.autofill.addresses.footer'
          }
        >
          {data.addresses.map(address => (
            <SettingsListItem
              key={address.guid ?? address.metadata?.summaryLabel}
              title={address.metadata?.summaryLabel ?? t('settings.autofill.addresses.unnamed')}
              description={address.metadata?.summarySublabel}
              // An account record is not the browser's to delete; upstream
              // sends the user to their account to remove one.
              value={
                address.metadata?.isLocal === false
                  ? t('settings.autofill.inAccount')
                  : undefined
              }
              showChevron={false}
              rightElement={
                address.guid === undefined || address.metadata?.isLocal === false ? undefined : (
                  <Button
                    variant="text"
                    size="small"
                    disabled={locked}
                    onPress={() => removeAddress(address.guid ?? '')}
                  >
                    {t('settings.autofill.remove')}
                  </Button>
                )
              }
            />
          ))}
        </RowGroup>
      )}

      <SectionCard>
        <Text className="text-bodySmall text-text-secondary">
          {t('settings.autofill.addresses.noEditor')}
        </Text>
      </SectionCard>
    </>
  );
}
