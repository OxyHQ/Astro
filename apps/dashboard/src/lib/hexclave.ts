import { HexclaveClientApp } from "@hexclave/tanstack-start";
import { HEXCLAVE_PROJECT_ID } from "./project";

export const hexclaveClientApp = new HexclaveClientApp({
  projectId: HEXCLAVE_PROJECT_ID,
  tokenStore: "cookie",
  redirectMethod: "window",
  urls: {
    default: { type: "hosted" },
    signIn: { type: "custom", url: "/sign-in", version: 0 },
    afterSignIn: "/",
    afterSignOut: "/sign-in",
    home: "/",
  },
  analytics: { enabled: false, replays: { enabled: false } },
  devTool: false,
  noAutomaticPrefetch: true,
});
