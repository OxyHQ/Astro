import { TRAFFIC_LIGHT_DIAMETER, TRAFFIC_LIGHT_SPACING, TrafficLights, useTrafficLightsCenter } from "../../demo/src/shims/web/windowChrome";
import { windowButtonsHost } from "../../browser/src/components/layout/windowButtons";
import { Portal, usePortalHostPresent } from "../../demo/src/shims/web/portal";
import { AppMenuButton } from "./AppMenu";
import { confirmWindowClose } from "./host/quit";
import { tabHub } from "./host/tabs";
import { pageWindowId } from "./host/windows";
import { emitWindowEvent } from "./shims/shell";

let maximized = false;

const ACTIONS = [
  {
    name: "close",
    run: () => {
      const id = pageWindowId();
      if (id) void confirmWindowClose(id).then((confirmed) => confirmed && emitWindowEvent({ type: "closeRequest", id }));
      else void tabHub().then((hub) => hub.closePage());
    },
  },
  { name: "minimize", run: () => void tabHub().then((hub) => hub.page.minimize()) },
  {
    name: "zoom",
    run: () =>
      void tabHub().then((hub) => {
        maximized = !maximized;
        if (maximized) hub.page.maximize();
        else hub.page.restore();
      }),
  },
];

export function WindowControls() {
  const at = useTrafficLightsCenter();
  if (!at) return null;
  return (
    <>
      <TrafficLights />
      {ACTIONS.map(({ name, run }, i) => (
        <button
          key={name}
          type="button"
          aria-label={name}
          className="astro-window-control"
          onClick={run}
          style={{
            left: at[0] + i * TRAFFIC_LIGHT_SPACING - TRAFFIC_LIGHT_DIAMETER / 2,
            top: at[1] - TRAFFIC_LIGHT_DIAMETER / 2,
            width: TRAFFIC_LIGHT_DIAMETER,
            height: TRAFFIC_LIGHT_DIAMETER,
          }}
        />
      ))}
    </>
  );
}

export function WindowButtons({ windowId }: { windowId: string }) {
  const host = windowButtonsHost(windowId);
  const inRegion = usePortalHostPresent(host);
  const buttons = (
    <>
      <WindowControls />
      <AppMenuButton />
    </>
  );
  return inRegion ? <Portal host={host}>{buttons}</Portal> : buttons;
}
