import { APP_COLOR_PRESETS, type AppColorName } from "@oxy.so/bloom/color-presets";
import { getNormalizedUserHandle, type OxyServices, type User } from "@oxy.so/core";
import { OxyProvider, useAuth } from "@oxy.so/services";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useOxySession, type OxyAccount } from "./session";

export type OxyEndpoints = { baseURL: string; clientId: string; niloURL: string };

const AVATAR_VARIANT = "thumb";
const HEX_COLOR = /^#[0-9a-f]{3,8}$/i;

const colorOf = (color: string | null | undefined) =>
  !color ? null : HEX_COLOR.test(color) ? color : (APP_COLOR_PRESETS[color.toLowerCase() as AppColorName]?.hex ?? null);

function accountOf(user: User, avatar: string | null): OxyAccount {
  const handle = getNormalizedUserHandle(user) ?? "";
  return {
    id: user.id,
    name: user.name?.displayName?.trim() || handle,
    handle,
    email: user.email?.trim() || null,
    avatar,
    color: colorOf(user.color),
  };
}

function asDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function loadAvatar(oxyServices: OxyServices, fileId: string): Promise<string | null> {
  const url = await oxyServices.assets.url(fileId, AVATAR_VARIANT);
  const response = await fetch(url);
  if (!response.ok) return null;
  const blob = await response.blob();
  return blob.type.startsWith("image/") ? await asDataUrl(blob) : null;
}

function useAvatar(oxyServices: OxyServices, user: User | null, ready: boolean): string | null {
  const fileId = ready ? (user?.avatar ?? null) : null;
  const [loaded, setLoaded] = useState<{ fileId: string; image: string | null } | null>(null);
  useEffect(() => {
    if (!fileId) return;
    let current = true;
    loadAvatar(oxyServices, fileId)
      .catch(() => null)
      .then((image) => current && setLoaded({ fileId, image }));
    return () => {
      current = false;
    };
  }, [oxyServices, fileId]);
  return fileId && loaded?.fileId === fileId ? loaded.image : null;
}

function OxySessionBridge({ niloURL }: { niloURL: string }) {
  const { user, isAuthResolved, canUsePrivateApi, signIn, signOut, oxyServices, showBottomSheet } = useAuth();
  const nilo = useMemo(() => oxyServices.createLinkedClient({ baseURL: niloURL }), [oxyServices, niloURL]);
  const sessionBearer = useMemo(() => () => oxyServices.session.accessToken, [oxyServices]);
  const avatar = useAvatar(oxyServices, user, canUsePrivateApi);
  useEffect(() => () => nilo.dispose(), [nilo]);
  useEffect(() => {
    useOxySession.setState({
      niloFetch: nilo.fetch,
      niloSocket: { url: niloURL, token: () => nilo.getAccessToken(niloURL) },
      sessionBearer,
      openSignIn: async () => {
        await signIn();
      },
      openAccountDialog: () => showBottomSheet?.("ManageAccount"),
      closeSession: signOut,
    });
  }, [nilo, niloURL, sessionBearer, signIn, signOut, showBottomSheet]);
  useEffect(() => {
    useOxySession.setState({ resolved: isAuthResolved, account: canUsePrivateApi && user ? accountOf(user, avatar) : null });
  }, [isAuthResolved, canUsePrivateApi, user, avatar]);
  useEffect(
    () => () =>
      useOxySession.setState({ resolved: false, account: null, niloFetch: null, niloSocket: null, sessionBearer: null, openSignIn: null, openAccountDialog: null, closeSession: null }),
    [],
  );
  return null;
}

export function OxyRoot({ baseURL, clientId, niloURL, children }: OxyEndpoints & { children?: ReactNode }) {
  return (
    <OxyProvider baseURL={baseURL} clientId={clientId}>
      <OxySessionBridge niloURL={niloURL} />
      {children}
    </OxyProvider>
  );
}
