import { APP_COLOR_PRESETS, type AppColorName } from "@oxy.so/bloom/color-presets";
import { getNormalizedUserHandle, type OxyServices, type User } from "@oxy.so/core";
import { OxyProvider, useAuth } from "@oxy.so/services";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { publishOxyWindow, withdrawOxyWindow, type OxyAccount } from "./session";

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

function OxySessionBridge({ windowId, niloURL, clientId }: { windowId: string; niloURL: string; clientId: string }) {
  const { user, isAuthResolved, canUsePrivateApi, signIn, signOut, oxyServices, showBottomSheet } = useAuth();
  const nilo = useMemo(() => oxyServices.createLinkedClient({ baseURL: niloURL }), [oxyServices, niloURL]);
  const sessionBearer = useMemo(() => () => oxyServices.session.accessToken, [oxyServices]);
  const avatar = useAvatar(oxyServices, user, canUsePrivateApi);
  useEffect(() => () => nilo.dispose(), [nilo]);
  useEffect(() => {
    publishOxyWindow(windowId, {
      resolved: isAuthResolved,
      account: canUsePrivateApi && user ? accountOf(user, avatar) : null,
      niloFetch: nilo.fetch,
      niloSocket: { url: niloURL, token: () => nilo.getAccessToken(niloURL) },
      sessionBearer,
      clientId,
      openSignIn: async () => {
        await signIn();
      },
      openAccountDialog: () => showBottomSheet?.("ManageAccount"),
      closeSession: signOut,
    });
  }, [windowId, isAuthResolved, canUsePrivateApi, user, avatar, nilo, niloURL, sessionBearer, clientId, signIn, signOut, showBottomSheet]);
  useEffect(() => () => withdrawOxyWindow(windowId), [windowId]);
  return null;
}

export function OxyRoot({ windowId, baseURL, clientId, niloURL, children }: OxyEndpoints & { windowId: string; children?: ReactNode }) {
  return (
    <OxyProvider baseURL={baseURL} clientId={clientId}>
      <OxySessionBridge windowId={windowId} niloURL={niloURL} clientId={clientId} />
      {children}
    </OxyProvider>
  );
}
