import assert from "node:assert/strict";
import { test } from "node:test";

const { registerAliaApi } = await import("./api.ts");
const { useOxySession } = await import("../../oxy/session.ts");
const memory = await import("./memory.ts");

const calls = [];
const stored = {
  _id: "um1",
  memories: [
    { _id: "e1", title: "Works at Oxy", summary: "Product engineer", type: "profile" },
    { _id: "e2", title: "Likes hiking", summary: "Weekends", type: "topic" },
    { title: "no id" },
  ],
  settings: { autoSaveEnabled: true, recallEnabled: false },
  preferences: { language: "es-ES", tone: "concise", responseLength: "short", interests: ["browsers"] },
  context: { occupation: "Engineer", location: "Barcelona" },
};
const api = {
  get: async (path) => (calls.push(["GET", path]), { status: 200, data: stored }),
  post: async () => ({ status: 200, data: {} }),
  patch: async () => ({ status: 200, data: {} }),
  put: async (path, body) => (calls.push(["PUT", path, body]), { status: 200, data: {} }),
  delete: async (path) => (calls.push(["DELETE", path]), { status: 200, data: {} }),
};

test("Alia's memory profile is read defensively", () => {
  const p = memory.memoryProfileOf(stored);
  assert.deepEqual(p.memories.map((m) => m._id), ["e1", "e2"]);
  assert.deepEqual(p.context, { occupation: "Engineer", location: "Barcelona", timezone: "", bio: "" });
  assert.deepEqual(p.preferences, { language: "es-ES", tone: "concise", responseLength: "short", interests: ["browsers"] });
  assert.deepEqual(p.settings, { autoSaveEnabled: true, recallEnabled: false });
  assert.deepEqual(memory.memoryProfileOf(null).settings, { autoSaveEnabled: true, recallEnabled: true });
  assert.deepEqual(memory.interestsOf(" a, b ,, a,c "), ["a", "b", "c"]);
});

test("saving sends Alia the whole section, since its PUT replaces it", async () => {
  registerAliaApi(api);
  useOxySession.setState({ account: { id: "u1" } });
  await memory.refreshMemory();
  calls.length = 0;
  await memory.saveContext({ bio: "  I build browsers " });
  await memory.savePreferences({ tone: "" });
  await memory.saveMemorySettings({ recallEnabled: true });
  await memory.forgetMemory("e2");
  assert.deepEqual(calls, [
    ["PUT", "/memory/context", { occupation: "Engineer", location: "Barcelona", timezone: null, bio: "I build browsers" }],
    ["PUT", "/memory/preferences", { language: "es-ES", tone: null, responseLength: "short", interests: ["browsers"] }],
    ["PUT", "/memory/settings", { recallEnabled: true }],
    ["DELETE", "/memory/e2"],
  ]);
  assert.deepEqual(memory.useMemoryProfile.getState().profile.memories.map((m) => m._id), ["e1"]);
});

test("a refused save puts the profile back and says so", async () => {
  registerAliaApi({ ...api, put: async () => Promise.reject(new Error("500")) });
  const before = memory.useMemoryProfile.getState().profile;
  await memory.saveContext({ occupation: "Pilot" });
  assert.equal(memory.useMemoryProfile.getState().profile, before);
  assert.equal(memory.useMemoryProfile.getState().error, "That change couldn't be saved.");
});
