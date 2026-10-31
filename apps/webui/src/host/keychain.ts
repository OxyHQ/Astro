import { loadCr } from "./engine";

type KeyReply = string | null | { error: string };

const keyCall = async (method: string, args: Record<string, unknown>) =>
  (await loadCr()).sendWithPromise<KeyReply | boolean>("astroSync", method, args);

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
const slot = (account: string) => `keychain-${toBase64(new TextEncoder().encode(account)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;

export const keychainServices = {
  get: async (account: string): Promise<string | null> => {
    const reply = await keyCall("keyLoad", { account: slot(account) });
    return typeof reply === "string" ? new TextDecoder().decode(fromBase64(reply)) : null;
  },
  set: async (account: string, secret: string): Promise<boolean> =>
    (await keyCall("keySave", { account: slot(account), data: toBase64(new TextEncoder().encode(secret)) })) === true,
  delete: async (account: string): Promise<boolean> => (await keyCall("keyDelete", { account: slot(account) })) === true,
};
