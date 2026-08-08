// The 48 content-setting types Site settings covers, as data.
//
// Upstream declares one route per type -- `SITE_SETTINGS_CAMERA`,
// `SITE_SETTINGS_CLIPBOARD`, forty-six more -- and then renders every one of
// them with the SAME element, parameterised by the type. They are one screen,
// not forty-eight, and this table is what makes that true here as well: the
// registry builds one entry per row, all pointing at the same component, and
// the component reads the type back out of the fragment it was reached by.
//
// `route` is the upstream route name, carried so the parity gate can see that
// this page covers it; `segment` is the last part of upstream's own fragment
// (`/content/<segment>`), so a link made against the browser being replaced
// still lands.
//
// Two rows have no upstream fragment to copy. `SITE_SETTINGS_COOKIES` and
// `SITE_SETTINGS_POINTER_LOCK` are declared in `SettingsRoutes` and never
// constructed anywhere in the locked Chromium revision -- measured, not assumed
// (`grep -rn 'SITE_SETTINGS_POINTER_LOCK' chrome/browser/resources` finds the
// declaration and nothing else). Their segments follow the naming every sibling
// uses.

import type {MessageId} from '@astro/platform';

export interface ContentTypeDef {
  /** The upstream route name this row covers. */
  readonly route: string;
  /** The last segment of `/content/<segment>`. */
  readonly segment: string;
  readonly title: MessageId;
}

export const CONTENT_TYPES: readonly ContentTypeDef[] = [
  {route: 'SITE_SETTINGS_ADS', segment: 'ads', title: 'settings.siteSettings.type.ads'},
  {route: 'SITE_SETTINGS_AR', segment: 'ar', title: 'settings.siteSettings.type.ar'},
  {route: 'SITE_SETTINGS_AUTOMATIC_DOWNLOADS', segment: 'automaticDownloads', title: 'settings.siteSettings.type.automaticDownloads'},
  {route: 'SITE_SETTINGS_AUTOMATIC_FULLSCREEN', segment: 'automaticFullScreen', title: 'settings.siteSettings.type.automaticFullScreen'},
  {route: 'SITE_SETTINGS_AUTO_PICTURE_IN_PICTURE', segment: 'autoPictureInPicture', title: 'settings.siteSettings.type.autoPictureInPicture'},
  {route: 'SITE_SETTINGS_AUTO_VERIFY', segment: 'autoVerify', title: 'settings.siteSettings.type.autoVerify'},
  {route: 'SITE_SETTINGS_BACKGROUND_SYNC', segment: 'backgroundSync', title: 'settings.siteSettings.type.backgroundSync'},
  {route: 'SITE_SETTINGS_BLUETOOTH_DEVICES', segment: 'bluetoothDevices', title: 'settings.siteSettings.type.bluetoothDevices'},
  {route: 'SITE_SETTINGS_BLUETOOTH_SCANNING', segment: 'bluetoothScanning', title: 'settings.siteSettings.type.bluetoothScanning'},
  {route: 'SITE_SETTINGS_CAMERA', segment: 'camera', title: 'settings.siteSettings.type.camera'},
  {route: 'SITE_SETTINGS_CAPTURED_SURFACE_CONTROL', segment: 'capturedSurfaceControl', title: 'settings.siteSettings.type.capturedSurfaceControl'},
  {route: 'SITE_SETTINGS_CLIPBOARD', segment: 'clipboard', title: 'settings.siteSettings.type.clipboard'},
  {route: 'SITE_SETTINGS_COOKIES', segment: 'cookies', title: 'settings.siteSettings.type.cookies'},
  {route: 'SITE_SETTINGS_FEDERATED_IDENTITY_API', segment: 'federatedIdentityApi', title: 'settings.siteSettings.type.federatedIdentityApi'},
  {route: 'SITE_SETTINGS_FILE_SYSTEM_WRITE', segment: 'filesystem', title: 'settings.siteSettings.type.filesystem'},
  {route: 'SITE_SETTINGS_HAND_TRACKING', segment: 'handTracking', title: 'settings.siteSettings.type.handTracking'},
  {route: 'SITE_SETTINGS_HID_DEVICES', segment: 'hidDevices', title: 'settings.siteSettings.type.hidDevices'},
  {route: 'SITE_SETTINGS_IDLE_DETECTION', segment: 'idleDetection', title: 'settings.siteSettings.type.idleDetection'},
  {route: 'SITE_SETTINGS_IMAGES', segment: 'images', title: 'settings.siteSettings.type.images'},
  {route: 'SITE_SETTINGS_MIXEDSCRIPT', segment: 'insecureContent', title: 'settings.siteSettings.type.insecureContent'},
  {route: 'SITE_SETTINGS_JAVASCRIPT', segment: 'javascript', title: 'settings.siteSettings.type.javascript'},
  {route: 'SITE_SETTINGS_KEYBOARD_LOCK', segment: 'keyboardLock', title: 'settings.siteSettings.type.keyboardLock'},
  {route: 'SITE_SETTINGS_LOCAL_FONTS', segment: 'localFonts', title: 'settings.siteSettings.type.localFonts'},
  {route: 'SITE_SETTINGS_LOCAL_NETWORK', segment: 'localNetwork', title: 'settings.siteSettings.type.localNetwork'},
  {route: 'SITE_SETTINGS_LOCAL_NETWORK_ACCESS', segment: 'localNetworkAccess', title: 'settings.siteSettings.type.localNetworkAccess'},
  {route: 'SITE_SETTINGS_LOCATION', segment: 'location', title: 'settings.siteSettings.type.location'},
  {route: 'SITE_SETTINGS_LOOPBACK_NETWORK', segment: 'loopbackNetwork', title: 'settings.siteSettings.type.loopbackNetwork'},
  {route: 'SITE_SETTINGS_MICROPHONE', segment: 'microphone', title: 'settings.siteSettings.type.microphone'},
  {route: 'SITE_SETTINGS_MIDI_DEVICES', segment: 'midiDevices', title: 'settings.siteSettings.type.midiDevices'},
  {route: 'SITE_SETTINGS_NOTIFICATIONS', segment: 'notifications', title: 'settings.siteSettings.type.notifications'},
  {route: 'SITE_SETTINGS_PAYMENT_HANDLER', segment: 'paymentHandler', title: 'settings.siteSettings.type.paymentHandler'},
  {route: 'SITE_SETTINGS_PDF_DOCUMENTS', segment: 'pdfDocuments', title: 'settings.siteSettings.type.pdfDocuments'},
  {route: 'SITE_SETTINGS_POINTER_LOCK', segment: 'pointerLock', title: 'settings.siteSettings.type.pointerLock'},
  {route: 'SITE_SETTINGS_POPUPS', segment: 'popups', title: 'settings.siteSettings.type.popups'},
  {route: 'SITE_SETTINGS_PROTECTED_CONTENT', segment: 'protectedContent', title: 'settings.siteSettings.type.protectedContent'},
  {route: 'SITE_SETTINGS_SENSORS', segment: 'sensors', title: 'settings.siteSettings.type.sensors'},
  {route: 'SITE_SETTINGS_SERIAL_PORTS', segment: 'serialPorts', title: 'settings.siteSettings.type.serialPorts'},
  {route: 'SITE_SETTINGS_SITE_DATA', segment: 'siteData', title: 'settings.siteSettings.type.siteData'},
  {route: 'SITE_SETTINGS_SMART_CARD_READERS', segment: 'smartCardReaders', title: 'settings.siteSettings.type.smartCardReaders'},
  {route: 'SITE_SETTINGS_SOUND', segment: 'sound', title: 'settings.siteSettings.type.sound'},
  {route: 'SITE_SETTINGS_STORAGE_ACCESS', segment: 'storageAccess', title: 'settings.siteSettings.type.storageAccess'},
  {route: 'SITE_SETTINGS_USB_DEVICES', segment: 'usbDevices', title: 'settings.siteSettings.type.usbDevices'},
  {route: 'SITE_SETTINGS_JAVASCRIPT_OPTIMIZER', segment: 'v8', title: 'settings.siteSettings.type.v8'},
  {route: 'SITE_SETTINGS_VR', segment: 'vr', title: 'settings.siteSettings.type.vr'},
  {route: 'SITE_SETTINGS_WEB_APP_INSTALLATION', segment: 'webApplications', title: 'settings.siteSettings.type.webApplications'},
  {route: 'SITE_SETTINGS_WEB_PRINTING', segment: 'webPrinting', title: 'settings.siteSettings.type.webPrinting'},
  {route: 'SITE_SETTINGS_WINDOW_MANAGEMENT', segment: 'windowManagement', title: 'settings.siteSettings.type.windowManagement'},
  {route: 'SITE_SETTINGS_ZOOM_LEVELS', segment: 'zoomLevels', title: 'settings.siteSettings.type.zoomLevels'},
];

/** The type a `/content/<segment>` fragment names, or undefined for anything else. */
export function contentTypeForSegment(segment: string): ContentTypeDef | undefined {
  return CONTENT_TYPES.find(type => type.segment === segment);
}
