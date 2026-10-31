import { engineCall } from "./engine";

export const renameDownload = (id: string, name: string, profile = "", options: { tidy?: boolean } = {}) =>
  engineCall<{ filename: string }>("ac_downloads_rename", profile, { id, name, tidy: !!options.tidy });
