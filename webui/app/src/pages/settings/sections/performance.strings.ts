// Performance -- every string this section renders, and the controls
// the page's search field can find in it.
//
// A section owns its own catalogue so that filling one in never touches a file
// another section is being filled in from. The two exports are read by two
// different shared files -- the message map by the app's catalogue
// (`platform/i18n/en.ts`), the control list by the page's registry -- and both
// of those are written once and never edited again to add a control here.

export const performanceStrings = {
  'settings.nav.performance': 'Performance',
  'settings.performance.title': 'Performance',
  'settings.performance.preloading.title': 'Preload pages',

  'settings.performance.group.memory': 'Memory',
  'settings.performance.memorySaver': 'Memory Saver',
  'settings.performance.memorySaver.sublabel':
    'Frees the memory held by tabs you have not used for a while. Those tabs ' +
    'reload when you go back to them.',
  'settings.performance.memorySaver.off': 'Off',
  'settings.performance.memorySaver.on': 'On',
  'settings.performance.aggressiveness': 'How soon a tab gives its memory back',
  'settings.performance.aggressiveness.conservative': 'Conservative',
  'settings.performance.aggressiveness.conservative.description':
    'Waits the longest before freeing a tab, so the fewest tabs reload.',
  'settings.performance.aggressiveness.medium': 'Balanced',
  'settings.performance.aggressiveness.medium.description':
    'Frees a tab after it has been unused for a while.',
  'settings.performance.aggressiveness.aggressive': 'Aggressive',
  'settings.performance.aggressiveness.aggressive.description':
    'Frees tabs soonest, which saves the most memory and reloads the most tabs.',
  'settings.performance.exceptions': 'Sites that keep their memory',
  'settings.performance.exceptions.sublabel':
    'Memory Saver never frees a tab on one of these sites.',
  'settings.performance.exceptions.count': '{count} sites',
  'settings.performance.exceptions.footer':
    'Reported rather than edited. The list is a dictionary preference whose ' +
    'entries are added and removed one key at a time, and this page can only ' +
    'write a preference whole.',

  'settings.performance.group.battery': 'Battery',
  'settings.performance.batterySaver': 'Battery Saver',
  'settings.performance.batterySaver.off': 'Off',
  'settings.performance.batterySaver.low': 'Only when the battery is low',
  'settings.performance.batterySaver.low.description':
    'Limits background activity and visual effects once the battery runs down.',
  'settings.performance.batterySaver.unplugged': 'Whenever this device is on battery',
  'settings.performance.batterySaver.unplugged.description':
    'Starts as soon as the charger comes out, whatever the battery level.',
  'settings.performance.battery.footer':
    'These controls do nothing on a device with no battery, which is how ' +
    "Chromium's own settings decides whether to show them at all. Astro shows " +
    'them either way rather than asking the browser, so a desktop reads the ' +
    'stored value instead of an empty section.',

  'settings.performance.group.tabs': 'Tabs',
  'settings.performance.discardRing': 'Ring the tabs whose memory was freed',
  'settings.performance.discardRing.sublabel':
    'Draws a ring around a tab that has been put to sleep, so a reload on ' +
    'return is not a surprise.',
  'settings.performance.intervention': 'Tell me when tabs are slowing Astro down',

  'settings.performance.preloading.link': 'Preload pages',
  'settings.performance.preloading.link.sublabel':
    'Load pages Astro expects you to open, before you open them.',
  'settings.performance.preloading.choice': 'Preloading',
  'settings.performance.preloading.off': 'No preloading',
  'settings.performance.preloading.off.description':
    'Astro never fetches a page you have not asked for. Pages open more slowly.',
  'settings.performance.preloading.standard': 'Standard preloading',
  'settings.performance.preloading.standard.description':
    'Preloads the links Astro expects you to follow from the page you are on.',
  'settings.performance.preloading.extended': 'Extended preloading',
  'settings.performance.preloading.extended.description':
    'Preloads more, including pages linked from sites you visit often. Uses ' +
    'more data and more memory.',
  'settings.performance.preloading.footer':
    'Preloading is local prediction: Astro decides what to fetch from your own ' +
    'browsing, and asks no service what to preload.',
} as const;

/**
 * The controls this section ACTUALLY renders, for search to match on.
 *
 * The preloading SUBPAGE's choice is listed too. The search field opens the
 * section a hit belongs to, and a setting that could not be found because it is
 * one row further in would be a setting the page has and cannot surface.
 */
export const performanceControls = [
  'settings.performance.memorySaver',
  'settings.performance.aggressiveness',
  'settings.performance.exceptions',
  'settings.performance.batterySaver',
  'settings.performance.discardRing',
  'settings.performance.intervention',
  'settings.performance.preloading.link',
  'settings.performance.preloading.choice',
] as const;
