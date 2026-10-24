import { getNormalizedUserHandle, type User } from "@oxy.so/core";
import { OxyProvider, useAuth } from "@oxy.so/services";
import { useEffect, useMemo } from "react";
import { useOxySession, type OxyAccount } from "./session";

export type OxyEndpoints = { baseURL: string; clientId: string; niloURL: string };

function accountOf(user: User): OxyAccount {
  const handle = getNormalizedUserHandle(user) ?? "";
  return { id: user.id, name: user.name?.displayName?.trim() || handle, handle };
}

function OxySessionBridge({ niloURL }: { niloURL: string }) {
  const { user, isAuthResolved, canUsePrivateApi, signIn, signOut, oxyServices } = useAuth();
  const nilo = useMemo(() => oxyServices.createLinkedClient({ baseURL: niloURL }), [oxyServices, niloURL]);
  useEffect(() => () => nilo.dispose(), [nilo]);
  useEffect(() => {
    useOxySession.setState({
      niloFetch: nilo.fetch,
      openSignIn: async () => {
        await signIn();
      },
      closeSession: signOut,
    });
  }, [nilo, signIn, signOut]);
  useEffect(() => {
    useOxySession.setState({ resolved: isAuthResolved, account: canUsePrivateApi && user ? accountOf(user) : null });
  }, [isAuthResolved, canUsePrivateApi, user]);
  useEffect(() => () => useOxySession.setState({ resolved: false, account: null, niloFetch: null, openSignIn: null, closeSession: null }), []);
  return null;
}

export function OxyRoot({ baseURL, clientId, niloURL }: OxyEndpoints) {
  return (
    <OxyProvider baseURL={baseURL} clientId={clientId}>
      <OxySessionBridge niloURL={niloURL} />
    </OxyProvider>
  );
}
