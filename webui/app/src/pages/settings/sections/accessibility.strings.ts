// Accessibility -- every string this section renders, and the controls
// the page's search field can find in it.
//
// A section owns its own catalogue so that filling one in never touches a file
// another section is being filled in from. The two exports are read by two
// different shared files -- the message map by the app's catalogue
// (`platform/i18n/en.ts`), the control list by the page's registry -- and both
// of those are written once and never edited again to add a control here.

import type {SettingsControl} from '../controls.ts';

export const accessibilityStrings = {
  'settings.nav.accessibility': 'Accessibility',
  'settings.accessibility.title': 'Accessibility',
  'settings.accessibility.captions.title': 'Captions',

  'settings.accessibility.group.navigation': 'Moving around a page',
  'settings.accessibility.focusHighlight': 'Highlight whatever has keyboard focus',
  'settings.accessibility.focusHighlight.sublabel':
    'Draws a brief ring around the object a keystroke would act on.',
  'settings.accessibility.caretBrowsing': 'Move around a page with a text cursor',
  'settings.accessibility.caretBrowsing.sublabel':
    'Puts an editing cursor in the page so the arrow keys move through the text. F7 turns it on and off.',
  'settings.accessibility.overscroll': 'Go back and forward by swiping sideways',
  'settings.accessibility.overscroll.sublabel':
    'A two-finger swipe on the trackpad navigates instead of scrolling past the edge.',

  'settings.accessibility.group.notifications': 'Messages from Astro',
  'settings.accessibility.toastLevel': 'Passing messages',
  'settings.accessibility.toastLevel.all': 'Show all of them',
  'settings.accessibility.toastLevel.actionable': 'Only ones with something to do',

  'settings.accessibility.captions.link': 'Captions',
  'settings.accessibility.captions.link.sublabel':
    'How captions look when a video provides them.',
  'settings.accessibility.omitted.footer':
    'Three of the switches Chromium draws on this page are missing on purpose. ' +
    'Image descriptions and the main-node annotations both send page content ' +
    'to a Google service or download a Google-hosted model, and the tree-fixing ' +
    'switch reads an install state Astro has patched out of the browser. A ' +
    'switch for any of them would turn on nothing.',

  'settings.accessibility.captions.description':
    'These apply to the captions a video supplies itself. Astro renders them ' +
    'with these settings in every tab.',
  'settings.accessibility.captions.group.text': 'Text',
  'settings.accessibility.captions.textSize': 'Size',
  'settings.accessibility.captions.textFont': 'Typeface',
  'settings.accessibility.captions.textFont.sublabel':
    'Reported rather than chosen: the list of typefaces installed on this ' +
    'device comes from a handler another section of this page owns.',
  'settings.accessibility.captions.textFont.default': 'Astro default',
  'settings.accessibility.captions.textColour': 'Colour',
  'settings.accessibility.captions.textOpacity': 'Opacity',
  'settings.accessibility.captions.textShadow': 'Edge',

  'settings.accessibility.captions.group.background': 'Background',
  'settings.accessibility.captions.backgroundColour': 'Colour',
  'settings.accessibility.captions.backgroundOpacity': 'Opacity',

  'settings.accessibility.captions.size.verySmall': 'Very small',
  'settings.accessibility.captions.size.small': 'Small',
  'settings.accessibility.captions.size.medium': 'Medium',
  'settings.accessibility.captions.size.large': 'Large',
  'settings.accessibility.captions.size.veryLarge': 'Very large',

  'settings.accessibility.captions.colour.default': 'Astro default',
  'settings.accessibility.captions.colour.black': 'Black',
  'settings.accessibility.captions.colour.white': 'White',
  'settings.accessibility.captions.colour.red': 'Red',
  'settings.accessibility.captions.colour.green': 'Green',
  'settings.accessibility.captions.colour.blue': 'Blue',
  'settings.accessibility.captions.colour.yellow': 'Yellow',
  'settings.accessibility.captions.colour.cyan': 'Cyan',
  'settings.accessibility.captions.colour.magenta': 'Magenta',

  'settings.accessibility.captions.opacity.opaque': 'Solid',
  'settings.accessibility.captions.opacity.semi': 'Semi-transparent',
  'settings.accessibility.captions.opacity.transparent': 'Transparent',

  'settings.accessibility.captions.shadow.none': 'None',
  'settings.accessibility.captions.shadow.raised': 'Raised',
  'settings.accessibility.captions.shadow.depressed': 'Depressed',
  'settings.accessibility.captions.shadow.uniform': 'Outlined',
  'settings.accessibility.captions.shadow.dropShadow': 'Drop shadow',

  'settings.accessibility.captions.footer':
    'There is no live caption control. Live caption transcribes audio with a ' +
    'speech model Chromium downloads from Google as a browser component, and ' +
    'Astro blocks the endpoint that serves it, so the switch would start a ' +
    'download that can never finish.',
} as const;

/**
 * The controls this section ACTUALLY renders, for search to match on.
 *
 * The captions SUBPAGE's controls are listed too, each naming `/captions` as
 * the screen it is on. Only the ones whose label identifies them on its own:
 * "Colour" and "Opacity" each appear twice on that screen, once for the text
 * and once for the background, so neither is a hit a user could act on.
 */
export const accessibilityControls: readonly SettingsControl[] = [
  'settings.accessibility.focusHighlight',
  'settings.accessibility.caretBrowsing',
  'settings.accessibility.overscroll',
  'settings.accessibility.toastLevel',
  'settings.accessibility.captions.link',

  {id: 'settings.accessibility.captions.textSize', on: '/captions'},
  {id: 'settings.accessibility.captions.textFont', on: '/captions'},
  {id: 'settings.accessibility.captions.textShadow', on: '/captions'},
];
