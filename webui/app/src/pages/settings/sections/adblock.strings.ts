// Ad blocking -- every string this section renders, and the controls
// the page's search field can find in it.
//
// A section owns its own catalogue so that filling one in never touches a file
// another section is being filled in from. The two exports are read by two
// different shared files -- the message map by the app's catalogue
// (`platform/i18n/en.ts`), the control list by the page's registry -- and both
// of those are written once and never edited again to add a control here.

export const adblockStrings = {
  'settings.nav.adblock': 'Ad blocking',
  'settings.adblock.title': 'Ad blocking',
  'settings.adblock.description':
    'Astro blocks ads and trackers itself, with a filter engine built into the ' +
    'browser rather than an extension.',

  'settings.adblock.status.title': 'Nothing on this screen is a control yet',
  'settings.adblock.status.body':
    'The ad blocker is in the browser, but no path reaches it from this page. ' +
    'Three separate things are in the way, and each has to be fixed on its own: ' +
    'the Oxy code the blocker lives in is not linked into the build at all, so ' +
    'none of it runs; its four preferences are registered but are not on the ' +
    'list of preferences the settings API is allowed to serve, so a switch here ' +
    'could not read or write them; and the one piece of code that does talk to ' +
    'the blocker is attached to astro://adblock rather than to this page. Until ' +
    'those are done, what follows is what the browser ships, reported, and not ' +
    'what it is currently doing.',

  'settings.adblock.group.lists': 'Filter lists Astro ships',
  'settings.adblock.list.easylist': 'EasyList',
  'settings.adblock.list.easyprivacy': 'EasyPrivacy',
  'settings.adblock.list.fanboyAnnoyance': "Fanboy's Annoyance List",
  'settings.adblock.list.fanboySocial': "Fanboy's Social Blocking List",
  'settings.adblock.list.peterLowe': "Peter Lowe's Ad and Tracking Server List",
  'settings.adblock.list.germany': 'EasyList Germany',
  'settings.adblock.list.spain': 'EasyList Spain',
  'settings.adblock.list.france': 'Liste FR',
  'settings.adblock.list.china': 'EasyList China',
  'settings.adblock.list.dutch': 'EasyList Dutch',
  'settings.adblock.list.italy': 'EasyList Italy',
  'settings.adblock.list.on': 'On, and updated',
  'settings.adblock.list.off': 'Shipped, never fetched',
  'settings.adblock.lists.footer':
    'Only the two marked as on are ever downloaded. The other nine are in the ' +
    'catalogue the browser compiles in, but nothing stores which of them a user ' +
    'wants, so the updater never asks for them. Choosing one needs a new ' +
    'preference in the browser before it can need a control here.',

  'settings.adblock.group.updates': 'How the lists are kept current',
  'settings.adblock.interval': 'Checked for updates',
  'settings.adblock.interval.value': 'Every 24 hours',
  'settings.adblock.firstCheck': 'First check after Astro starts',
  'settings.adblock.firstCheck.value': 'After 5 minutes',
  'settings.adblock.updates.footer':
    'Each list is re-fetched with an If-Modified-Since header, without cookies, ' +
    'and is refused above 10 MB. Freshness is read from the file on disk: the ' +
    'browser records no last-updated time anywhere this page could report.',
} as const;

/**
 * The controls this section ACTUALLY renders, for search to match on.
 *
 * Only the two rows that report a browser BEHAVIOUR are listed. The eleven
 * filter-list rows are drawn but not listed: they are the contents of a
 * catalogue rather than settings, and putting "EasyList Italy" in the search
 * index would answer a search for a setting with a fact.
 */
export const adblockControls = [
  'settings.adblock.interval',
  'settings.adblock.firstCheck',
] as const;
