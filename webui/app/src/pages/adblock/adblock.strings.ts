// The ad blocker page -- every string it renders.
//
// The page owns its catalogue, like every other entry in this app. Distinct
// from `sections/adblock.strings.ts`, which belongs to the settings SECTION
// about ad blocking: that one reports what the build ships and links here, this
// one is the surface with the controls, and keeping the two catalogues apart is
// what stops an edit to one silently rewording the other.

export const adblockPageStrings = {
  'adblock.title': 'Ad blocker',
  'adblock.subtitle':
    'Astro blocks ads and trackers in the browser itself. Nothing is sent anywhere ' +
    'for it to happen, and no extension is involved.',

  'adblock.stat.blocked': 'Blocked on this profile',
  'adblock.stat.lists': 'Filter lists applied',
  // Shown until the browser has answered. Not a zero: a zero is a number
  // someone would read as their real count.
  'adblock.stat.pending': '—',

  'adblock.group.status': 'Blocking',
  'adblock.enabled': 'Block ads and trackers',
  'adblock.enabled.sublabel':
    'Applies to every site except the ones listed below. Turning this off stops ' +
    'blocking immediately.',
  'adblock.status.footer':
    'The count above is every request cancelled on this profile since the browser ' +
    'was installed. It is stored with your settings, not sent anywhere.',

  'adblock.group.exceptions': 'Sites where blocking is off',
  'adblock.exceptions.empty': 'No exceptions. Blocking is on everywhere.',
  'adblock.exceptions.remove': 'Block here again',
  'adblock.exceptions.footer':
    'A site lands here when you switch blocking off from the shield in the toolbar.',
  'adblock.exceptions.refused':
    'That site no longer has an exception — it may have been changed in another ' +
    'window. The list above is what the browser has now.',

  'adblock.group.lists': 'Filter lists',
  'adblock.list.on': 'Applied',
  'adblock.list.off': 'Shipped, not applied',
  'adblock.lists.footer':
    'The catalogue is compiled into the browser, and the two applied lists are the ' +
    'ones it keeps up to date. Choosing others is not something this build can do ' +
    'yet: there is no per-list preference behind a switch to store.',

  'adblock.group.rules': 'Your own rules',
  'adblock.rules.label': 'Custom filter rules',
  'adblock.rules.placeholder':
    '||example.com/ads/*\nexample.com##.ad-banner\n@@||example.com/important.js',
  'adblock.rules.save': 'Save rules',
  'adblock.rules.saved': 'Saved.',
  'adblock.rules.refused':
    'Too long to store, so nothing was saved. Keep it under 64 KB.',
  // The honest part, and it is on the page rather than only in a comment: the
  // preference is real and the text survives, but no code path loads it into
  // the engine, so saving rules does not block anything today.
  'adblock.rules.footer':
    'EasyList syntax, one rule per line. These are stored with your settings and ' +
    'are NOT applied yet: the blocking engine does not read them. Making them work ' +
    'needs the engine to be rebuilt from them and its saved engine to be keyed on ' +
    'them, so that editing a rule is not masked by the fast-start cache.',
} as const;
