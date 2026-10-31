import { requireNativeModule } from "expo-modules-core";

const Keychain = requireNativeModule<{
  get(account: string): Promise<string | null>;
  set(account: string, secret: string): Promise<boolean>;
  delete(account: string): Promise<boolean>;
}>("AstroKeychain");

export const keychainGet = (account: string) => Keychain.get(account);
export const keychainSet = (account: string, secret: string) => Keychain.set(account, secret);
export const keychainDelete = (account: string) => Keychain.delete(account);
