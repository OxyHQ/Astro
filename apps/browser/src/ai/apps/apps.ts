import { create } from "zustand";
import { alia, aliaReady } from "../alia/api";

export type AppKind = "integration" | "mcp" | "gmail";

export type AppEntry = {
  id: string;
  name: string;
  description: string;
  icon: string;
  kind: AppKind;
  service: string;
  oauth: boolean;
};

export type Connection = { id: string; label: string; status: string };

export const APPS: AppEntry[] = [
  { id: "gmail", name: "Gmail", description: "Read, search and send your mail", icon: "envelope", kind: "gmail", service: "gmail", oauth: true },
  { id: "google-calendar", name: "Google Calendar", description: "Your events and availability", icon: "calendar", kind: "integration", service: "google-calendar", oauth: true },
  { id: "google-drive", name: "Google Drive", description: "Find and read your documents", icon: "folder", kind: "integration", service: "google-drive", oauth: true },
  { id: "notion", name: "Notion", description: "Search, read and write pages", icon: "doc.text", kind: "mcp", service: "notion", oauth: true },
  { id: "github", name: "GitHub", description: "Repositories, issues and pull requests", icon: "chevron.left.forwardslash.chevron.right", kind: "mcp", service: "github-remote", oauth: true },
  { id: "linear", name: "Linear", description: "Issues, projects and cycles", icon: "checkmark.circle", kind: "mcp", service: "linear", oauth: true },
  { id: "microsoft-outlook", name: "Outlook", description: "Mail and calendar in Microsoft 365 or Outlook.com", icon: "envelope", kind: "integration", service: "microsoft-outlook", oauth: true },
  { id: "microsoft-teams", name: "Microsoft Teams", description: "Read and send chat messages, post in channels", icon: "person.2", kind: "integration", service: "microsoft-teams", oauth: true },
  { id: "microsoft-sharepoint", name: "SharePoint and OneDrive", description: "Search and read your work files", icon: "externaldrive", kind: "integration", service: "microsoft-sharepoint", oauth: true },
  { id: "atlassian", name: "Atlassian", description: "Jira issues, Confluence pages and Loom videos", icon: "square.stack", kind: "mcp", service: "atlassian", oauth: true },
  { id: "trello", name: "Trello", description: "Boards, lists and cards", icon: "rectangle.split.3x1", kind: "mcp", service: "trello", oauth: true },
  { id: "figma", name: "Figma", description: "Designs, components and FigJam diagrams", icon: "pencil", kind: "mcp", service: "figma", oauth: true },
  { id: "canva", name: "Canva", description: "Find, create, edit and export designs", icon: "paintpalette", kind: "mcp", service: "canva", oauth: true },
  { id: "zoom", name: "Zoom", description: "Meetings, recordings, transcripts and notes", icon: "video", kind: "mcp", service: "zoom", oauth: true },
  { id: "granola", name: "Granola", description: "Your meeting notes and transcripts", icon: "doc.plaintext", kind: "mcp", service: "granola", oauth: true },
  { id: "amplitude", name: "Amplitude", description: "Charts, dashboards and experiments (US)", icon: "chart.bar", kind: "mcp", service: "amplitude", oauth: true },
  { id: "amplitude-eu", name: "Amplitude EU", description: "Charts, dashboards and experiments (EU data center)", icon: "chart.bar", kind: "mcp", service: "amplitude-eu", oauth: true },
  { id: "salesforce", name: "Salesforce", description: "Query, create and update records in your org", icon: "cloud", kind: "mcp", service: "salesforce", oauth: true },
  { id: "slack", name: "Slack", description: "Channels and messages, with a Slack bot token", icon: "bubble.left", kind: "mcp", service: "slack", oauth: false },
];

export const ALIA_CONNECTORS_URL = "https://alia.onl/settings/connectors";

type Raw = Record<string, unknown>;

const str = (v: unknown) => (typeof v === "string" ? v : "");

type AppsState = {
  connections: Record<string, Connection[]>;
  configured: Record<string, boolean>;
  loadedAt: number | null;
  loading: boolean;
  error: string | null;
  pending: Record<string, number>;
};

export const useApps = create<AppsState>()(() => ({ connections: {}, configured: {}, loadedAt: null, loading: false, error: null, pending: {} }));

const appOfIntegration = (service: string) => APPS.find((a) => a.kind === "integration" && a.service === service);
const appOfMcp = (server: Raw) => APPS.find((a) => a.kind === "mcp" && (a.service === str(server.registryId) || a.service === str(server.name)));

export function connectionsFrom(lists: { integrations: Raw[]; servers: Raw[]; accounts: Raw[] }): Record<string, Connection[]> {
  const out: Record<string, Connection[]> = {};
  const add = (app: AppEntry | undefined, c: Connection) => {
    if (app) (out[app.id] ??= []).push(c);
  };
  for (const i of lists.integrations)
    add(appOfIntegration(str(i.service)), { id: str(i.id) || str(i._id), label: str(i.accountEmail) || str(i.email) || str(i.accountName) || "Connected", status: str(i.status) || "active" });
  for (const s of lists.servers) add(appOfMcp(s), { id: str(s.id) || str(s._id), label: str(s.displayName) || str(s.name), status: str(s.status) || "stopped" });
  for (const a of lists.accounts)
    if (str(a.platform) === "gmail")
      add(
        APPS.find((x) => x.id === "gmail"),
        { id: str(a.id) || str(a._id), label: str(a.email) || str(a.accountEmail) || str(a.displayName) || "Gmail", status: str(a.status) || "active" },
      );
  return out;
}

const listOf = async (path: string, key: string): Promise<Raw[]> => {
  try {
    const r = await alia().get<Record<string, unknown>>(path);
    const list = r.data?.[key];
    return Array.isArray(list) ? (list as Raw[]) : [];
  } catch {
    return [];
  }
};

export async function refreshApps(): Promise<void> {
  if (!aliaReady()) return;
  useApps.setState({ loading: true });
  const [integrations, servers, accounts, available, registry] = await Promise.all([
    listOf("/integrations", "integrations"),
    listOf("/mcp/installed", "servers"),
    listOf("/accounts", "accounts"),
    listOf("/integrations/available", "integrations"),
    listOf("/mcp/registry", "servers"),
  ]);
  useApps.setState({ connections: connectionsFrom({ integrations, servers, accounts }), configured: configuredFrom({ available, registry }), loadedAt: Date.now(), loading: false, error: null });
}

export function configuredFrom(lists: { available: Raw[]; registry: Raw[] }): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const app of APPS) {
    if (app.kind === "gmail") continue;
    const list = app.kind === "integration" ? lists.available : lists.registry;
    const source = list.find((entry) => str(app.kind === "integration" ? entry.service : entry.id) === app.service);
    if (source) out[app.id] = source.configured !== false;
    else if (list.length) out[app.id] = false;
  }
  return out;
}

const PENDING_MS = 15 * 60_000;

const markPending = (app: AppEntry) => useApps.setState((s) => ({ pending: { ...s.pending, [app.kind === "mcp" ? "mcp" : app.kind === "gmail" ? "gmail" : app.service]: Date.now() } }));

export const pendingFor = (key: string) => {
  const at = useApps.getState().pending[key];
  return !!at && Date.now() - at < PENDING_MS;
};

export function clearPending(key: string) {
  useApps.setState((s) => {
    const { [key]: _gone, ...rest } = s.pending;
    return { pending: rest };
  });
}

export async function connectUrl(app: AppEntry): Promise<string> {
  switch (app.kind) {
    case "gmail": {
      const r = await alia().post<{ authUrl?: string }>("/accounts/gmail/connect");
      if (!r.data?.authUrl) throw new Error("Gmail can't be connected right now.");
      markPending(app);
      return r.data.authUrl;
    }
    case "integration": {
      const r = await alia().get<{ authUrl?: string }>(`/integrations/${encodeURIComponent(app.service)}/oauth-url`);
      if (!r.data?.authUrl) throw new Error(`${app.name} can't be connected right now.`);
      markPending(app);
      return r.data.authUrl;
    }
    case "mcp": {
      if (!app.oauth) return ALIA_CONNECTORS_URL;
      const installed = await alia().post<{ server?: Raw }>("/mcp/install", { registryId: app.service });
      const id = str(installed.data?.server?.id) || str(installed.data?.server?._id);
      if (!id) throw new Error(`${app.name} couldn't be added.`);
      const r = await alia().post<{ authorizationUrl?: string }>(`/mcp/${encodeURIComponent(id)}/oauth/start`);
      if (!r.data?.authorizationUrl) throw new Error(`${app.name} can't be connected right now.`);
      markPending(app);
      return r.data.authorizationUrl;
    }
  }
}

export async function disconnect(app: AppEntry, connection: Connection) {
  const path =
    app.kind === "integration"
      ? `/integrations/${encodeURIComponent(connection.id)}`
      : app.kind === "mcp"
        ? `/mcp/${encodeURIComponent(connection.id)}`
        : `/accounts/${encodeURIComponent(connection.id)}`;
  await alia().delete(path);
  await refreshApps();
}

export type OAuthReturn = { kind: "integration"; service: string; state: string; code: string } | { kind: "mcp"; state: string; code: string } | { kind: "gmail" };

const ALIA_APP_HOSTS = new Set(["alia.onl", "www.alia.onl"]);

export function oauthReturnOf(url: string): OAuthReturn | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || !ALIA_APP_HOSTS.has(u.hostname)) return null;
  const q = u.searchParams;
  if (u.pathname === "/settings/integrations" && q.get("int_oauth_state") && q.get("int_oauth_code") && q.get("service"))
    return { kind: "integration", service: q.get("service")!, state: q.get("int_oauth_state")!, code: q.get("int_oauth_code")! };
  if (u.pathname === "/settings/connectors" && q.get("mcp_oauth_state") && q.get("mcp_oauth_code"))
    return { kind: "mcp", state: q.get("mcp_oauth_state")!, code: q.get("mcp_oauth_code")! };
  if (u.pathname === "/settings/accounts" && q.get("connected") === "gmail") return { kind: "gmail" };
  return null;
}

const completed = new Set<string>();

export async function completeOAuth(ret: OAuthReturn): Promise<boolean> {
  if (ret.kind === "gmail") {
    if (!pendingFor("gmail")) return false;
    clearPending("gmail");
    await refreshApps();
    return true;
  }
  const key = ret.kind === "mcp" ? "mcp" : ret.service;
  if (!pendingFor(key) || completed.has(ret.state)) return false;
  completed.add(ret.state);
  clearPending(key);
  if (ret.kind === "integration") await alia().post(`/integrations/${encodeURIComponent(ret.service)}/complete`, { state: ret.state, code: ret.code });
  else await alia().post("/mcp/oauth/complete", { state: ret.state, code: ret.code });
  await refreshApps();
  return true;
}
