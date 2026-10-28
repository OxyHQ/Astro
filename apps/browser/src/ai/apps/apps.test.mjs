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
    if (path === "/integrations")
      return {
        status: 200,
        data: {
          integrations: [
            { id: "i1", service: "google-calendar", accountName: "me@example.test", status: "active" },
            { id: "i2", service: "microsoft-outlook", accountName: "me@contoso.test", status: "active" },
          ],
        },
      };
    if (path === "/mcp/installed")
      return {
        status: 200,
        data: {
          servers: [
            { id: "m1", registryId: "notion", displayName: "Notion", status: "running" },
            { id: "m3", registryId: "atlassian", displayName: "Atlassian", status: "running" },
          ],
        },
      };
    if (path === "/accounts") return { status: 200, data: { accounts: [{ id: "a1", platform: "gmail", email: "me@gmail.test", status: "active" }] } };
    if (path === "/integrations/available")
      return {
        status: 200,
        data: {
          integrations: [
            { service: "google-drive", configured: false },
            { service: "microsoft-outlook", configured: true, revokeAt: "https://myapps.microsoft.com" },
            { service: "microsoft-teams", configured: false },
          ],
        },
      };
    if (path === "/mcp/registry")
      return {
        status: 200,
        data: {
          servers: [
            { id: "atlassian", configured: true },
            { id: "canva", configured: false },
            { id: "zoom", configured: false },
            { id: "linear", configured: true },
            { id: "google-drive", configured: true },
          ],
        },
      };
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
  assert.deepEqual(s.connections["microsoft-outlook"], [{ id: "i2", label: "me@contoso.test", status: "active" }]);
  assert.equal(s.connections.atlassian[0].id, "m3");
});

test("an app Alia can't connect yet reads as not configured, whichever list it comes from", () => {
  const s = apps.useApps.getState();
  assert.equal(s.configured["microsoft-outlook"], true);
  assert.equal(s.configured["microsoft-teams"], false);
  assert.equal(s.configured.atlassian, true);
  assert.equal(s.configured.canva, false);
  assert.equal(s.configured.zoom, false);
  assert.equal(s.configured.figma, false);
  assert.equal(s.configured.linear, true);
  assert.equal(s.configured.gmail, undefined);
  assert.equal(s.configured["microsoft-sharepoint"], false);
  assert.deepEqual(apps.configuredFrom({ available: [], registry: [] }), {});
});

test("Dia's connected apps are listed, each on the Alia connection that serves it", () => {
  const byId = Object.fromEntries(apps.APPS.map((a) => [a.id, a]));
  for (const id of ["atlassian", "trello", "figma", "canva", "zoom", "granola", "amplitude", "amplitude-eu", "salesforce"]) {
    assert.equal(byId[id].kind, "mcp", id);
    assert.equal(byId[id].service, id, id);
    assert.equal(byId[id].oauth, true, id);
  }
  for (const id of ["microsoft-outlook", "microsoft-teams", "microsoft-sharepoint"]) assert.equal(byId[id].kind, "integration", id);
  const searchable = (word) => apps.APPS.filter((a) => `${a.name} ${a.description}`.toLowerCase().includes(word)).map((a) => a.id);
  assert.deepEqual(searchable("jira"), ["atlassian"]);
  assert.deepEqual(searchable("loom"), ["atlassian"]);
  assert.ok(!apps.APPS.some((a) => /linkedin/i.test(a.name)));
});

test("connecting a remote connector installs it, then starts its OAuth", async () => {
  calls.length = 0;
  const url = await apps.connectUrl(apps.APPS.find((a) => a.id === "linear"));
  assert.equal(url, "https://mcp.linear.app/authorize?x");
  assert.deepEqual(calls, ['POST /mcp/install {"registryId":"linear"}', "POST /mcp/m2/oauth/start"]);
  calls.length = 0;
  await apps.connectUrl(apps.APPS.find((a) => a.id === "atlassian"));
  assert.deepEqual(calls, ['POST /mcp/install {"registryId":"atlassian"}', "POST /mcp/m2/oauth/start"]);
  calls.length = 0;
  await apps.connectUrl(apps.APPS.find((a) => a.id === "microsoft-teams"));
  assert.deepEqual(calls, ["GET /integrations/microsoft-teams/oauth-url"]);
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
