// Alia -- every string this page renders.
//
// The page owns its catalogue, like every other entry in this app, so filling
// it in never touches a file another page is being filled in from.

export const aliaPageStrings = {
  'alia.title': 'Alia',
  'alia.badge': 'AI',

  'alia.pending.title': 'Alia cannot answer from this page yet',
  'alia.pending.body':
    'The assistant is not wired into the browser. This surface is the shell it ' +
    'will be wired into: it is served from inside the binary, it is themed by ' +
    'the browser, and it is the page the side panel opens.',

  'alia.pending.waiting': 'What it is waiting for',
  'alia.pending.isolation': 'A frame that is not this one',
  'alia.pending.isolation.body':
    'A page that can read the browser’s own interfaces must not also hold a ' +
    'conversation with a server. The answer is a second, unprivileged document ' +
    'at astro-untrusted://alia-content, with this page as its shell.',
  'alia.pending.bridge': 'A typed bridge, not a fetch',
  'alia.pending.bridge.body':
    'Requests go to the browser process over a named interface, which is what ' +
    'makes the address the browser talks to a decision recorded in Astro rather ' +
    'than a string in a bundle.',
  'alia.pending.consent': 'A rule about the page you are on',
  'alia.pending.consent.body':
    'The panel is told the address and title of your tab. Nothing may be sent ' +
    'anywhere on the strength of that alone; what is shared, and when, is a ' +
    'permission and not a default.',

  'alia.context.title': 'What the browser has told this panel',
  'alia.context.none':
    'Nothing. This page was opened directly, so it was passed no tab to look at.',
  'alia.context.pageTitle': 'Title',
  'alia.context.pageUrl': 'Address',
  'alia.context.untitled': 'Untitled',
  'alia.context.note':
    'Passed as part of this page’s own address, and only for an ordinary web ' +
    'page. It is displayed here and sent nowhere.',
} as const;
