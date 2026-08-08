// Alia -- every string this section renders, and the controls
// the page's search field can find in it.
//
// A section owns its own catalogue so that filling one in never touches a file
// another section is being filled in from. The two exports are read by two
// different shared files -- the message map by the app's catalogue
// (`platform/i18n/en.ts`), the control list by the page's registry -- and both
// of those are written once and never edited again to add a control here.

export const aliaStrings = {
  'settings.nav.alia': 'Alia',
  'settings.alia.title': 'Alia',
  'settings.alia.description':
    'Oxy\'s assistant, built into the browser as a side panel rather than as an ' +
    'extension.',

  'settings.alia.status.title': 'There is nothing to configure yet',
  'settings.alia.status.body':
    'Everything about the panel is fixed in the browser: which address it ' +
    'opens, that it passes the current page\'s address and title along as ' +
    'context, and that it is available in every ordinary window. None of those ' +
    'is stored as a preference, so there is no value for this page to change. ' +
    'The one Alia preference that does exist governs the widget on the New Tab ' +
    'page, and it is not on the list of preferences the settings API is allowed ' +
    'to serve, so this page cannot reach it either.',

  'settings.alia.group.panel': 'The panel',
  'settings.alia.context': 'What the panel is told',
  'settings.alia.context.value': 'The address and title of the tab you are on',
  'settings.alia.context.sublabel':
    'Sent only for ordinary web pages. A browser page such as this one is never ' +
    'passed along.',
  'settings.alia.open': 'Open Alia',
  'settings.alia.open.sublabel': 'Opens the assistant as a full page.',
} as const;

/**
 * The controls this section ACTUALLY renders, for search to match on.
 *
 * The context row is a read-only fact rather than a setting, and is listed
 * anyway: what an assistant is told about the page you are on is the thing
 * someone comes to this section to find out.
 */
export const aliaControls = ['settings.alia.context', 'settings.alia.open'] as const;
