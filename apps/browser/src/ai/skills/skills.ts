import { create } from "zustand";
import { alia, aliaReady } from "../alia/api";

export type SkillSource = "builtin" | "registry" | "github" | "upload" | "authored";

export type Skill = {
  _id: string;
  name: string;
  displayName: string;
  description: string;
  source: SkillSource;
  publisher: string | null;
  tags: string[];
  icon: string | null;
  color: string | null;
  ownerOxyUserId: string | null;
  visibility: "private" | "public";
  installCount: number;
  allowedTools?: string[];
  updatedAt?: string;
};

export type InstalledSkill = Skill & { enabled: boolean; autoInvoke: boolean; pinnedVersion: number | null; installedVersion: number };

export type SkillDetail = { skill: Skill; version: { version: number; body: string } | null };

export type SkillDraft = { name: string; description: string; body: string; warnings: string[] };

export type AstroCommand = "research" | "brief" | "prep" | "recap";

export type SlashCandidate =
  | { kind: "command"; key: string; command: AstroCommand; name: string; title: string; description: string; icon: string }
  | { kind: "skill"; key: string; name: string; title: string; description: string; icon: string | null; auto: boolean };

export const ASTRO_COMMANDS: { command: AstroCommand; name: string; title: string; description: string; icon: string }[] = [
  { command: "research", name: "research", title: "Deep Research", description: "Searches the web in depth and writes a sourced report", icon: "text.magnifyingglass" },
  { command: "brief", name: "start-my-day", title: "Start My Day", description: "Your morning brief: today's meetings, what you left open, what needs you", icon: "sun.max" },
  { command: "prep", name: "prep", title: "Prepare for My Next Meeting", description: "Who's coming, what it's about, and what to have ready", icon: "person.2" },
  { command: "recap", name: "recap", title: "Recap My Last Meeting", description: "What happened, decisions and follow-ups, from the meeting and the pages you used", icon: "text.badge.checkmark" },
];

type SkillsState = { installed: InstalledSkill[]; loadedAt: number | null; loading: boolean; error: string | null; owner: string | null };

export const useSkills = create<SkillsState>()(() => ({ installed: [], loadedAt: null, loading: false, error: null, owner: null }));

const STALE_MS = 60_000;
let inflight: Promise<void> | null = null;

export function refreshSkills(options: { force?: boolean } = {}): Promise<void> {
  if (!aliaReady()) return Promise.resolve();
  const { loadedAt } = useSkills.getState();
  if (!options.force && loadedAt && Date.now() - loadedAt < STALE_MS) return Promise.resolve();
  if (inflight) return inflight;
  useSkills.setState({ loading: true });
  inflight = alia()
    .get<{ skills: InstalledSkill[] }>("/skills/installed")
    .then((r) => useSkills.setState({ installed: Array.isArray(r.data?.skills) ? r.data.skills : [], loadedAt: Date.now(), loading: false, error: null }))
    .catch(() => useSkills.setState({ loading: false, error: "Your skills couldn't be loaded." }))
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function forgetSkills() {
  useSkills.setState({ installed: [], loadedAt: null, loading: false, error: null, owner: null });
}

export async function searchCatalogue(query: string, options: { tag?: string; limit?: number } = {}): Promise<Skill[]> {
  const r = await alia().get<{ skills: Skill[] }>("/skills", {
    params: { query: query.trim() || undefined, tag: options.tag, limit: options.limit ?? 60 },
  });
  return Array.isArray(r.data?.skills) ? r.data.skills : [];
}

export async function mySkills(): Promise<Skill[]> {
  const r = await alia().get<{ skills: Skill[] }>("/skills/mine");
  return Array.isArray(r.data?.skills) ? r.data.skills : [];
}

export async function skillDetail(idOrName: string): Promise<SkillDetail> {
  const r = await alia().get<SkillDetail>(`/skills/${encodeURIComponent(idOrName)}`);
  return r.data;
}

export async function installSkill(id: string) {
  await alia().post(`/skills/${encodeURIComponent(id)}/install`);
  await refreshSkills({ force: true });
}

export async function uninstallSkill(id: string) {
  await alia().delete(`/skills/${encodeURIComponent(id)}/install`);
  useSkills.setState((s) => ({ installed: s.installed.filter((k) => k._id !== id) }));
}

export async function setSkillInstall(id: string, patch: { enabled?: boolean; autoInvoke?: boolean }) {
  useSkills.setState((s) => ({ installed: s.installed.map((k) => (k._id === id ? { ...k, ...patch } : k)) }));
  try {
    await alia().patch(`/skills/${encodeURIComponent(id)}/install`, patch);
  } catch (error) {
    await refreshSkills({ force: true });
    throw error;
  }
}

export async function publishSkill(id: string, published: boolean) {
  await alia().patch(`/skills/${encodeURIComponent(id)}`, { visibility: published ? "public" : "private" });
  await refreshSkills({ force: true });
}

export async function deleteSkill(id: string) {
  await alia().delete(`/skills/${encodeURIComponent(id)}`);
  useSkills.setState((s) => ({ installed: s.installed.filter((k) => k._id !== id) }));
}

export type SkillInput = { name: string; displayName: string; description: string; body: string; icon?: string };

export async function createSkill(input: SkillInput): Promise<Skill> {
  const r = await alia().post<{ skill: Skill }>("/skills", {
    name: input.name,
    displayName: input.displayName,
    description: input.description,
    body: input.body,
    ...(input.icon ? { icon: input.icon } : {}),
  });
  await refreshSkills({ force: true });
  return r.data.skill;
}

export async function updateSkill(id: string, input: SkillInput): Promise<void> {
  await alia().post(`/skills/${encodeURIComponent(id)}/versions`, { name: input.name, description: input.description, body: input.body });
  await alia().patch(`/skills/${encodeURIComponent(id)}`, { displayName: input.displayName, ...(input.icon ? { icon: input.icon } : {}) });
  await refreshSkills({ force: true });
}

export async function draftSkill(prompt: string, language = "en-US"): Promise<SkillDraft> {
  const r = await alia().post<{ frontmatter?: { name?: string; description?: string }; body?: string; warnings?: string[] }>("/skills/generate", { prompt, language });
  return {
    name: skillName(r.data.frontmatter?.name ?? ""),
    description: r.data.frontmatter?.description ?? "",
    body: r.data.body ?? "",
    warnings: r.data.warnings ?? [],
  };
}

export const SKILL_NAME_MAX = 64;
export const SKILL_DESCRIPTION_MAX = 1024;

export function skillName(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, SKILL_NAME_MAX)
    .replace(/-+$/, "");
}

export function skillProblem(input: Pick<SkillInput, "name" | "description" | "body">): string | null {
  if (!input.name) return "Give the skill a name.";
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(input.name)) return "Names use lowercase letters, digits and single hyphens.";
  if (/claude|anthropic/.test(input.name)) return "Pick another name.";
  if (!input.description.trim()) return "Say what the skill does and when to use it.";
  if (input.description.length > SKILL_DESCRIPTION_MAX) return `Keep the description under ${SKILL_DESCRIPTION_MAX} characters.`;
  if (!input.body.trim()) return "Write the steps the skill follows.";
  return null;
}

export const ALIA_WEB = "https://alia.onl";

export const skillShareUrl = (skill: Pick<Skill, "_id">) => `${ALIA_WEB}/skills/${encodeURIComponent(skill._id)}`;

export const SLASH = /(^|\s)\/([a-z0-9-]*)$/;

export const LEADING_SLASH = /^\/([a-z0-9][a-z0-9-]*)(?:\s+([\s\S]*))?$/;

const matches = (query: string, ...fields: string[]) => {
  const q = query.toLowerCase();
  return !q || fields.some((f) => f.toLowerCase().includes(q));
};

export function slashCandidates(installed: InstalledSkill[], query: string, options: { limit?: number } = {}): SlashCandidate[] {
  const commands: SlashCandidate[] = ASTRO_COMMANDS.filter((c) => matches(query, c.name, c.title))
    .map((c) => ({ kind: "command", key: `command:${c.command}`, command: c.command, name: c.name, title: c.title, description: c.description, icon: c.icon }));
  const skills: SlashCandidate[] = installed
    .filter((k) => k.enabled && matches(query, k.name, k.displayName))
    .map((k) => ({ kind: "skill", key: `skill:${k._id}`, name: k.name, title: k.displayName || k.name, description: k.description, icon: k.icon, auto: k.autoInvoke }));
  const startsFirst = (c: SlashCandidate) => (query && c.name.startsWith(query.toLowerCase()) ? 0 : 1);
  return [...skills, ...commands].sort((a, b) => startsFirst(a) - startsFirst(b)).slice(0, options.limit ?? 8);
}

export function parseSlash(text: string, installed: InstalledSkill[]): { candidate: SlashCandidate; rest: string } | null {
  const m = LEADING_SLASH.exec(text.trim());
  if (!m) return null;
  const name = m[1]!;
  const rest = (m[2] ?? "").trim();
  const skill = installed.find((k) => k.enabled && k.name === name);
  if (skill)
    return {
      candidate: { kind: "skill", key: `skill:${skill._id}`, name: skill.name, title: skill.displayName || skill.name, description: skill.description, icon: skill.icon, auto: skill.autoInvoke },
      rest,
    };
  const command = ASTRO_COMMANDS.find((c) => c.name === name || c.command === name);
  if (command)
    return {
      candidate: { kind: "command", key: `command:${command.command}`, command: command.command, name: command.name, title: command.title, description: command.description, icon: command.icon },
      rest,
    };
  return null;
}
