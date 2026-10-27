import assert from "node:assert/strict";
import { test } from "node:test";

const { autoGroupName } = await import("./groupNames.ts");

const tab = (url, title = "") => ({ url, title });

test("tabs on an IPv4 address are named after the address and its port, not an octet", () => {
  assert.equal(autoGroupName([tab("http://127.0.0.1:8795/a"), tab("http://127.0.0.1:8795/b")]), "127.0.0.1:8795");
  assert.equal(autoGroupName([tab("http://192.168.0.10/admin", "Admin"), tab("http://192.168.0.10/status", "Status")]), "192.168.0.10");
  assert.equal(autoGroupName([tab("http://10.0.0.1/", "Router")]), "10.0.0.1");
});

test("tabs on an IPv6 address are named after the address", () => {
  assert.equal(autoGroupName([tab("http://[::1]:3000/"), tab("http://[::1]:3000/docs")]), "[::1]:3000");
});

test("tabs on an address whose titles share a site take the site from the titles", () => {
  const members = [tab("http://10.0.0.5:3000/d/1", "Dashboards - Grafana"), tab("http://10.0.0.5:3000/explore", "Explore - Grafana")];
  assert.equal(autoGroupName(members), "Grafana");
  assert.equal(autoGroupName([tab("http://10.0.0.5:3000/d/1", "Home - Grafana"), tab("http://10.0.0.5:3000/d/2", "Home - Grafana")]), "Grafana Home");
});

test("named hosts keep their site label", () => {
  assert.equal(autoGroupName([tab("https://www.github.com/a"), tab("https://github.com/b")]), "Github");
  assert.equal(autoGroupName([tab("https://news.bbc.co.uk/1"), tab("https://news.bbc.co.uk/2")]), "Bbc");
  assert.equal(autoGroupName([tab("http://localhost:5173/")]), "Localhost");
});
