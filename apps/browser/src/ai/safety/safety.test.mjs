import assert from "node:assert/strict";
import { test } from "node:test";

const safety = await import("./sensitive.ts");

test("banking, health and password-manager sites are sensitive", () => {
  assert.equal(safety.sensitivity("https://secure.chase.com/web/auth")?.kind, "finance");
  assert.equal(safety.sensitivity("https://www.mybank.example/login")?.kind, "finance");
  assert.equal(safety.sensitivity("https://mychart.example-health.org/")?.kind, "health");
  assert.equal(safety.sensitivity("https://vault.bitwarden.com/#/vault")?.kind, "passwords");
  assert.equal(safety.sensitivity("https://en.wikipedia.org/wiki/Bank"), null);
  assert.equal(safety.sensitivity("https://news.example.com/banking"), null);
  assert.equal(safety.sensitivity("astro://settings"), null);
});

test("an organization's policy blocks, marks and turns off the built-in list", () => {
  const policy = safety.parsePolicy({ blockedSites: ["*.corp.example", "https://wiki.example/hr/"], sensitiveSites: ["crm.example"], builtInSensitiveSites: false, agent: false, redact: ["EMP-\\d{6}"] });
  assert.deepEqual(safety.sensitivity("https://intranet.corp.example/x", policy), { kind: "organization", host: "intranet.corp.example", blocked: true });
  assert.equal(safety.sensitivity("https://wiki.example/hr/salaries", policy)?.blocked, true);
  assert.equal(safety.sensitivity("https://wiki.example/eng", policy), null);
  assert.deepEqual(safety.sensitivity("https://app.crm.example/", policy), { kind: "organization", host: "app.crm.example", blocked: false });
  assert.equal(safety.sensitivity("https://chase.com/", policy), null);
  assert.equal(policy.agent, false);
  assert.equal(safety.redact("Badge EMP-123456 issued", policy).text, "Badge [removed by your organization's policy] issued");
});

test("a policy can arrive as JSON text, and a bad one changes nothing", () => {
  assert.deepEqual(safety.parsePolicy('{"blockedSites":["a.example"]}').blockedSites, ["a.example"]);
  assert.deepEqual(safety.parsePolicy("not json"), safety.DEFAULT_POLICY);
  assert.deepEqual(safety.parsePolicy({ redact: ["("] }).redact, []);
});

test("payment card numbers are removed, other numbers stay", () => {
  const out = safety.redact("Card 4111 1111 1111 1111, order 1234567890123, phone 555-123-4567");
  assert.equal(out.count, 1);
  assert.equal(out.text, "Card [card number removed], order 1234567890123, phone 555-123-4567");
});
