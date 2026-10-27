import assert from "node:assert/strict";
import { test } from "node:test";

globalThis.__DEV__ = false;
await import("../../test-native-stub.mjs");
const apps = await import("./apps.ts");
const { registerAliaApi } = await import("../alia/api.ts");
const { useOxySession } = await import("../../oxy/session.ts");

const calls = [];
const api = {
  get: async (path) => {
    calls.push(`GET ${path}`);
    if (path === "/integrations") return { status: 200, data: { integrations: [{ id: "i1", service: "google-calendar", accountName: "me@example.test", status: "active" }] } };
    if (path === "/mcp/installed") return { status: 200, data: { servers: [{ id: "m1", registryId: "notion", displayName: "Notion", status: "running" }] } };
    if (path === "/accounts") return { status: 200, data: { accounts: [{ id: "a1", platform: "gmail", email: "me@gmail.test", status: "active" }] } };
    if (path === "/integrations/available") return { status: 200, data: { integrations: [{ service: "google-drive", configured: false }] } };
    if (path.endsWith("/oauth-url")) return { status: 200, data: { authUrl: "https://accounts.google.com/o/oauth2/v2/auth?x" } };
    return { status: 404, data: {} };
  },
  post: async (path, body) => {
    calls.push(`POST ${path} ${body ? JSON.stringify(body) : ""}`.trim());
    if (path === "/mcp/install") return { status: 201, data: { server: { id: "m2" } } };
    if (path.endsWith("/oauth/start")) return { status: 200, data: { authorizationUrl: "https://mcp.linear.app/authorize?x" } };
    return { status: 200, data: {} };
  },
  patch: async () => ({ status: 200, data: {} }),
  delete: async (path) => (calls.push(`DELETE ${path}`), { status: 200, data: {} }),
};

test("the apps list reads Alia's integrations, connectors and accounts", async () => {
  registerAliaApi(api);
  useOxySession.setState({ account: { id: "u1" } });
  await apps.refreshApps();
  const s = apps.useApps.getState();
  assert.deepEqual(s.connections["google-calendar"], [{ id: "i1", label: "me@example.test", status: "active" }]);
  assert.equal(s.connections.notion[0].id, "m1");
  assert.equal(s.connections.gmail[0].label, "me@gmail.test");
  assert.equal(s.configured["google-drive"], false);
});

test("connecting a remote connector installs it, then starts its OAuth", async () => {
  calls.length = 0;
  const url = await apps.connectUrl(apps.APPS.find((a) => a.id === "linear"));
  assert.equal(url, "https://mcp.linear.app/authorize?x");
  assert.deepEqual(calls, ['POST /mcp/install {"registryId":"linear"}', "POST /mcp/m2/oauth/start"]);
});

test("Alia's OAuth return on alia.onl is finished by Astro with the person's session, once, and only after a connect", async () => {
  const ret = apps.oauthReturnOf("https://alia.onl/settings/integrations?service=google-calendar&int_oauth_state=s1&int_oauth_code=c1");
  assert.deepEqual(ret, { kind: "integration", service: "google-calendar", state: "s1", code: "c1" });
  assert.equal(apps.oauthReturnOf("https://evil.example/settings/integrations?service=x&int_oauth_state=s&int_oauth_code=c"), null);
  assert.equal(apps.oauthReturnOf("http://alia.onl/settings/connectors?mcp_oauth_state=s&mcp_oauth_code=c"), null);
  assert.deepEqual(apps.oauthReturnOf("https://alia.onl/settings/connectors?mcp_oauth_state=s2&mcp_oauth_code=c2"), { kind: "mcp", state: "s2", code: "c2" });
  calls.length = 0;
  assert.equal(await apps.completeOAuth(ret), false);
  await apps.connectUrl(apps.APPS.find((a) => a.id === "google-calendar"));
  assert.equal(await apps.completeOAuth(ret), true);
  assert.equal(await apps.completeOAuth(ret), false);
  assert.ok(calls.includes('POST /integrations/google-calendar/complete {"state":"s1","code":"c1"}'));
  calls.length = 0;
  await apps.disconnect(apps.APPS.find((a) => a.id === "gmail"), { id: "a1", label: "", status: "" });
  assert.equal(calls[0], "DELETE /accounts/a1");
});
