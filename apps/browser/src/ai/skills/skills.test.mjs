import assert from "node:assert/strict";
import { test } from "node:test";

globalThis.__DEV__ = false;
await import("../../test-native-stub.mjs");
const skills = await import("./skills.ts");
const { registerAliaApi } = await import("../alia/api.ts");
const { useOxySession } = await import("../../oxy/session.ts");

const installed = [
  { _id: "1", name: "cover-letter", displayName: "Cover Letter", description: "Writes cover letters", enabled: true, autoInvoke: false, icon: "✍️", tags: [] },
  { _id: "2", name: "code-reviewer", displayName: "Code Reviewer", description: "Reviews code", enabled: true, autoInvoke: true, icon: null, tags: [] },
  { _id: "3", name: "off-skill", displayName: "Off", description: "Disabled", enabled: false, autoInvoke: false, icon: null, tags: [] },
];

test("a skill's command is a lowercase slug Alia accepts", () => {
  assert.equal(skills.skillName("Cover Letter!"), "cover-letter");
  assert.equal(skills.skillName("  Résumé — Tailor  "), "resume-tailor");
  assert.equal(skills.skillName("a".repeat(80)).length, 64);
  assert.equal(skills.skillProblem({ name: "Bad Name", description: "x", body: "y" }), "Names use lowercase letters, digits and single hyphens.");
  assert.equal(skills.skillProblem({ name: "ok", description: "", body: "y" }), "Say what the skill does and when to use it.");
  assert.equal(skills.skillProblem({ name: "ok", description: "d", body: " " }), "Write the steps the skill follows.");
  assert.equal(skills.skillProblem({ name: "ok", description: "d", body: "1. do it" }), null);
});

test("typing / lists enabled skills first, then Astro's commands", () => {
  const all = skills.slashCandidates(installed, "", { limit: 20 });
  assert.deepEqual(
    all.map((c) => c.name),
    ["cover-letter", "code-reviewer", "research", "start-my-day", "prep", "recap"],
  );
  assert.deepEqual(
    skills.slashCandidates(installed, "co", {}).map((c) => c.name),
    ["cover-letter", "code-reviewer"],
  );
  assert.deepEqual(
    skills.slashCandidates(installed, "re", {}).slice(0, 2).map((c) => c.name),
    ["research", "recap"],
  );
});

test("a message that starts with /name runs that skill on the rest", () => {
  const typed = skills.parseSlash("/cover-letter for the Acme job", installed);
  assert.equal(typed.candidate.kind, "skill");
  assert.equal(typed.candidate.name, "cover-letter");
  assert.equal(typed.rest, "for the Acme job");
  assert.equal(skills.parseSlash("/research quantum batteries", installed).candidate.command, "research");
  assert.equal(skills.parseSlash("/start-my-day", installed).candidate.command, "brief");
  assert.equal(skills.parseSlash("/off-skill hi", installed), null);
  assert.equal(skills.parseSlash("/usr/local/bin is a path", installed), null);
  assert.equal(skills.parseSlash("no slash", installed), null);
});

test("the Skills API calls are Alia's own routes, and nothing is sent signed out", async () => {
  const calls = [];
  const api = {
    get: async (path, request) => (calls.push(["GET", path, request?.params]), { status: 200, data: { skills: path === "/skills/installed" ? installed : [] } }),
    post: async (path, body) => (calls.push(["POST", path, body]), { status: 201, data: { skill: { _id: "9", name: body?.name } } }),
    patch: async (path, body) => (calls.push(["PATCH", path, body]), { status: 200, data: {} }),
    delete: async (path) => (calls.push(["DELETE", path]), { status: 204, data: undefined }),
  };
  const off = registerAliaApi(api);
  await skills.refreshSkills({ force: true });
  assert.equal(calls.length, 0);
  useOxySession.setState({ account: { id: "u1" } });
  await skills.refreshSkills({ force: true });
  assert.equal(skills.useSkills.getState().installed.length, 3);
  await skills.setSkillInstall("2", { autoInvoke: false });
  await skills.publishSkill("1", true);
  await skills.createSkill({ name: "tldr", displayName: "TL;DR", description: "Summarizes", body: "1. Read\n2. Summarize" });
  await skills.searchCatalogue("write");
  assert.deepEqual(
    calls.map(([m, p]) => `${m} ${p}`),
    ["GET /skills/installed", "PATCH /skills/2/install", "PATCH /skills/1", "GET /skills/installed", "POST /skills", "GET /skills/installed", "GET /skills"],
  );
  assert.deepEqual(calls[2][2], { visibility: "public" });
  assert.equal(calls[4][2].name, "tldr");
  assert.equal(calls[6][2].query, "write");
  assert.equal(skills.skillShareUrl({ _id: "abc" }), "https://alia.onl/skills/abc");
  useOxySession.setState({ account: null });
  off();
});
