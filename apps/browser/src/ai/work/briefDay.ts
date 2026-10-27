import type { AstroCommand } from "../skills/skills";

const KEY = "astro.chat.briefDay";

const dayOf = (at: number) => new Date(at).toDateString();

let memory: string | null = null;

function read(): string | null {
  try {
    return globalThis.localStorage?.getItem(KEY) ?? memory;
  } catch {
    return memory;
  }
}

export const briefDoneToday = (now: number) => read() === dayOf(now);

export function noteCommandSent(command: AstroCommand, now = Date.now()) {
  if (command !== "brief") return;
  memory = dayOf(now);
  try {
    globalThis.localStorage?.setItem(KEY, memory);
  } catch {}
}
