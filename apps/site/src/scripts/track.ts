import { capture } from "./telemetry";

export type Props = Record<string, string | number | boolean | null>;

export function track(event: string, props?: Props, options?: { send_instantly?: boolean }) {
  capture(event, props, options);
}
