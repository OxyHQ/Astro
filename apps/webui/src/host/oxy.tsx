import { lazy, Suspense, useEffect } from "react";
import { afterFirstWindow } from "../../../browser/src/lib/afterFirstWindow";
import { useOxySession } from "../../../browser/src/oxy/session";
import { oxyEndpoints as endpoints } from "./oxyEndpoints";

const OxyLayer = lazy(() => import("./OxyLayer"));

let deferred = false;

export function OxyHost() {
  const wanted = useOxySession((s) => s.wanted);
  useEffect(() => {
    if (deferred || !endpoints.clientId) return;
    deferred = true;
    afterFirstWindow(() => useOxySession.setState({ wanted: true }));
  }, []);
  if (!wanted || !endpoints.clientId) return null;
  return (
    <Suspense fallback={null}>
      <OxyLayer {...endpoints} />
    </Suspense>
  );
}
