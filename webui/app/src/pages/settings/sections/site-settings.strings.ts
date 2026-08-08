// Site settings -- every string this section renders, and the controls
// the page's search field can find in it.
//
// A section owns its own catalogue so that filling one in never touches a file
// another section is being filled in from. The two exports are read by two
// different shared files -- the message map by the app's catalogue
// (`platform/i18n/en.ts`), the control list by the page's registry -- and both
// of those are written once and never edited again to add a control here.

export const siteSettingsStrings = {
  'settings.nav.siteSettings': 'Site settings',
  'settings.siteSettings.title': 'Site settings',
  'settings.siteSettings.allSites.title': 'All sites',
  'settings.siteSettings.siteDetails.title': 'Site details',
  'settings.siteSettings.handlers.title': 'Protocol handlers',
  'settings.siteSettings.fileSystemDetails.title': 'File editing details',
  'settings.siteSettings.unknownType':
    'This page routed "{path}" to the permission screen and then found no ' +
    'permission of that name. The route table and the screen disagree; nothing ' +
    'here is editable until they are made to agree again.',
  'settings.siteSettings.type.ads': 'Intrusive ads',
  'settings.siteSettings.type.ar': 'Augmented reality',
  'settings.siteSettings.type.automaticDownloads': 'Automatic downloads',
  'settings.siteSettings.type.automaticFullScreen': 'Automatic full screen',
  'settings.siteSettings.type.autoPictureInPicture': 'Automatic picture-in-picture',
  'settings.siteSettings.type.autoVerify': 'Automatic verification',
  'settings.siteSettings.type.backgroundSync': 'Background sync',
  'settings.siteSettings.type.bluetoothDevices': 'Bluetooth devices',
  'settings.siteSettings.type.bluetoothScanning': 'Bluetooth scanning',
  'settings.siteSettings.type.camera': 'Camera',
  'settings.siteSettings.type.capturedSurfaceControl': 'Scrolling and zooming shared tabs',
  'settings.siteSettings.type.clipboard': 'Clipboard',
  'settings.siteSettings.type.cookies': 'On-device cookies',
  'settings.siteSettings.type.federatedIdentityApi': 'Third-party sign-in',
  'settings.siteSettings.type.filesystem': 'File editing',
  'settings.siteSettings.type.handTracking': 'Hand tracking',
  'settings.siteSettings.type.hidDevices': 'HID devices',
  'settings.siteSettings.type.idleDetection': 'Device use',
  'settings.siteSettings.type.images': 'Images',
  'settings.siteSettings.type.insecureContent': 'Insecure content',
  'settings.siteSettings.type.javascript': 'JavaScript',
  'settings.siteSettings.type.keyboardLock': 'Keyboard lock',
  'settings.siteSettings.type.localFonts': 'Fonts',
  'settings.siteSettings.type.localNetwork': 'Local network',
  'settings.siteSettings.type.localNetworkAccess': 'Local network access',
  'settings.siteSettings.type.location': 'Location',
  'settings.siteSettings.type.loopbackNetwork': 'Loopback network',
  'settings.siteSettings.type.microphone': 'Microphone',
  'settings.siteSettings.type.midiDevices': 'MIDI device control',
  'settings.siteSettings.type.notifications': 'Notifications',
  'settings.siteSettings.type.paymentHandler': 'Payment handlers',
  'settings.siteSettings.type.pdfDocuments': 'PDF documents',
  'settings.siteSettings.type.pointerLock': 'Pointer lock',
  'settings.siteSettings.type.popups': 'Pop-ups and redirects',
  'settings.siteSettings.type.protectedContent': 'Protected content IDs',
  'settings.siteSettings.type.sensors': 'Motion sensors',
  'settings.siteSettings.type.serialPorts': 'Serial ports',
  'settings.siteSettings.type.siteData': 'On-device site data',
  'settings.siteSettings.type.smartCardReaders': 'Smart card readers',
  'settings.siteSettings.type.sound': 'Sound',
  'settings.siteSettings.type.storageAccess': 'Storage access',
  'settings.siteSettings.type.usbDevices': 'USB devices',
  'settings.siteSettings.type.v8': 'JavaScript optimisation',
  'settings.siteSettings.type.vr': 'Virtual reality',
  'settings.siteSettings.type.webApplications': 'Web app installation',
  'settings.siteSettings.type.webPrinting': 'Web printing',
  'settings.siteSettings.type.windowManagement': 'Window management',
  'settings.siteSettings.type.zoomLevels': 'Zoom levels',
} as const;

/**
 * The controls this section ACTUALLY renders, for search to match on.
 *
 * Empty while the section renders none. Listing a control here that the section
 * does not draw makes the search field promise a setting the page cannot show,
 * which is worse than not finding it.
 */
export const siteSettingsControls = [] as const;
