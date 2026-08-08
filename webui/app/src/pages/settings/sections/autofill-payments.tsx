// Payment methods -- the cards and IBANs the browser has saved.
//
// Same transport and the same reasoning as the addresses screen:
// `chrome.autofillPrivate` holds the records, `autofill.credit_card_enabled`
// holds the policy, and the row labels are the browser's own composition rather
// than this page's guess at how a card reads.
//
// Both lists are here rather than on two screens because upstream deletes them
// through ONE call -- `removePaymentsEntity` takes a guid and does not care
// which list it came from -- and because a user looking for "the card I saved"
// does not know whether the browser filed it as a card or an IBAN.
//
// Deliberately absent: the card number, the CVC, and anything that would
// re-display a stored secret. The API can return them; a settings list has no
// reason to, and a page that renders them puts them in a screenshot, a screen
// recording and an accessibility tree. The browser's own label -- network and
// last four digits -- is what identifies a card here.

import {Button, SettingsListItem} from '@oxyhq/bloom';
import {Text} from '@oxyhq/bloom/typography';

import {SectionCard, removePaymentsEntity, t, usePersonalData, usePref} from '@astro/platform';

import {RowGroup} from '../components/row-group.tsx';
import {SubpageHeader} from '../components/section-header.tsx';

/** A card's expiry, as the two fields the browser stores it in. */
function expiry(month: string | undefined, year: string | undefined): string | undefined {
  return month && year ? t('settings.autofill.payments.expires', {month, year}) : undefined;
}

export function AutofillPaymentsScreen() {
  const data = usePersonalData();
  const enabled = usePref('autofill.credit_card_enabled');
  const locked = enabled?.enforcement === 'ENFORCED';

  const empty = data !== undefined && data.cards.length === 0 && data.ibans.length === 0;

  return (
    <>
      <SubpageHeader
        title="settings.autofill.payments.title"
        description="settings.autofill.payments.description"
        backTo="/autofill"
        backLabel="settings.nav.autofill"
      />

      {data === undefined ? (
        <SectionCard>
          <Text className="text-body text-text-secondary">{t('pref.pending')}</Text>
        </SectionCard>
      ) : empty ? (
        <SectionCard>
          <Text className="text-body text-text-secondary">
            {t('settings.autofill.payments.empty')}
          </Text>
        </SectionCard>
      ) : undefined}

      {data !== undefined && data.cards.length > 0 ? (
        <RowGroup
          title="settings.autofill.payments.cards"
          footer={locked ? 'settings.autofill.payments.locked' : undefined}
        >
          {data.cards.map(card => (
            <SettingsListItem
              key={card.guid ?? card.metadata?.summaryLabel}
              title={card.metadata?.summaryLabel ?? t('settings.autofill.payments.unnamedCard')}
              description={
                card.metadata?.summarySublabel ??
                expiry(card.expirationMonth, card.expirationYear)
              }
              value={
                card.metadata?.isLocal === false ? t('settings.autofill.inAccount') : undefined
              }
              showChevron={false}
              rightElement={
                card.guid === undefined || card.metadata?.isLocal === false ? undefined : (
                  <Button
                    variant="text"
                    size="small"
                    disabled={locked}
                    onPress={() => removePaymentsEntity(card.guid ?? '')}
                  >
                    {t('settings.autofill.remove')}
                  </Button>
                )
              }
            />
          ))}
        </RowGroup>
      ) : undefined}

      {data !== undefined && data.ibans.length > 0 ? (
        <RowGroup title="settings.autofill.payments.ibans">
          {data.ibans.map(iban => (
            <SettingsListItem
              key={iban.guid ?? iban.metadata?.summaryLabel}
              // The browser's label first, the nickname under it. The other way
              // round reads better and identifies nothing: "Savings" is what
              // the user called it, and the masked digits are what tell two
              // accounts apart.
              title={iban.metadata?.summaryLabel ?? iban.nickname ?? ''}
              description={iban.nickname ?? iban.metadata?.summarySublabel}
              showChevron={false}
              rightElement={
                iban.guid === undefined ? undefined : (
                  <Button
                    variant="text"
                    size="small"
                    disabled={locked}
                    onPress={() => removePaymentsEntity(iban.guid ?? '')}
                  >
                    {t('settings.autofill.remove')}
                  </Button>
                )
              }
            />
          ))}
        </RowGroup>
      ) : undefined}

      <SectionCard>
        <Text className="text-bodySmall text-text-secondary">
          {t('settings.autofill.payments.noEditor')}
        </Text>
      </SectionCard>
    </>
  );
}
