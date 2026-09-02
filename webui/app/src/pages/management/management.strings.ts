// Management -- every string this page renders as its own.
//
// Short, because most of what this page shows is the BROWSER's text: the status
// line, the four section subtitles and the threat-protection description all
// arrive from the adopted upstream handler, and the reporting rows resolve
// their labels out of the browser's string table. What is here is the framing
// around them, plus the one sentence Astro had to write for itself.

export const managementStrings = {
  'management.title': 'Management',

  // THE ONE SENTENCE ASTRO WRITES, and the reason it is not the browser's.
  //
  // Upstream sends a `browserManagementNotice` that is HTML, not text: it
  // carries a whole `<a target="_blank" href="https://support.google.com/
  // chrome?p=is_chrome_managed">Learn more</a>` inside it, and it says
  // "Activity on this device may be managed outside of Chromium" in a browser
  // called Astro. Injecting it would also be blocked outright by Trusted Types
  // on a trusted WebUI page. So the fact is restated here, in the product's own
  // name, with nothing to click off the machine.
  'management.notice.unmanaged':
    'No company or organisation controls this browser. Software outside Astro — ' +
    'your operating system, or something else installed on this device — can ' +
    'still see or change what happens here, and this page cannot tell you about ' +
    'that.',
  'management.notice.managed':
    'The sections below are what your administrator has configured, as the ' +
    'browser reports it.',

  'management.group.reporting.browser': 'What this browser reports',
  'management.group.reporting.profile': 'What this profile reports',
  'management.group.extensions': 'Extensions your administrator installed',
  'management.group.applications': 'Applications your administrator installed',
  'management.group.websites': 'Websites your administrator sends data to',
  'management.group.threats': 'Content and threat inspection',

  'management.empty': 'Nothing.',
  'management.permissions': 'Has access to: {permissions}',

  // A reporting row whose message name the browser's table does not carry.
  // Shown as the raw name rather than blanked: a blank row on this page reads
  // as "the browser reports nothing", which is the opposite of what an
  // unresolvable label means.
  'management.reporting.unresolved': 'Unnamed reporting item ({id})',

  'management.pending': 'Asking the browser…',
} as const;
