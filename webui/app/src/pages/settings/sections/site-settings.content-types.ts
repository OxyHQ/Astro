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
//
// THREE FIELDS BEYOND THE ROUTE, and each is the answer to a question the
// screens could not otherwise ask:
//
//   `contentType` is the string the C++ side knows the permission by, from the
//   group-name table in chrome/browser/ui/webui/settings/site_settings_helper.cc.
//   It is NOT derivable from the segment -- `camera` is `media-stream-camera`,
//   `insecureContent` is `mixed-script`, `autoVerify` is `anti-abuse`, `v8` is
//   `javascript-optimizer`. It is absent for the four types that exist only in
//   the WebUI (`pdfDocuments`, `siteData`, `zoomLevels` have no C++ content
//   setting) and for `pointerLock`, whose group name is explicitly `nullptr`
//   because the permission is deprecated. That absence is load-bearing:
//   `HandleGetDefaultValueForContentType` NOTREACHEDs on a name that does not
//   map to a registered content setting, so calling it for one of those five
//   would take the renderer down.
//
//   `defaultBehaviour` is which `ContentSetting` the "enabled" half of the
//   default control writes -- upstream's `getAllowOptionForCategory_`, which is
//   `allow` for a permission a site simply has and `ask` for one a site must
//   prompt for. Absent where upstream renders no default control at all: those
//   screens are an exception list (`automaticFullScreen`, `insecureContent`), a
//   three-way pref (`v8`), a page of its own (`cookies`, `siteData`,
//   `zoomLevels`, `pdfDocuments`), or nothing (`pointerLock`).
//
//   `group` is where the category list shows the row, mirroring upstream's own
//   four lists. Absent means upstream lists it nowhere: `cookies` and
//   `pointerLock` have no page, and `smartCardReaders` is gated to ChromeOS.
//   Those stay routed -- a deep link still lands -- and are simply not linked.

import type {MessageId} from '@astro/platform';

/** Upstream's four category lists on the site settings page, in its own names. */
export type CategoryGroup =
  | 'permissionsBasic'
  | 'permissionsAdvanced'
  | 'contentBasic'
  | 'contentAdvanced';

export interface ContentTypeDef {
  /** The upstream route name this row covers. */
  readonly route: string;
  /** The last segment of `/content/<segment>`. */
  readonly segment: string;
  readonly title: MessageId;
  /** The C++ group name, where the permission has one. */
  readonly contentType?: string;
  /** What the "enabled" half of the default control writes. */
  readonly defaultBehaviour?: 'allow' | 'ask';
  /** Which list on the category screen the row belongs to. */
  readonly group?: CategoryGroup;
}

export const CONTENT_TYPES: readonly ContentTypeDef[] = [
  {route: 'SITE_SETTINGS_ADS', segment: 'ads', title: 'settings.siteSettings.type.ads', contentType: 'ads', defaultBehaviour: 'allow', group: 'contentAdvanced'},
  {route: 'SITE_SETTINGS_AR', segment: 'ar', title: 'settings.siteSettings.type.ar', contentType: 'ar', defaultBehaviour: 'ask', group: 'permissionsAdvanced'},
  {route: 'SITE_SETTINGS_AUTOMATIC_DOWNLOADS', segment: 'automaticDownloads', title: 'settings.siteSettings.type.automaticDownloads', contentType: 'multiple-automatic-downloads', defaultBehaviour: 'ask', group: 'permissionsAdvanced'},
  // Exceptions only upstream: the page carries a read-only exception list and
  // no default control, so there is no `defaultBehaviour` to offer.
  {route: 'SITE_SETTINGS_AUTOMATIC_FULLSCREEN', segment: 'automaticFullScreen', title: 'settings.siteSettings.type.automaticFullScreen', contentType: 'automatic-fullscreen', group: 'contentAdvanced'},
  {route: 'SITE_SETTINGS_AUTO_PICTURE_IN_PICTURE', segment: 'autoPictureInPicture', title: 'settings.siteSettings.type.autoPictureInPicture', contentType: 'auto-picture-in-picture', defaultBehaviour: 'ask', group: 'permissionsAdvanced'},
  // Upstream draws this one as a switch rather than a radio pair, but writes
  // the same allow/block through the same message, so it is the same control.
  {route: 'SITE_SETTINGS_AUTO_VERIFY', segment: 'autoVerify', title: 'settings.siteSettings.type.autoVerify', contentType: 'anti-abuse', defaultBehaviour: 'allow', group: 'contentAdvanced'},
  {route: 'SITE_SETTINGS_BACKGROUND_SYNC', segment: 'backgroundSync', title: 'settings.siteSettings.type.backgroundSync', contentType: 'background-sync', defaultBehaviour: 'allow', group: 'permissionsAdvanced'},
  {route: 'SITE_SETTINGS_BLUETOOTH_DEVICES', segment: 'bluetoothDevices', title: 'settings.siteSettings.type.bluetoothDevices', contentType: 'bluetooth-devices', defaultBehaviour: 'ask', group: 'permissionsAdvanced'},
  {route: 'SITE_SETTINGS_BLUETOOTH_SCANNING', segment: 'bluetoothScanning', title: 'settings.siteSettings.type.bluetoothScanning', contentType: 'bluetooth-scanning', defaultBehaviour: 'ask', group: 'permissionsAdvanced'},
  {route: 'SITE_SETTINGS_CAMERA', segment: 'camera', title: 'settings.siteSettings.type.camera', contentType: 'media-stream-camera', defaultBehaviour: 'ask', group: 'permissionsBasic'},
  {route: 'SITE_SETTINGS_CAPTURED_SURFACE_CONTROL', segment: 'capturedSurfaceControl', title: 'settings.siteSettings.type.capturedSurfaceControl', contentType: 'captured-surface-control', defaultBehaviour: 'ask', group: 'permissionsAdvanced'},
  {route: 'SITE_SETTINGS_CLIPBOARD', segment: 'clipboard', title: 'settings.siteSettings.type.clipboard', contentType: 'clipboard', defaultBehaviour: 'ask', group: 'permissionsAdvanced'},
  // Routed but never listed, exactly as upstream: the third-party cookie
  // controls live on the privacy section's own `/cookies` screen.
  {route: 'SITE_SETTINGS_COOKIES', segment: 'cookies', title: 'settings.siteSettings.type.cookies'},
  {route: 'SITE_SETTINGS_FEDERATED_IDENTITY_API', segment: 'federatedIdentityApi', title: 'settings.siteSettings.type.federatedIdentityApi', contentType: 'federated-identity-api', defaultBehaviour: 'allow', group: 'contentAdvanced'},
  {route: 'SITE_SETTINGS_FILE_SYSTEM_WRITE', segment: 'filesystem', title: 'settings.siteSettings.type.filesystem', contentType: 'file-system-write', defaultBehaviour: 'ask', group: 'permissionsAdvanced'},
  {route: 'SITE_SETTINGS_HAND_TRACKING', segment: 'handTracking', title: 'settings.siteSettings.type.handTracking', contentType: 'hand-tracking', defaultBehaviour: 'ask', group: 'permissionsAdvanced'},
  {route: 'SITE_SETTINGS_HID_DEVICES', segment: 'hidDevices', title: 'settings.siteSettings.type.hidDevices', contentType: 'hid-devices', defaultBehaviour: 'ask', group: 'permissionsAdvanced'},
  {route: 'SITE_SETTINGS_IDLE_DETECTION', segment: 'idleDetection', title: 'settings.siteSettings.type.idleDetection', contentType: 'idle-detection', defaultBehaviour: 'ask', group: 'permissionsAdvanced'},
  {route: 'SITE_SETTINGS_IMAGES', segment: 'images', title: 'settings.siteSettings.type.images', contentType: 'images', defaultBehaviour: 'allow', group: 'contentBasic'},
  // Exceptions only upstream, same as automatic full screen.
  {route: 'SITE_SETTINGS_MIXEDSCRIPT', segment: 'insecureContent', title: 'settings.siteSettings.type.insecureContent', contentType: 'mixed-script', group: 'contentAdvanced'},
  {route: 'SITE_SETTINGS_JAVASCRIPT', segment: 'javascript', title: 'settings.siteSettings.type.javascript', contentType: 'javascript', defaultBehaviour: 'allow', group: 'contentBasic'},
  {route: 'SITE_SETTINGS_KEYBOARD_LOCK', segment: 'keyboardLock', title: 'settings.siteSettings.type.keyboardLock', contentType: 'keyboard-lock', defaultBehaviour: 'ask', group: 'permissionsAdvanced'},
  {route: 'SITE_SETTINGS_LOCAL_FONTS', segment: 'localFonts', title: 'settings.siteSettings.type.localFonts', contentType: 'local-fonts', defaultBehaviour: 'ask', group: 'permissionsAdvanced'},
  {route: 'SITE_SETTINGS_LOCAL_NETWORK', segment: 'localNetwork', title: 'settings.siteSettings.type.localNetwork', contentType: 'local-network', defaultBehaviour: 'ask', group: 'permissionsAdvanced'},
  {route: 'SITE_SETTINGS_LOCAL_NETWORK_ACCESS', segment: 'localNetworkAccess', title: 'settings.siteSettings.type.localNetworkAccess', contentType: 'local-network-access', defaultBehaviour: 'ask', group: 'permissionsAdvanced'},
  {route: 'SITE_SETTINGS_LOCATION', segment: 'location', title: 'settings.siteSettings.type.location', contentType: 'location', defaultBehaviour: 'ask', group: 'permissionsBasic'},
  {route: 'SITE_SETTINGS_LOOPBACK_NETWORK', segment: 'loopbackNetwork', title: 'settings.siteSettings.type.loopbackNetwork', contentType: 'loopback-network', defaultBehaviour: 'ask', group: 'permissionsAdvanced'},
  {route: 'SITE_SETTINGS_MICROPHONE', segment: 'microphone', title: 'settings.siteSettings.type.microphone', contentType: 'media-stream-mic', defaultBehaviour: 'ask', group: 'permissionsBasic'},
  {route: 'SITE_SETTINGS_MIDI_DEVICES', segment: 'midiDevices', title: 'settings.siteSettings.type.midiDevices', contentType: 'midi-sysex', defaultBehaviour: 'ask', group: 'permissionsAdvanced'},
  {route: 'SITE_SETTINGS_NOTIFICATIONS', segment: 'notifications', title: 'settings.siteSettings.type.notifications', contentType: 'notifications', defaultBehaviour: 'ask', group: 'permissionsBasic'},
  {route: 'SITE_SETTINGS_PAYMENT_HANDLER', segment: 'paymentHandler', title: 'settings.siteSettings.type.paymentHandler', contentType: 'payment-handler', defaultBehaviour: 'allow', group: 'permissionsAdvanced'},
  // No C++ content setting: `pdfDocuments` is a WebUI-only name for the
  // `plugins.always_open_pdf_externally` pref.
  {route: 'SITE_SETTINGS_PDF_DOCUMENTS', segment: 'pdfDocuments', title: 'settings.siteSettings.type.pdfDocuments', group: 'contentAdvanced'},
  // Deprecated: the group-name table maps POINTER_LOCK to nullptr, so the
  // permission is unreachable from the WebUI at all. Routed, never listed.
  {route: 'SITE_SETTINGS_POINTER_LOCK', segment: 'pointerLock', title: 'settings.siteSettings.type.pointerLock'},
  {route: 'SITE_SETTINGS_POPUPS', segment: 'popups', title: 'settings.siteSettings.type.popups', contentType: 'popups', defaultBehaviour: 'allow', group: 'contentBasic'},
  {route: 'SITE_SETTINGS_PROTECTED_CONTENT', segment: 'protectedContent', title: 'settings.siteSettings.type.protectedContent', contentType: 'protected-content', defaultBehaviour: 'allow', group: 'contentAdvanced'},
  {route: 'SITE_SETTINGS_SENSORS', segment: 'sensors', title: 'settings.siteSettings.type.sensors', contentType: 'sensors', defaultBehaviour: 'allow', group: 'permissionsAdvanced'},
  {route: 'SITE_SETTINGS_SERIAL_PORTS', segment: 'serialPorts', title: 'settings.siteSettings.type.serialPorts', contentType: 'serial-ports', defaultBehaviour: 'ask', group: 'permissionsAdvanced'},
  // WebUI-only name, like pdfDocuments: on-device site data is a view over the
  // cookie prefs rather than a content setting of its own.
  {route: 'SITE_SETTINGS_SITE_DATA', segment: 'siteData', title: 'settings.siteSettings.type.siteData', group: 'contentAdvanced'},
  // Gated to ChromeOS upstream. The permission is real and the default control
  // works, so the screen is left whole; it is simply not linked on a build that
  // has no smart card readers.
  {route: 'SITE_SETTINGS_SMART_CARD_READERS', segment: 'smartCardReaders', title: 'settings.siteSettings.type.smartCardReaders', contentType: 'smart-card-readers', defaultBehaviour: 'ask'},
  {route: 'SITE_SETTINGS_SOUND', segment: 'sound', title: 'settings.siteSettings.type.sound', contentType: 'sound', defaultBehaviour: 'allow', group: 'contentAdvanced'},
  {route: 'SITE_SETTINGS_STORAGE_ACCESS', segment: 'storageAccess', title: 'settings.siteSettings.type.storageAccess', contentType: 'storage-access', defaultBehaviour: 'ask', group: 'permissionsBasic'},
  {route: 'SITE_SETTINGS_USB_DEVICES', segment: 'usbDevices', title: 'settings.siteSettings.type.usbDevices', contentType: 'usb-devices', defaultBehaviour: 'ask', group: 'permissionsAdvanced'},
  // Three-way upstream, over the `generated.javascript_optimizer` pref rather
  // than the content setting, so the two-way default control does not fit it.
  {route: 'SITE_SETTINGS_JAVASCRIPT_OPTIMIZER', segment: 'v8', title: 'settings.siteSettings.type.v8', contentType: 'javascript-optimizer', group: 'contentAdvanced'},
  {route: 'SITE_SETTINGS_VR', segment: 'vr', title: 'settings.siteSettings.type.vr', contentType: 'vr', defaultBehaviour: 'ask', group: 'permissionsAdvanced'},
  {route: 'SITE_SETTINGS_WEB_APP_INSTALLATION', segment: 'webApplications', title: 'settings.siteSettings.type.webApplications', contentType: 'web-app-installation', defaultBehaviour: 'ask', group: 'permissionsAdvanced'},
  {route: 'SITE_SETTINGS_WEB_PRINTING', segment: 'webPrinting', title: 'settings.siteSettings.type.webPrinting', contentType: 'web-printing', defaultBehaviour: 'ask', group: 'permissionsAdvanced'},
  {route: 'SITE_SETTINGS_WINDOW_MANAGEMENT', segment: 'windowManagement', title: 'settings.siteSettings.type.windowManagement', contentType: 'window-management', defaultBehaviour: 'ask', group: 'permissionsAdvanced'},
  // WebUI-only name: zoom levels are a list the handler reports, not a content
  // setting with a default.
  {route: 'SITE_SETTINGS_ZOOM_LEVELS', segment: 'zoomLevels', title: 'settings.siteSettings.type.zoomLevels', group: 'contentAdvanced'},
];

/** The type a `/content/<segment>` fragment names, or undefined for anything else. */
export function contentTypeForSegment(segment: string): ContentTypeDef | undefined {
  return CONTENT_TYPES.find(type => type.segment === segment);
}
