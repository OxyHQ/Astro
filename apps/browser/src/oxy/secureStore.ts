import { keychainDelete, keychainGet, keychainSet } from "@astro-browser/shell";

const account = (key: string) => `oxy:${key}`;

export async function getItemAsync(key: string): Promise<string | null> {
  return (await keychainGet(account(key))) ?? null;
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  if (!(await keychainSet(account(key), value))) throw new Error(`Keychain refused ${key}`);
}

export async function deleteItemAsync(key: string): Promise<void> {
  await keychainDelete(account(key));
}
