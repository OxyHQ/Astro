// Downloads -- every string this section renders, and the controls
// the page's search field can find in it.
//
// A section owns its own catalogue so that filling one in never touches a file
// another section is being filled in from. The two exports are read by two
// different shared files -- the message map by the app's catalogue
// (`platform/i18n/en.ts`), the control list by the page's registry -- and both
// of those are written once and never edited again to add a control here.

export const downloadsStrings = {
  'settings.nav.downloads': 'Downloads',
  'settings.downloads.title': 'Downloads',

  'settings.downloads.location': 'Where downloads go',
  'settings.downloads.location.change': 'Change',
  'settings.downloads.prompt': 'Ask where to save each file',
  'settings.downloads.prompt.sublabel':
    'When this is off, files are saved to the folder above without asking.',
  'settings.downloads.bubble': 'Show a summary when a download finishes',
  'settings.downloads.bubble.sublabel':
    'A panel opens from the toolbar with what has just been downloaded.',

  'settings.downloads.autoOpen': 'Open certain file types automatically',
  'settings.downloads.autoOpen.sublabel':
    'You have told Astro to open some kinds of file as soon as they finish downloading.',
  'settings.downloads.autoOpen.none':
    'No file type is set to open automatically, so there is nothing to clear.',
  'settings.downloads.autoOpen.reset': 'Clear',
  'settings.downloads.autoOpen.unknown':
    'The browser did not say whether any file type is set to open automatically, so this cannot be cleared from here.',
} as const;

/**
 * The controls this section ACTUALLY renders, for search to match on.
 *
 * Listing a control here that the section does not draw makes the search field
 * promise a setting the page cannot show, which is worse than not finding it.
 */
export const downloadsControls = [
  'settings.downloads.location',
  'settings.downloads.prompt',
  'settings.downloads.bubble',
  'settings.downloads.autoOpen',
] as const;
