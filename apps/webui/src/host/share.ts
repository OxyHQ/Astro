import type { ShareAnchor } from "@astro-browser-real/shell";
import { provideNativeModule } from "../../../demo/src/shims/expo-modules-core";
import { setShareServices, showMenu } from "../../../demo/src/shims/web/overlays";
import { callTab } from "./tabBridge";
import { appServices } from "./system";

const SYSTEM_SHARE = /Win/.test(navigator.platform);
const SYSTEM = { id: "system", title: "Share…", symbol: "square.and.arrow.up" };
const SERVICES = [
  ...(SYSTEM_SHARE ? [SYSTEM] : []),
  { id: "email", title: "Email Link", symbol: "envelope" },
  { id: "copy", title: "Copy Link", symbol: "link" },
];

let tabRef: () => string | null = () => null;
export const setShareTabRef = (ref: () => string | null) => void (tabRef = ref);

async function systemShare(url: string, title?: string | null) {
  const ref = SYSTEM_SHARE ? tabRef() : null;
  return !!ref && !!(await callTab<boolean>(ref, "share", { url, title: title ?? "" }));
}

async function shareVia(service: string, url: string, title?: string | null) {
  if (service === SYSTEM.id) return void (await systemShare(url, title));
  if (service === "copy") return void (await navigator.clipboard?.writeText(url).catch(() => {}));
  if (service === "email") await appServices.openExternalURL(`mailto:?subject=${encodeURIComponent(title || url)}&body=${encodeURIComponent(url)}`);
}

async function share(url: string, title?: string | null, _windowId?: string | null, _anchor?: ShareAnchor | null) {
  if (await systemShare(url, title)) return;
  const chosen = await showMenu(SERVICES.filter((service) => service !== SYSTEM));
  if (chosen) await shareVia(chosen, url, title);
}

export function startShare() {
  setShareServices(SERVICES);
  provideNativeModule("AstroApp", { share, shareVia: (service: string, url: string, title?: string | null) => shareVia(service, url, title) });
}
