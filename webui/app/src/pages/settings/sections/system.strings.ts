// System -- every string this section renders, and the controls
// the page's search field can find in it.
//
// A section owns its own catalogue so that filling one in never touches a file
// another section is being filled in from. The two exports are read by two
// different shared files -- the message map by the app's catalogue
// (`platform/i18n/en.ts`), the control list by the page's registry -- and both
// of those are written once and never edited again to add a control here.

export const systemStrings = {
  'settings.nav.system': 'System',
  'settings.system.title': 'System',

  'settings.system.group.startup': 'Running Astro',
  'settings.system.backgroundMode': 'Keep Astro running when every window is closed',
  'settings.system.backgroundMode.sublabel':
    'Lets extensions and downloads carry on after the last window goes away. ' +
    'Astro stays in the system tray.',
  'settings.system.hardwareAcceleration': 'Use graphics acceleration when it is available',
  'settings.system.hardwareAcceleration.sublabel':
    'Hands rendering to the graphics card. Takes effect after a relaunch.',
  'settings.system.relaunch': 'Relaunch Astro now',
  'settings.system.relaunch.sublabel':
    'Closes every window and starts again. Ordinary windows come back; ' +
    'Incognito windows do not.',
  'settings.system.relaunch.action': 'Relaunch',
  'settings.system.startup.footer':
    'Both of these are stored for the whole installation rather than for this ' +
    'profile, so they change Astro in every profile on this device.',

  'settings.system.group.network': 'Network',
  'settings.system.proxy': 'Proxy',
  'settings.system.proxy.sublabel':
    'Astro uses this device\'s own proxy configuration and has no proxy ' +
    'settings of its own.',
  'settings.system.proxy.managed':
    'A policy or an extension is setting the proxy, so the system settings ' +
    'would not be what Astro uses.',
  'settings.system.proxy.action': 'Open',
  'settings.system.proxy.footer':
    'On Linux this opens whichever network settings your desktop provides ' +
    '(GNOME, KDE, Cinnamon, COSMIC and Deepin are recognised). On a desktop ' +
    'Astro does not recognise it opens astro://linux-proxy-config, which ' +
    'explains how to set a proxy from the command line instead.',
} as const;

/** The controls this section ACTUALLY renders, for search to match on. */
export const systemControls = [
  'settings.system.backgroundMode',
  'settings.system.hardwareAcceleration',
  'settings.system.relaunch',
  'settings.system.proxy',
] as const;
