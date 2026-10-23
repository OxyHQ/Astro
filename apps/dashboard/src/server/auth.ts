import { HexclaveServerApp } from "@hexclave/tanstack-start";
import { getRequest } from "@tanstack/react-start/server";
import { HEXCLAVE_PROJECT_ID } from "../lib/project";
import { devAuthBypass, serverEnv } from "./env";

export type Viewer =
  | { state: "signed-out" }
  | { state: "denied"; email: string | null }
  | { state: "allowed"; email: string };

let app: HexclaveServerApp | null = null;

function serverApp() {
  if (app) return app;
  const secretServerKey = serverEnv("HEXCLAVE_SECRET_SERVER_KEY");
  if (!secretServerKey) throw new Error("HEXCLAVE_SECRET_SERVER_KEY is not set");
  app = new HexclaveServerApp({
    projectId: serverEnv("HEXCLAVE_PROJECT_ID") ?? HEXCLAVE_PROJECT_ID,
    secretServerKey,
    tokenStore: null,
    urls: { default: { type: "hosted" } },
  });
  return app;
}

function allowedEmails(): Set<string> {
  const raw = serverEnv("DASHBOARD_ALLOWED_EMAILS") ?? "";
  return new Set(
    raw
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function currentViewer(): Promise<Viewer> {
  if (devAuthBypass()) return { state: "allowed", email: "dev-bypass@localhost" };
  const request = getRequest();
  const user = await serverApp().getUser({ tokenStore: request });
  if (!user) return { state: "signed-out" };
  const email = user.primaryEmail?.trim().toLowerCase() || null;
  if (!email || !user.primaryEmailVerified || !allowedEmails().has(email)) return { state: "denied", email };
  return { state: "allowed", email };
}
